// ==UserScript==
// @name         快捷导航按钮
// @namespace    https://github.com/botaothomaszhao/pkus-xny-ultra
// @version      vv.3.5
// @license      GPL-3.0
// @description  提供收藏夹、目录搜索、页面刷新按钮，并在页面加载时自动重放路径
// @author       c-jeremy botaothomaszhao
// @match        https://bdfz.xnykcxt.com:5002/*
// @exclude      https://bdfz.xnykcxt.com:5002/exam/pdf/web/viewer.html*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @run-at       document-body
// @require      https://unpkg.com/pinyin-match@1.2.8/dist/main.js
// ==/UserScript==

(function () {
    'use strict';

    // 配置
    const FAVORITES_STORAGE_KEY = 'xny_favorites_paths';
    const REPLAY_STORAGE_KEY = 'xny_replay_path';

    const HARD_REFRESH_PRESS_MS = 2500;

    // bottom为按钮距底部高度，offset为按钮所占高度，单位px
    const bottom = 100, offset = 50;
    // 防止按钮与导航菜单重叠
    const btnBaseY = Math.min(document.documentElement.clientHeight - 320 - offset * 4, bottom);

    // 收藏夹样式
    GM_addStyle(`
        .nav-btn {
            position: absolute;
            left: 0;
            z-index: 990;
            width: 50px;
            height: ${offset}px;
            background-color: transparent;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .nav-btn svg {
            width: 26px;
            height: 26px;
            stroke: white;
        }
        .nav-btn:hover { transform: scale(1.1); }
        
        #show-favorites-btn { bottom: ${btnBaseY + offset * 3}px; }
        #add-favorite-btn { bottom: ${btnBaseY + offset * 2}px; }
        #search-btn { bottom: ${btnBaseY + offset}px; }
        #hard-refresh-btn { bottom: ${btnBaseY}px; }

        .drawer-overlay {
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            z-index: 9999;
            opacity: 0;
            transition: opacity .25s ease;
            background-color: rgba(255,255,255,0.5);
            backdrop-filter: blur(10px);
        }
        .drawer-overlay.visible { opacity: 1; visibility: visible; }

        .bottom-sheet-drawer {
            position: fixed; left: 0; right: 0; bottom: 0; max-height: 70%;
            background-color: #f9f9f9;
            border-top-left-radius: 16px; border-top-right-radius: 16px;
            box-shadow: 0 -4px 20px rgba(0,0,0,0.12);
            transform: translateY(100%);
            transition: transform .25s ease-out;
            z-index: 10000;
            display: flex; flex-direction: column; overflow: hidden;
            outline: none;
        }
        .drawer-overlay.visible .bottom-sheet-drawer { transform: translateY(0); }

        .drawer-header {
            padding: 12px 16px; text-align: center; flex-shrink: 0; position: relative; background: #f9f9f9;
        }
        .drawer-header::before {
            content: '';
            position: absolute; top: 8px; left: 50%;
            transform: translateX(-50%);
            width: 40px; height: 4px;
            background-color: #d1d5db; border-radius: 2px;
        }
        .drawer-header h2 {
            margin: 12px 0 0; font-size: 1.1rem; font-weight: 600; color: #111827;
        }

        .unified-list {
            max-height: 60vh; overflow-y: auto; list-style: none; margin: 0; padding: 8px;
        }
        .unified-list-item {
            padding: 12px 16px; border-radius: 8px; cursor: pointer; transition: background-color .12s ease;
            display: flex; flex-direction: column;
        }
        .unified-list-item:focus, .unified-list-item:focus-visible {
            outline: none !important;
            box-shadow: none !important;
        }
        .unified-list li:hover, .unified-list li.highlighted {
            background: #eef2ff;
        }
        .empty-list { padding: 20px; text-align: center; color: #9ca3af; }

        #favorites-drawer .unified-list-item { flex-direction: row; align-items: center; }

        .item-text-content { flex-grow: 1; min-width: 0; display: flex; flex-direction: column; }
        .item-title {
            font-size: 0.95rem;
            font-weight: 500;
            color: #111827;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;
        }
        .item-path {
            font-size: 0.78rem;
            color: #6b7280;
            margin-top: 6px;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;
        }
        .title-edit-input {
            width: 100%; border: 1px solid #3b82f6; border-radius: 6px; padding: 2px 4px;
            font-size: 0.95rem; font-weight: 500; color: #111827; outline: none;
            box-shadow: 0 0 0 2px rgba(59,130,246,0.2);
        }
        .item-actions { display: flex; align-items: center; flex-shrink: 0; }
        .action-btn {
            background: none; border: none; color: #9ca3af; cursor: pointer;
            padding: 8px; line-height: 1; border-radius: 50%; display: flex;
            align-items: center; justify-content: center;
        }
        .action-btn:hover, .action-btn:focus { background-color: #f3f4f6; color: #374151; }
        .action-btn.delete:hover, .action-btn.delete:focus { color: #ef4444; }
        .action-btn svg { width: 20px; height: 20px; display: block; }

        .search-spotlight-card {
            position: fixed; top: 12vh; left: 50%; transform: translateX(-50%); width: 92%; max-width: 720px;
            background: #fff; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.12);
            z-index: 10000;
            overflow: hidden;
        }
        .search-input-wrapper {
            display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid #eee;
        }
        .search-input-wrapper .icon {
            width: 20px; height: 20px; color: #9ca3af; margin-right: 10px; display: flex;
            align-items: center; justify-content: center;
        }
        .search-spotlight-input {
            width: 100%; height: 44px; border: none; outline: none; font-size: 16px;
            background: transparent; color: #111827;
        }

        #hard-refresh-btn.loading svg {
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
    `);

    const ICONS = {
        'add-favorite-btn':
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                <line x1="12" y1="8" x2="12" y2="14"></line>
                <line x1="9" y1="11" x2="15" y2="11"></line>
            </svg>`,
        'show-favorites-btn': `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
            </svg>`,
        'search-btn':
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="7"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>`,
        'hard-refresh-btn': `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20.8 5.6v4.8h-4.8"></path>
                <path d="M3.2 18.4v-4.8h4.8"></path>
                <path d="M5.21 9.6a7.2 7.2 0 0 1 11.88-2.69L20.8 10.4M3.2 13.6l3.71 3.49A7.2 7.2 0 0 0 18.79 14.4"></path>
            </svg>`,

        // 编辑/删除操作按钮图标（列表项内）
        'edit':
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
            </svg>`,
        'delete':
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                <path d="M10 11v6"/>
                <path d="M14 11v6"/>
                <path d="M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2"/>
            </svg>`,

        // 搜索框左侧放大的图标
        'search-input-icon':
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="7"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>`
    };

    // 通用函数
    function notLogin(url = window.location.href) {
        return !url.includes("/stu/#/login")
    }

    function sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    function cleanInnerText(el) {
        if (!el) return "";
        const clone = el.cloneNode(true);
        clone.querySelectorAll("i, svg, path").forEach(n => n.remove());
        return clone.textContent.trim();
    }

    function captureCurrentPath() {
        let path = [];
        const root = document.querySelector('div.menu > div.active');
        if (root) {
            path.push({selector: "div.menu > div", text: cleanInnerText(root)});
        }
        const activeFolder = document.querySelector('div.folderName.active');
        if (activeFolder) {
            path.push({selector: "div.folderName", text: cleanInnerText(activeFolder)});
        }
        const searchContext = activeFolder?.closest('div.folder') || document;
        const selected = searchContext.querySelector('.ant-tree-node-selected');
        const entries = [];

        if (selected) {
            // 从选中节点向上收集属于“展开父节点”或“选中本身”的 span，最后 reverse 为从顶到底
            let li = selected.closest('li[role="treeitem"]');
            while (li) {
                const wrapper = li.querySelector(':scope > span.ant-tree-node-content-wrapper');
                if (wrapper?.classList.contains('ant-tree-node-content-wrapper-open') || wrapper?.classList.contains('ant-tree-node-selected')) {
                    entries.push(wrapper);
                }
                // 向上寻找包含当前 li 的最近的已展开父 li
                li = li.parentElement?.closest('li[role="treeitem"].ant-tree-treenode-switcher-open');
            }
            entries.reverse(); // 顶层 -> 目标
            for (const el of entries) {
                const text = cleanInnerText(el);
                if (text) path.push({selector: "span.ant-tree-node-content-wrapper", text});
            }
            // 映射为存储结构并合并到 path

            /*
            // 顶部标签栏：能正确捕获但无法正确回放
            const slide = document.querySelector("div.swiper-slide.sideActive");
            if (slide){
                path.push({selector: "div.swiper-slide", text: cleanInnerText(slide)});
            }*/
        } else if (window.location.href.includes('catalogId='))
            return null; // 非空页面但未选中任何节点，可能是文件夹被收起导致无法捕获，返回 null 以不保存
        return path.length > 0 ? path : null;
    }

    function scrollTreeItem(node) {
        node.scrollIntoView({block: 'center', behavior: 'auto'});
    }

    // 全局递增 token：每次开始新回放都 ++，旧回放在检测到 token 变化后中止
    let replayToken = 0;

    async function replayPath(path, myToken) {
        let lastClickedEl = null;

        async function click(sel, text) {
            for (let i = 0; i < 100; i++) { // 最多尝试10s
                for (const node of document.querySelectorAll(sel)) {
                    if (cleanInnerText(node) === text) {
                        if (!node.matches('.ant-tree-node-content-wrapper-open, div.folderName.active')) {
                            node.click(); // 如果已展开则不点击
                            scrollTreeItem(node);
                        }
                        lastClickedEl = node;
                        return true;
                    }
                }
                if (replayToken !== myToken) {
                    throw new Error('Replay cancelled');
                }
                await sleep(100);
            }
            return false;
        }

        for (const step of path) {
            // 在每一步开始前检查 token（若被替换则中断）
            if (replayToken !== myToken) {
                throw new Error('Replay cancelled');
            }
            if (!(await click(step.selector, step.text))) {
                throw new Error('Replay failed');
            }
            await sleep(200);
        }
        return lastClickedEl;
    }

    async function savePathForReplay(path = null) {
        try {
            if (!path) { // 防止在登录页面触发保存空路径
                if (!notLogin()) return;
                path = captureCurrentPath();
            }
            if (path?.length > 1) await GM_setValue(REPLAY_STORAGE_KEY, JSON.stringify(path));
        } catch (e) {
            console.warn('保存回放路径失败：', e);
        }
    }

    // 通用抽屉组件
    class ItemDrawer {
        /*
        keyInput: (drawer: HTMLDivElement, itemEl: HTMLUListElement) => HTMLInputElement 返回用于绑定按键的元素
         */
        constructor(drawerID, drawerClassName, keyInput) {
            this.overlay = document.createElement('div');
            this.overlay.className = 'drawer-overlay';

            const drawerEl = document.createElement('div');
            drawerEl.id = drawerID;
            drawerEl.className = drawerClassName;

            this.itemEl = document.createElement('ul');
            this.itemEl.className = 'unified-list';

            this.keyInputEl = keyInput(drawerEl, this.itemEl); // 绑定按键的元素

            this.overlay.appendChild(drawerEl);
            document.body.appendChild(this.overlay);

            this.keyInputEl.addEventListener('keydown', (e) => this.escHandle(e), true);
            this.keyInputEl.addEventListener('keyup', (e) => this.escHandle(e), true);

            this.overlay.addEventListener('click', (e) => {
                if (e.target === this.overlay) this.close();
            });
            this.itemElsList = [];
            this.currentIndex = -1;
            this.keyInputEl.addEventListener('keydown', (e) => this.handleKeydown(e));

            // 显示并聚焦
            requestAnimationFrame(() => {
                this.overlay.classList.add('visible');
                // 判断是否为输入框，若是则选中内容
                this.keyInputEl.tabIndex = -1;
                this.keyInputEl.focus();
                if (this.keyInputEl.tagName === 'INPUT') {
                    this.keyInputEl.select();
                }
            });
        }

        /*
        onItem: (li: HTMLLIElement, item: any, index: number) => void
         */
        renderList(items, onItem, emptyText = '') {
            this.itemEl.innerHTML = '';
            this.itemElsList = [];
            if (!items || items.length === 0) {
                this.itemEl.innerHTML = `<div class="empty-list">${emptyText}</div>`;
                return;
            }
            items.forEach((item, index) => {
                const li = document.createElement('li');
                li.className = 'unified-list-item';
                onItem(li, item, index);
                this.itemEl.appendChild(li);
                this.itemElsList.push(li);
                li.addEventListener('focus', () => this.highlightIndex(index));
                // 跟随焦点，如无法聚焦则无效果（li默认无法聚焦，需要tabIndex=0）
            });
            this.keyInputEl.focus();
        }

        handleKeydown(e) {
            if (!this.itemElsList.length) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.highlightIndex(this.currentIndex + 1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.highlightIndex(this.currentIndex - 1);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (this.currentIndex >= 0 && this.currentIndex < this.itemElsList.length) {
                    this.itemElsList[this.currentIndex].click();
                } else if (this.itemElsList.length > 0) {
                    this.itemElsList[0].click();
                }
            }
        }

        highlightIndex(index) {
            if (!this.itemElsList.length) return;

            if (index < 0) index = this.itemElsList.length - 1;
            if (index >= this.itemElsList.length) index = 0;

            this.currentIndex = index;
            this.itemElsList.forEach(it => it.classList.remove('highlighted'));
            this.itemElsList[this.currentIndex].classList.add('highlighted');
            this.itemElsList[this.currentIndex].scrollIntoView({block: 'nearest', behavior: 'auto'});
            this.itemElsList[this.currentIndex].focus({focusVisible: false});
        }

        escHandle(e) {
            if (e.key === 'Escape' || e.key === 'Esc') {
                try {
                    e.preventDefault();
                    e.stopPropagation();
                } catch (_) {
                }
                this.close();
            }
        }

        close() {
            if (this.overlay) {
                const oldOverlay = this.overlay;
                oldOverlay.classList.remove('visible');
                oldOverlay.addEventListener('transitionend', oldOverlay.remove, {once: true});
                this.overlay = null; // 防止重复销毁
                this.itemEl = null;
                this.itemElsList = [];
                this.keyInputEl = null;
            }
        }
    }

    // 用面向对象封装 next-step 抽屉与顶层应用状态，便于后续扩展
    class NextStepManager {
        constructor() {
            this.drawer = null;
        }

        onLoginPage() {
            this.closeDrawer();
        }

        onPageChange() {
            this.closeDrawer();
        }

        open(children) {
            this.closeDrawer();
            this.drawer = new ItemDrawer(
                'next-step-drawer',
                'bottom-sheet-drawer',
                (drawer, itemEl) => {
                    drawer.innerHTML = `<div class="drawer-header"><h2>可能的下一步</h2></div>`;
                    drawer.appendChild(itemEl);
                    return drawer;
                });
            this.drawer.renderList(
                children,
                (li, childEl) => {
                    li.innerHTML = `<span class="item-title">${cleanInnerText(childEl)}</span>`;
                    li.addEventListener('click', () => {
                        try {
                            childEl.click();
                            scrollTreeItem(childEl);
                        } catch (e) {
                            console.error(e);
                        }
                        this.closeDrawer();
                    });
                });
        }

        closeDrawer() {
            this.drawer?.close();
            this.drawer = null;
        }

        // 检测是否有子节点可展开，若有则展开
        checkNextStep(lastElement) {
            let childTree;
            if (lastElement?.matches('.folderName')) {
                childTree = lastElement.closest('div.folder')?.querySelector('.ant-tree-directory');
            } else {
                childTree = lastElement?.closest('li[role="treeitem"]')?.querySelector('ul.ant-tree-child-tree');
            }
            if (childTree?.children.length > 0) {
                const childrenWrappers = Array.from(childTree.querySelectorAll(':scope > li > span.ant-tree-node-content-wrapper'));
                if (childrenWrappers.length > 0) {
                    this.open(childrenWrappers);
                }
            }
        }
    }

    const nextStepManager = new NextStepManager();

    // startReplay：中断旧回放并立即开始新的
    async function startReplay(path, openNextStep) {
        replayToken++;
        try {
            const last = await replayPath(path, replayToken);
            if (openNextStep) {
                nextStepManager.checkNextStep(last);
            }
        } catch (e) {
            if (e.message !== 'Replay cancelled') throw e;
        }
    }

    // 图标直接从 ICONS map 中根据id获取
    class NavigationButton {
        constructor(id, title, onclick) {
            this.button = document.createElement('button');
            this.button.className = 'nav-btn';
            this.button.id = id;
            this.button.title = title;
            // 从 ICONS 中获取对应的图标
            this.button.innerHTML = ICONS[id] || '';
            document.body.appendChild(this.button);
            if (onclick) this.button.addEventListener('click', onclick);
        }

        onLoginPage() {
            this.button.style.setProperty('visibility', 'hidden');
        }

        onAppPage() {
            this.button.style.setProperty('visibility', 'visible');
        }
    }

    class FavBtn {
        constructor() {
            this.drawer = null;

            // 创建按钮，传入绑定的方法引用
            this.showBtn = new NavigationButton('show-favorites-btn', '显示收藏夹', () => this.openFavoritesDrawer());
            this.addBtn = new NavigationButton('add-favorite-btn', '添加到收藏夹', () => this.addCurrentPathToFavorites());
        }

        onLoginPage() {
            this.closeDrawer();
            this.addBtn.onLoginPage();
            this.showBtn.onLoginPage();
        }

        onAppPage() {
            this.addBtn.onAppPage();
            this.showBtn.onAppPage();
        }

        onPageChange() {
            this.closeDrawer();
        }

        async getFavorites() {
            return JSON.parse(await GM_getValue(FAVORITES_STORAGE_KEY, '[]'));
        }

        async saveFavorites(favorites) {
            await GM_setValue(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
        }

        renderItem = (li, fav, index) => {
            const textContentDiv = document.createElement('div');
            textContentDiv.className = 'item-text-content';
            const titleSpan = document.createElement('span');
            titleSpan.className = 'item-title';
            titleSpan.textContent = fav.title;
            const pathSpan = document.createElement('span');
            pathSpan.className = 'item-path';
            pathSpan.textContent = fav.path.map(p => p.text).join(' / ');
            textContentDiv.appendChild(titleSpan);
            textContentDiv.appendChild(pathSpan);

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'item-actions';

            const editBtn = document.createElement('button');
            editBtn.className = 'action-btn edit';
            editBtn.title = '重命名';
            editBtn.innerHTML = ICONS['edit'];

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'action-btn delete';
            deleteBtn.title = '删除';
            deleteBtn.innerHTML = ICONS['delete'];

            actionsDiv.appendChild(editBtn);
            actionsDiv.appendChild(deleteBtn);
            li.appendChild(textContentDiv);
            li.appendChild(actionsDiv);
            li.tabIndex = 0; // 允许聚焦以便能够用tab选中编辑、删除按钮

            li.addEventListener('click', async (e) => {
                if (editBtn.contains(e.target) || deleteBtn.contains(e.target)) return;
                this.closeDrawer();
                try {
                    await startReplay(fav.path, true);
                } catch (error) {
                    console.error("Replay or next step check failed:", error);
                }
            });

            function preventEnter(btn) {
                btn.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        btn.click();
                    }
                });
            }

            preventEnter(editBtn);
            preventEnter(deleteBtn);

            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteFavorite(index);
            });

            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'title-edit-input';
                input.value = fav.title;

                // 拦截 Enter，避免触发抽屉的回车导航，同时触发保存
                input.addEventListener('keydown', (ev) => {
                    if (ev.key === 'Enter') {
                        ev.preventDefault();
                        ev.stopPropagation();
                        input.blur(); // 触发保存
                    }
                });

                textContentDiv.replaceChild(input, titleSpan);
                input.focus();
                input.select();

                input.addEventListener('blur', async () => {
                    const newTitle = input.value.trim();
                    if (newTitle && newTitle !== fav.title) {
                        const c = await this.getFavorites();
                        c[index].title = newTitle;
                        await this.saveFavorites(c);
                        fav.title = newTitle;
                    }
                    titleSpan.textContent = fav.title;
                    textContentDiv.replaceChild(titleSpan, input);
                    // 保存后把高光定位到该项
                    this.drawer.highlightIndex(index);
                });
            });
        }

        async openFavoritesDrawer() {
            this.closeDrawer();
            this.drawer = new ItemDrawer(
                'favorites-drawer',
                'bottom-sheet-drawer',
                (drawer, itemEl) => {
                    drawer.innerHTML = `<div class="drawer-header"><h2>路径收藏夹</h2></div>`;
                    drawer.appendChild(itemEl);
                    return drawer;
                }
            );
            this.drawer.renderList(await this.getFavorites(), this.renderItem, `您的收藏夹夹是空的<br>点击"+"按钮添加吧`);
        }

        closeDrawer() {
            this.drawer?.close();
            this.drawer = null;
        }

        async addCurrentPathToFavorites() {
            const path = captureCurrentPath();
            if (!path || path.length < 2) {
                console.warn('收藏失败: 无法捕获当前路径。');
                return;
            }
            const favorites = await this.getFavorites();
            if (favorites.some(fav => JSON.stringify(fav.path) === JSON.stringify(path))) return;
            favorites.push({title: path[path.length - 1].text, path: path});
            await this.saveFavorites(favorites);
            console.info(`收藏成功：已将“${path[path.length - 1].text}”加入收藏夹。`);
        }

        async deleteFavorite(index) {
            let f = await this.getFavorites();
            f.splice(index, 1);
            await this.saveFavorites(f);
            this.drawer?.renderList(f, this.renderItem, `您的收藏夹夹是空的<br>点击"+"按钮添加吧`);
        }
    }

    class SearchBtn extends NavigationButton {
        constructor() {
            super('search-btn', '目录搜索', () => this.createSearchUI());

            // 实例状态
            this.searchableItems = []; // { title, displayPath, replayablePath }
            this.MAX_DISPLAY = 50;
            this.drawer = null;

            this.setupXHRInterceptorForCatalog();
        }

        onLoginPage() {
            this.closeDrawer();
            super.onLoginPage();
        }

        onPageChange(oldUrl, newUrl) {
            this.closeDrawer();
            // 不检测url ?后参数
            if (oldUrl.split('?')[0] !== newUrl.split('?')[0]) {
                this.searchableItems = [];
            }
        }

        // XHR 拦截：监听 catalog/entity 返回
        setupXHRInterceptorForCatalog() {
            const origOpen = XMLHttpRequest.prototype.open;
            const origSend = XMLHttpRequest.prototype.send;
            const self = this;

            XMLHttpRequest.prototype.open = function (method, url) {
                try {
                    if (typeof url === 'string' && url.includes('catalog/entity')) {
                        this._isCatalogTarget = true;
                    }
                } catch (e) {
                }
                return origOpen.apply(this, arguments);
            };

            XMLHttpRequest.prototype.send = function () {
                if (this._isCatalogTarget) {
                    this.addEventListener('load', function () {
                        if (this.status === 200) {
                            try {
                                const response = JSON.parse(this.responseText);
                                const activeMainMenu = document.querySelector('.menu > div.active');
                                const mainMenuContext = activeMainMenu ? cleanInnerText(activeMainMenu) : '课程';
                                const activeSubject = document.querySelector('.folderName.active');
                                const subjectContext = activeSubject ? cleanInnerText(activeSubject) : '未知科目';
                                self.processCatalogData(response, mainMenuContext, subjectContext);
                            } catch (e) {
                                console.error('Search: 目录数据处理失败', e);
                            }
                        }
                    });
                }
                return origSend.apply(this, arguments);
            };
        }

        // 将目录树扁平化为 searchableItems
        processCatalogData(response, mainMenuContext, subjectContext) {
            if (!response || !response.extra || subjectContext === '未知科目') {
                this.searchableItems = [];
                return;
            }
            const flatList = [];

            const mainMenuStep = {selector: "div.menu > div", text: mainMenuContext};
            const subjectStep = {selector: "div.folderName", text: subjectContext};

            const initialPath = [mainMenuStep, subjectStep];

            const flattenTree = (nodes, parentPath) => {
                if (!nodes || nodes.length === 0) return;
                nodes.forEach(node => {
                    const currentSelector = "span.ant-tree-node-content-wrapper";
                    const currentStep = {selector: currentSelector, text: node.catalogName};
                    const replayablePath = [...parentPath, currentStep];
                    const displayPath = replayablePath.slice(1).map(p => p.text).join(' / '); // 不显示最顶层菜单
                    flatList.push({
                        title: node.catalogName, displayPath: displayPath, replayablePath: replayablePath
                    });
                    if (node.childList?.length > 0) {
                        flattenTree(node.childList, replayablePath);
                    }
                });
            };

            flattenTree(response.extra, initialPath);
            this.searchableItems = flatList;
            console.log(`Search Spotlight: loaded ${this.searchableItems.length} items for "${subjectContext}"`);
        }

        closeDrawer() {
            this.drawer?.close();
            this.drawer = null;
        }

        createSearchUI() {
            this.closeDrawer();
            this.drawer = new ItemDrawer(
                'search-drawer',
                'search-spotlight-card',
                (drawer, itemEl) => {
                    drawer.setAttribute('role', 'dialog');
                    drawer.setAttribute('aria-modal', 'true');

                    const inputWrapper = document.createElement('div');
                    inputWrapper.className = 'search-input-wrapper';

                    const iconWrapper = document.createElement('div');
                    iconWrapper.className = 'icon';
                    iconWrapper.innerHTML = ICONS['search-input-icon'];

                    const input = document.createElement('input');
                    input.type = 'text';
                    input.className = 'search-spotlight-input';
                    input.placeholder = '搜索课程目录 (支持拼音或拼音首字母)...';
                    input.autocomplete = 'off';

                    inputWrapper.appendChild(iconWrapper);
                    inputWrapper.appendChild(input);

                    drawer.appendChild(inputWrapper);
                    drawer.appendChild(itemEl);
                    return input;
                });

            const debounced = debounce((q) => {
                if (!this.searchableItems || this.searchableItems.length === 0) {
                    this.drawer.itemEl.innerHTML = `<div class="empty-list">请先点击左侧的科目以加载目录数据。</div>`;
                    return;
                }
                const items = this.searchableItems.filter(item => {
                    try {
                        return PinyinMatch.match(item.title, q);
                    } catch (e) {
                        return item.title && item.title.includes(q);
                    }
                });
                this.drawer.renderList(
                    items.slice(0, this.MAX_DISPLAY),
                    (li, item) => {
                        li.innerHTML = `<span class="item-title">${item.title}</span>
                                        <span class="item-path">${item.displayPath}</span>`;
                        li.addEventListener('click', async () => {
                            const path = item.replayablePath;
                            this.drawer.close();
                            await startReplay(path, true, true);
                        });
                    },
                    `无匹配结果`);
            }, 180);
            this.drawer.keyInputEl.addEventListener('input', () => debounced(this.drawer.keyInputEl.value.trim()));
        }
    }

    class HardRefreshBtn extends NavigationButton {
        constructor() {
            super('hard-refresh-btn', '强制刷新', null);

            // 状态
            this.pressTimer = null;
            this.longPressTriggered = false;
            this.activePointerId = null;

            window.addEventListener('beforeunload', () => {
                savePathForReplay();
                this.button.classList.remove('loading');
                this.button.disabled = false;
            });

            // 点击导航元素自动保存，包括自动回放触发，带防抖
            const debouncedSavePath = debounce(savePathForReplay, 400);
            document.addEventListener('click', (e) => {
                if (e.target.matches('.folderName')){
                    // 移除 URL 中的 catalogId 以避免干扰回放
                    window.location.replace(window.location.href.split('&catalogId')[0]);
                }
                const navContainer = e.target.closest('.menu, .folder');
                if (navContainer) debouncedSavePath();
            }, true);

            // pointer 事件（长按/短按逻辑）
            const downEvent = (e) => {
                if (this.button.classList.contains('loading')) return;
                // 仅对 pointerdown 或回车空格的 keydown 响应，忽略重复按键
                if (e.type === 'pointerdown') {
                    this.activePointerId = e.pointerId;
                    try {
                        this.button.setPointerCapture(this.activePointerId);
                    } catch (err) {
                    }
                } else if (e.type === 'keydown' && ((e.key !== 'Enter' && e.key !== ' ') || e.repeat)) return;
                if (!this.pressTimer) this.pressTimer = setTimeout(() => this.handleLongPress(), HARD_REFRESH_PRESS_MS);
            }
            this.button.addEventListener('pointerdown', downEvent);
            this.button.addEventListener('keydown', downEvent);

            const upEvent = (e) => {
                if (this.button.classList.contains('loading')) {
                    this.clearPressTimer();
                    return;
                }
                if (e.type === 'pointerup') {
                    try {
                        if (this.activePointerId !== null) this.button.releasePointerCapture(this.activePointerId);
                    } catch (err) {
                    }
                }
                if (e.type === 'keyup' && e.key !== 'Enter' && e.key !== ' ') return;
                if (this.longPressTriggered) {
                    this.clearPressTimer();
                    return;
                }
                this.clearPressTimer();
                this.handleShortPress().catch(() => {
                    this.button.classList.remove('loading');
                    this.button.disabled = false;
                });
            }
            this.button.addEventListener('pointerup', upEvent);
            this.button.addEventListener('keyup', upEvent);

            ['pointercancel', 'pointerleave', 'lostpointercapture'].forEach(e => {
                this.button.addEventListener(e, () => {
                    this.clearPressTimer();
                });
            });

            // 阻止浏览器长按弹出的菜单（只对这个按钮）
            this.button.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        }

        clearPressTimer() {
            if (this.pressTimer) {
                clearTimeout(this.pressTimer);
                this.pressTimer = null;
            }
            if (this.activePointerId !== null) {
                try {
                    this.button.releasePointerCapture(this.activePointerId);
                } catch (e) {
                }
                this.activePointerId = null;
            }
            this.longPressTriggered = false;
        }

        onLoginPage() {
        } // 刷新按钮不隐藏

        onAppPage() {
            super.onAppPage();
            setTimeout(this.replaySavedPathIfAny, 300);
        }

        onPageChange() {
        }

        async replaySavedPathIfAny() {
            const pathJSON = await GM_getValue(REPLAY_STORAGE_KEY, null);
            if (!pathJSON || pathJSON === 'null') return;
            const path = JSON.parse(pathJSON);
            // 刷新后回放不自动展开下一步
            await startReplay(path, false);
        }

        async sendLogoutRequest() {
            const url = 'https://bdfz.xnykcxt.com:5002/exam/login/api/logout';
            const TIMEOUT_MS = 5000;

            // fetch with AbortController timeout
            try {
                const controller = new AbortController();
                const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
                const res = await fetch(url, {
                    method: 'GET',
                    credentials: 'include',
                    cache: 'no-cache',
                    headers: {'Accept': 'application/json, text/plain, */*'},
                    signal: controller.signal
                });
                clearTimeout(id);
                return res;
            } catch (e) {
            }
        }

        async nukeAndReload() {
            if (!this.button.classList.contains('loading')) {
                this.button.classList.add('loading');
                this.button.disabled = true;
            }
            try {
                await this.sendLogoutRequest();

                if ('caches' in window) {
                    const keys = await caches.keys();
                    await Promise.all(keys.map(key => caches.delete(key)));
                }

                const localStorageSize = localStorage.length;
                const sessionStorageSize = sessionStorage.length;
                localStorage.clear();
                sessionStorage.clear();
                console.log('已清理 LocalStorage 和 SessionStorage:', localStorageSize, sessionStorageSize);

                const cookies = document.cookie ? document.cookie.split(";") : [];
                for (const cookie of cookies) {
                    const name = cookie.split("=")[0].trim();
                    if (!name) continue;
                    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.xnykcxt.com`;
                    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
                }
            } catch (error) {
                console.error('Hard Refresh 过程中发生错误:', error);
            } finally {
                await sleep(500);
                try {
                    this.button.classList.remove('loading');
                    this.button.disabled = false;
                    window.location.replace("https://bdfz.xnykcxt.com:5002/stu/#/login")
                } catch (e) {
                    try {
                        window.location.reload();
                    } catch (e2) {
                        window.location.replace(window.location.href);
                    }
                }
            }
        }

        async handleShortPress() {
            if (this.button.classList.contains('loading')) return;
            this.button.classList.add('loading');
            this.button.disabled = true;
            try {
                window.location.reload();
            } catch (e) {
                window.location.replace(window.location.href);
            }
        }

        async handleLongPress() {
            if (this.longPressTriggered) return;
            this.longPressTriggered = true;
            try {
                if (!this.button.classList.contains('loading')) {
                    this.button.classList.add('loading');
                    this.button.disabled = true;
                    await sleep(50);
                    this.nukeAndReload().catch(() => {
                        this.button.classList.remove('loading');
                        this.button.disabled = false;
                    });
                }
            } catch (e) {
                this.button.classList.remove('loading');
                this.button.disabled = false;
            } finally {
                this.clearPressTimer();
            }
        }
    }

    const favBtn = new FavBtn();
    const searchBtn = new SearchBtn();
    const hardRefreshBtn = new HardRefreshBtn();

    let oldHref = ""; // 确保首次加载时正确显示

    function checkPageChange() {
        if (!notLogin(oldHref) && notLogin()) {
            favBtn.onAppPage();
            searchBtn.onAppPage();
            hardRefreshBtn.onAppPage();
            console.log("检测到应用页面，显示导航按钮。");
        } else if (notLogin(oldHref) && !notLogin()) {
            favBtn.onLoginPage();
            searchBtn.onLoginPage();
            hardRefreshBtn.onLoginPage();
            nextStepManager.onLoginPage();
            console.log("检测到登录页面，隐藏导航按钮。");
        } else {
            favBtn.onPageChange();
            searchBtn.onPageChange(oldHref, window.location.href);
            hardRefreshBtn.onPageChange();
            nextStepManager.onPageChange();
            console.log("检测到页面变化，执行页面变更处理。");
        }
        oldHref = window.location.href;
    }

    checkPageChange();
    if (notLogin()) hardRefreshBtn.replaySavedPathIfAny();

    window.addEventListener('popstate', checkPageChange);

    // 劫持 pushState/replaceState，触发回放检查
    const originalPushState = history.pushState;
    history.pushState = (...args) => {
        originalPushState.apply(history, args);
        checkPageChange();
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = (...args) => {
        originalReplaceState.apply(history, args);
        checkPageChange();
    };

})();
