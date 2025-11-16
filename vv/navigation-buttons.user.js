// ==UserScript==
// @name         快捷导航按钮
// @namespace    https://github.com/botaothomaszhao/pkus-xny-ultra
// @version      vv.2.3
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

    // 收藏夹样式
    GM_addStyle(`
        .nav-btn {
            position: fixed;
            right: 25px;
            z-index: 2147483646;
            width: 48px;
            height: 48px;
            background-color: #fff;
            border: none;
            border-radius: 50%;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform .15s ease, box-shadow .15s ease;
        }
        .nav-btn:hover { transform: scale(1.1); box-shadow: 0 8px 20px rgba(0,0,0,0.2); }
        .nav-btn .icon { width: 24px; height: 24px; }
        .nav-btn .icon svg { width: 100%; height: 100%; }
        #add-favorite-btn { bottom: 170px; }
        #show-favorites-btn { bottom: 230px; }
        #search-btn { bottom: 110px; }
        #hard-refresh-btn { bottom: 50px; }

        .drawer-overlay {
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background-color: rgba(0,0,0,0.4);
            backdrop-filter: blur(4px);
            z-index: 2147483647;
            opacity: 0; visibility: hidden;
            transition: opacity .25s ease;
        }
        .drawer-overlay.visible { opacity: 1; visibility: visible; }

        .bottom-sheet-drawer {
            position: fixed; left: 0; right: 0; bottom: 0; max-height: 70%;
            background-color: #f9f9f9;
            border-top-left-radius: 16px; border-top-right-radius: 16px;
            box-shadow: 0 -4px 20px rgba(0,0,0,0.12);
            transform: translateY(100%);
            transition: transform .25s ease-out;
            z-index: 2147483648;
            display: flex; flex-direction: column; overflow: hidden;
            outline: none;
        }
        .bottom-sheet-drawer.open { transform: translateY(0); }

        .drawer-header { padding: 12px 16px; text-align: center; flex-shrink: 0; position: relative; background: #f9f9f9; }
        .drawer-header::before {
            content: '';
            position: absolute; top: 8px; left: 50%; transform: translateX(-50%);
            width: 40px; height: 4px; background-color: #d1d5db; border-radius: 2px;
        }
        .drawer-header h2 { margin: 12px 0 0; font-size: 1.1rem; font-weight: 600; color: #111827; }

        /* 统一列表项样式 */
        .unified-list {
            max-height:60vh; overflow-y:auto; list-style:none; margin:0; padding:8px;
        }
        .unified-list-item {
            padding:12px 16px; border-radius:8px; cursor:pointer; transition: background-color .12s ease; display:flex; flex-direction:column;
        }
        .unified-list li:hover, .unified-list li.highlighted {
            background:#eef2ff;
        }
        .empty-list { padding:20px; text-align:center; color:#9ca3af; }

        #favorites-drawer .unified-list-item { flex-direction: row; align-items: center; }

        .item-text-content { flex-grow: 1; min-width: 0; display: flex; flex-direction: column; }
        .item-title {
            font-size: 0.95rem;
            font-weight: 500;
            color: #111827;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            display: block;
        }
        .item-path {
            font-size: 0.78rem;
            color: #6b7280;
            margin-top: 6px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            display: block;
        }
        .title-edit-input {
            width: 100%; border: 1px solid #3b82f6; border-radius: 6px; padding: 2px 4px;
            font-size: 0.95rem; font-weight: 500; color: #111827; outline: none;
            box-shadow: 0 0 0 2px rgba(59,130,246,0.2);
        }
        .item-actions { display: flex; align-items: center; flex-shrink: 0; }
        .action-btn { background: none; border: none; color: #9ca3af; cursor: pointer;
            padding: 8px; line-height: 1; border-radius: 50%; display: flex;
            align-items: center; justify-content: center;
        }
        .action-btn:hover { background-color: #f3f4f6; color: #374151; }
        .action-btn.delete:hover { color: #ef4444; }
        .action-btn .icon { width: 20px; height: 20px; display: block; }

        .search-spotlight-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background-color: rgba(255,255,255,0.5); backdrop-filter: blur(10px);
            z-index: 2147483647; opacity: 0; transition: opacity .18s ease; pointer-events: none;
        }
        .search-spotlight-overlay.visible { opacity: 1; pointer-events: auto; }
        .search-spotlight-card {
            position: fixed; top: 12vh; left: 50%; transform: translateX(-50%); width: 92%; max-width: 720px;
            background: #fff; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.12);
            z-index: 2147483648; overflow: hidden;
        }
        .search-input-wrapper { display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid #eee; }
        .search-input-wrapper .icon {
            width: 20px; height: 20px; color: #9ca3af; margin-right: 10px; display: flex;
            align-items: center; justify-content: center;
        }
        .search-spotlight-input {
            width: 100%; height: 44px; border: none; outline: none; font-size: 16px;
            background: transparent; color: #111827;
        }
        .search-empty-state { padding: 40px; text-align: center; color: #9ca3af; }

        /* 刷新按钮 */
        #hard-refresh-btn.loading svg {
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
    `);

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

    // todo: 整合
    function escape(e, close) {
        if (e.key === 'Escape' || e.key === 'Esc') {
            e.preventDefault();
            close();
            return true;
        }
        return false;
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
        const searchContext = activeFolder ? (activeFolder.closest('div.infinite-list-wrapper') || document) : document;
        const selected = searchContext.querySelector('.ant-tree-node-selected');
        const entries = [];

        if (selected) {
            // 从选中节点向上收集属于“展开父节点”或“选中本身”的 span，最后 reverse 为从顶到底
            let li = selected.closest('li[role="treeitem"]');
            while (li) {
                const wrapper = li.querySelector(':scope > span.ant-tree-node-content-wrapper');
                if (wrapper) {
                    if (wrapper.classList.contains('ant-tree-node-content-wrapper-open') || wrapper.classList.contains('ant-tree-node-selected')) {
                        entries.push(wrapper);
                    }
                }
                // 向上寻找包含当前 li 的最近的已展开父 li
                li = li.parentElement ? li.parentElement.closest('li[role="treeitem"].ant-tree-treenode-switcher-open') : null;
            }
            entries.reverse(); // 顶层 -> 目标
        } else return null
        // 映射为存储结构并合并到 path
        for (const el of entries) {
            const text = cleanInnerText(el);
            if (text) path.push({selector: "span.ant-tree-node-content-wrapper", text});
        }
        /*  能正确捕获但无法正确回放
        const slide = document.querySelector("div.swiper-slide.sideActive");
        if (slide){
            path.push({selector: "div.swiper-slide", text: cleanInnerText(slide)});
        }*/
        return path.length > 0 ? path : null;
    }

    async function replayPath(path) {
        let lastClickedElement = null;

        async function click(sel, text) {
            for (let i = 0; i < 50; i++) {
                for (const node of document.querySelectorAll(sel)) {
                    if (cleanInnerText(node) === text) {
                        node.click();
                        lastClickedElement = node;
                        return true;
                    }
                }
                await sleep(100);
            }
            return false;
        }

        for (const step of path) {
            if (!(await click(step.selector, step.text))) {
                throw new Error('Replay failed');
            }
            await sleep(250);
        }
        return lastClickedElement;
    }

    async function savePathForReplay(path = null) {
        try {
            if (!path) {
                if (!notLogin()) return;
                path = captureCurrentPath();
            }
            // 防止在登录页面触发保存空路径
            if (path) await GM_setValue(REPLAY_STORAGE_KEY, JSON.stringify(path));
        } catch (e) {
            console.warn('保存回放路径失败：', e);
        }
    }

    // 统一的键盘导航管理
    class UnifiedKeyboardNav {
        constructor(container, onClose, element) {
            this.onClose = onClose;
            this.currentIndex = -1;
            this.items = Array.from(container.querySelectorAll('.unified-list-item'));
            element.addEventListener('keydown', (e) => this.handleKeydown(e));
            element.addEventListener('keyup', (e) => {
                escape(e, this.onClose);
            });
        }

        handleKeydown(e) {
            if (escape(e, this.onClose)) return;

            if (!this.items.length) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.highlightIndex(this.currentIndex + 1, this.items);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.highlightIndex(this.currentIndex - 1, this.items);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (this.currentIndex >= 0 && this.currentIndex < this.items.length) {
                    this.items[this.currentIndex].click();
                } else if (this.items.length > 0) {
                    this.items[0].click();
                }
            }
        }

        highlightIndex(index) {
            if (!this.items.length) return;

            if (index < 0) index = this.items.length - 1;
            if (index >= this.items.length) index = 0;

            this.currentIndex = index;
            this.items.forEach(it => it.classList.remove('highlighted'));
            this.items[this.currentIndex].classList.add('highlighted');
            this.items[this.currentIndex].scrollIntoView({block: 'nearest', behavior: 'auto'});
        }
    }

    /* 用面向对象封装 next-step 抽屉与顶层应用状态，便于后续扩展 */
    class NextStepManager {
        constructor() {
            this.overlay = null;
            this.drawerEl = null;
            this.listEl = null;
            this.keyboardNav = null;
        }

        renderList(children) {
            if (!this.listEl) return;
            this.listEl.innerHTML = '';
            children.forEach(childElement => {
                const li = document.createElement('li');
                li.className = 'unified-list-item';
                li.innerHTML = `<span class="item-title">${cleanInnerText(childElement)}</span>`;
                li.addEventListener('click', () => {
                    try {
                        childElement.click();
                    } catch (e) {
                        console.error(e);
                    }
                    this.close();
                });
                this.listEl.appendChild(li);
            });
        }

        open(children) {
            this.close();
            this.overlay = document.createElement('div');
            this.overlay.className = 'drawer-overlay';

            this.drawerEl = document.createElement('div');
            this.drawerEl.id = 'next-step-drawer';
            this.drawerEl.className = 'bottom-sheet-drawer';
            this.drawerEl.tabIndex = -1;
            this.drawerEl.innerHTML = `
                <div class="drawer-header"><h2>可能的下一步</h2></div>
                <ul class="unified-list"></ul>
            `;
            this.listEl = this.drawerEl.querySelector('.unified-list');

            document.body.append(this.overlay, this.drawerEl);
            this.overlay.addEventListener('click', () => this.close(), {once: true});

            this.renderList(children);

            this.keyboardNav = new UnifiedKeyboardNav(
                this.listEl,
                () => this.close(),
                this.drawerEl
            );

            requestAnimationFrame(() => {
                this.drawerEl.classList.add('open');
                this.overlay.classList.add('visible');
                this.drawerEl.focus({preventScroll: true});
            });
        }

        close() {
            if (!this.drawerEl && !this.overlay) return;
            this.drawerEl.classList.remove('open');
            this.overlay.classList.remove('visible');
            setTimeout(() => {
                this.overlay.remove();
                this.drawerEl.remove();
                this.overlay = null;
                this.drawerEl = null;
                this.listEl = null;
                savePathForReplay();
            }, 300);
        }

        checkNextStep(lastElement) {
            if (!lastElement) {
                return false;
            }
            const parentLi = lastElement.closest('li[role="treeitem"]');
            if (!parentLi) {
                return false;
            }
            const childTree = parentLi.querySelector('ul.ant-tree-child-tree');
            if (childTree && childTree.children.length > 0) {
                const childrenWrappers = Array.from(childTree.querySelectorAll(':scope > li > span.ant-tree-node-content-wrapper'));
                if (childrenWrappers.length > 0) {
                    this.open(childrenWrappers);
                    return true;
                }
            }
            console.log("下一步检测：未找到子节点或子节点列表为空。");
            return false;
        }

        async replayWithNextStep(path) {
            const lastElement = await replayPath(path);
            if (!this.checkNextStep(lastElement)) {
                await savePathForReplay(path);
            }
        }
    }

    class NavigationButton {
        constructor(id, title, html, onclick) {
            this.button = document.createElement('button');
            this.button.className = 'nav-btn';
            this.button.id = id;
            this.button.title = title;
            this.button.innerHTML = html;
            document.body.appendChild(this.button);
            if (onclick) this.button.addEventListener('click', onclick);
        }
    }

    class FavBtn {
        constructor() {
            this.favoritesDrawer = null;
            this.favoritesOverlay = null;
            this.favoritesList = null;
            this.keyboardNav = null;
            this.nextStepManager = new NextStepManager();

            // 创建按钮，传入绑定的方法引用（避免立即执行）
            this.addBtn = new NavigationButton(
                'add-favorite-btn',
                '添加到收藏夹',
                `<div class="icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                        <line x1="12" y1="8" x2="12" y2="14"></line>
                        <line x1="9" y1="11" x2="15" y2="11"></line>
                    </svg>
                </div>`,
                () => this.addCurrentPathToFavorites()
            );

            this.showBtn = new NavigationButton(
                'show-favorites-btn',
                '显示收藏夹',
                `<div class="icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                    </svg>
                </div>`,
                () => this.openFavoritesDrawer()
            );
        }

        async getFavorites() {
            return JSON.parse(await GM_getValue(FAVORITES_STORAGE_KEY, '[]'));
        }

        async saveFavorites(favorites) {
            await GM_setValue(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
        }

        openFavoritesDrawer() {
            this.closeFavoritesDrawer();

            this.favoritesOverlay = document.createElement('div');
            this.favoritesOverlay.className = 'drawer-overlay';

            this.favoritesDrawer = document.createElement('div');
            this.favoritesDrawer.id = 'favorites-drawer';
            this.favoritesDrawer.className = 'bottom-sheet-drawer';
            this.favoritesDrawer.innerHTML = `
                <div class="drawer-header"><h2>路径收藏夹</h2></div>
                <ul class="unified-list"></ul>
            `;
            this.favoritesDrawer.tabIndex = -1;
            this.favoritesList = this.favoritesDrawer.querySelector('.unified-list');

            document.body.append(this.favoritesOverlay, this.favoritesDrawer);
            this.favoritesOverlay.addEventListener('click', () => this.closeFavoritesDrawer(), {once: true});

            this.renderFavoritesList();

            requestAnimationFrame(() => {
                this.favoritesDrawer.classList.add('open');
                this.favoritesOverlay.classList.add('visible');
                this.favoritesDrawer.focus({preventScroll: true});
            });
        }

        closeFavoritesDrawer() {
            if (!this.favoritesDrawer && !this.favoritesOverlay) return;

            this.favoritesDrawer?.classList.remove('open');
            this.favoritesOverlay?.classList.remove('visible');

            setTimeout(() => {
                this.favoritesOverlay?.remove();
                this.favoritesDrawer?.remove();
                this.favoritesOverlay = null;
                this.favoritesDrawer = null;
                this.favoritesList = null;
            }, 300);
        }

        async addCurrentPathToFavorites() {
            const path = captureCurrentPath();
            if (!path || path.length === 0) {
                console.warn('收藏失败: 无法捕获当前路径。');
                return;
            }
            if (path.length < 2 && (document.querySelector('.folderName') || document.querySelector('.ant-tree'))) {
                console.warn('收藏失败: 请先进入一个具体的课程目录。');
                return;
            }
            const favorites = await this.getFavorites();
            if (favorites.some(fav => JSON.stringify(fav.path) === JSON.stringify(path))) {
                return;
            }
            favorites.push({title: path[path.length - 1].text, path: path});
            await this.saveFavorites(favorites);
            console.info(`收藏成功：已将“${path[path.length - 1].text}”加入收藏夹。`);
        }

        async deleteFavorite(index) {
            let f = await this.getFavorites();
            f.splice(index, 1);
            await this.saveFavorites(f);
            await this.renderFavoritesList();
        }

        async renderFavoritesList() {
            if (!this.favoritesList || !this.favoritesDrawer) return;

            const favorites = await this.getFavorites();
            this.favoritesList.innerHTML = '';

            if (favorites.length === 0) {
                this.favoritesList.innerHTML = `<div class="empty-list">
                                                您的收藏夹夹是空的<br>点击"+"按钮添加吧
                                                </div>`;
                this.favoritesDrawer.addEventListener('keydown', (e) => {
                    escape(e, () => this.closeFavoritesDrawer());
                });
                return;
            }

            favorites.forEach((fav, index) => {
                const li = document.createElement('li');
                li.className = 'unified-list-item';

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
                editBtn.innerHTML = `
                            <span class="icon">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <path d="M12 20h9" />
                                    <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
                                </svg>
                            </span>`;

                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'action-btn delete';
                deleteBtn.title = '删除';
                deleteBtn.innerHTML = `
                            <span class="icon">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <polyline points="3 6 5 6 21 6"/>
                                    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                                    <path d="M10 11v6"/>
                                    <path d="M14 11v6"/>
                                    <path d="M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2"/>
                                </svg>
                            </span>`;

                actionsDiv.appendChild(editBtn);
                actionsDiv.appendChild(deleteBtn);
                li.appendChild(textContentDiv);
                li.appendChild(actionsDiv);

                li.addEventListener('click', async (e) => {
                    if (editBtn.contains(e.target) || deleteBtn.contains(e.target)) return;
                    this.closeFavoritesDrawer();
                    try {
                        const activeFolder = document.querySelector('div.folderName.active');
                        if (activeFolder) activeFolder.click(); // 先点击一次当前科目以将其关闭
                        await this.nextStepManager.replayWithNextStep(fav.path);
                    } catch (error) {
                        console.error("Replay or next step check failed:", error);
                    }
                });

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

                    const saveEdit = async () => {
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
                        if (this.keyboardNav) {
                            this.keyboardNav.highlightIndex(index);
                        }
                        this.favoritesDrawer.focus({preventScroll: true});
                    };
                    input.addEventListener('blur', saveEdit);
                });

                this.favoritesList.appendChild(li);
            });

            // 使用统一的键盘导航类
            this.keyboardNav = new UnifiedKeyboardNav(
                this.favoritesList,
                () => this.closeFavoritesDrawer(),
                this.favoritesDrawer
            );

            this.favoritesDrawer.focus({preventScroll: true});
        }
    }

    class SearchBtn extends NavigationButton {
        constructor() {
            super(
                'search-btn',
                '目录搜索',
                `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="11" cy="11" r="7"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>`,
                () => this.createSearchUI()
            );

            // 实例状态
            this.searchableItems = []; // { title, displayPath, replayablePath }
            this.MAX_DISPLAY = 50;
            this.nextStepManager = new NextStepManager();

            // todo: 切换边栏时刷新
            this.setupXHRInterceptorForCatalog();
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
                } catch (e) { /* ignore */
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

            // 重复 subjectStep 一次以实现先关闭再展开
            const initialPath = [mainMenuStep, subjectStep, subjectStep];

            const flattenTree = (nodes, parentPath) => {
                if (!nodes || nodes.length === 0) return;
                nodes.forEach(node => {
                    const currentSelector = "span.ant-tree-node-content-wrapper";
                    const currentStep = {selector: currentSelector, text: node.catalogName};
                    const replayablePath = [...parentPath, currentStep];
                    const displayPath = replayablePath
                        .slice(1, 2) // 只显示科目
                        .concat(replayablePath.slice(3)) // 后续显示
                        .map(p => p.text).join(' / ');
                    flatList.push({
                        title: node.catalogName, displayPath: displayPath, replayablePath: replayablePath
                    });
                    if (node.childList && node.childList.length > 0) {
                        flattenTree(node.childList, replayablePath);
                    }
                });
            };

            flattenTree(response.extra, initialPath);
            this.searchableItems = flatList;
            console.log(`Search Spotlight: loaded ${this.searchableItems.length} items for "${subjectContext}"`);
        }

        createSearchUI() {
            if (document.getElementById('search-spotlight-overlay')) return;
            const overlay = document.createElement('div');
            overlay.id = 'search-spotlight-overlay';
            overlay.className = 'search-spotlight-overlay';

            const card = document.createElement('div');
            card.className = 'search-spotlight-card';
            card.setAttribute('role', 'dialog');
            card.setAttribute('aria-modal', 'true');

            const inputWrapper = document.createElement('div');
            inputWrapper.className = 'search-input-wrapper';

            const iconWrapper = document.createElement('div');
            iconWrapper.className = 'icon';
            iconWrapper.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="7"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>`;

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'search-spotlight-input';
            input.placeholder = '搜索课程目录 (支持拼音或拼音首字母)...';
            input.autocomplete = 'off';

            inputWrapper.appendChild(iconWrapper);
            inputWrapper.appendChild(input);

            const resultsList = document.createElement('ul');
            resultsList.className = 'unified-list';

            card.appendChild(inputWrapper);
            card.appendChild(resultsList);
            overlay.appendChild(card);
            document.body.appendChild(overlay);

            let searchKeyboardNav = null;

            const destroySearchUI = () => {
                overlay.classList.remove('visible');
                overlay.addEventListener('transitionend', () => overlay.remove(), {once: true});
            };

            const renderResults = (query) => {
                resultsList.innerHTML = '';
                if (!query) return;
                if (!this.searchableItems || this.searchableItems.length === 0) {
                    resultsList.innerHTML = `<div class="empty-list">请先点击左侧的科目以加载目录数据。</div>`;
                    return;
                }
                const results = this.searchableItems.filter(item => {
                    try {
                        return PinyinMatch.match(item.title, query);
                    } catch (e) {
                        return item.title && item.title.includes(query);
                    }
                });
                if (!results || results.length === 0) {
                    resultsList.innerHTML = `<div class="empty-list">无匹配结果</div>`;
                    return;
                }
                results.slice(0, this.MAX_DISPLAY).forEach(item => {
                    const li = document.createElement('li');
                    li.className = 'unified-list-item';
                    li.innerHTML = `<span class="item-title">${item.title}</span>
                                    <span class="item-path">${item.displayPath}</span>`;
                    li.dataset.path = JSON.stringify(item.replayablePath);
                    resultsList.appendChild(li);
                });

                // 重新创建键盘导航
                searchKeyboardNav = new UnifiedKeyboardNav(
                    resultsList,
                    destroySearchUI,
                    input
                );
            };

            const debounced = debounce((q) => renderResults(q), 180);
            input.addEventListener('input', () => debounced(input.value.trim()));

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) destroySearchUI();
            });

            resultsList.addEventListener('click', async (e) => {
                const li = e.target.closest('li');
                if (li && li.dataset.path) {
                    const path = JSON.parse(li.dataset.path);
                    destroySearchUI();
                    await sleep(120);
                    await this.nextStepManager.replayWithNextStep(path);
                }
            });
            input.addEventListener('keydown', (e) => escape(e, destroySearchUI));
            input.addEventListener('keyup', (e) => escape(e, destroySearchUI));

            // 显示并聚焦
            requestAnimationFrame(() => {
                overlay.classList.add('visible');
                input.focus();
                input.select();
            });
        }
    }

    class HardRefreshBtn extends NavigationButton {
        constructor() {
            super(
                'hard-refresh-btn',
                '强制刷新',
                `<div class="icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                        <path fill="currentColor" fill-rule="evenodd" d="M2.93 11.2c.072-4.96 4.146-8.95 9.149-8.95a9.158 9.158 0 0 1 7.814 4.357a.75.75 0 0 1-1.277.786a7.658 7.658 0 0 0-6.537-3.643c-4.185 0-7.575 3.328-7.648 7.448l.4-.397a.75.75 0 0 1 1.057 1.065l-1.68 1.666a.75.75 0 0 1-1.056 0l-1.68-1.666A.75.75 0 1 1 2.528 10.8zm16.856-.733a.75.75 0 0 1 1.055 0l1.686 1.666a.75.75 0 1 1-1.054 1.067l-.41-.405c-.07 4.965-4.161 8.955-9.18 8.955a9.197 9.197 0 0 1-7.842-4.356a.75.75 0 1 1 1.277-.788a7.697 7.697 0 0 0 6.565 3.644c4.206 0 7.61-3.333 7.68-7.453l-.408.403a.75.75 0 1 1-1.055-1.067z" clip-rule="evenodd">
                        </path>
                    </svg>
                </div>`,
                null
            );

            // 状态
            this.LONG_PRESS_MS = 2500;
            this.pressTimer = null;
            this.longPressTriggered = false;
            this.activePointerId = null;
            this.oldHref = window.location.href;

            // pagehide/pageshow 清理按钮 loading 状态
            window.addEventListener('pagehide', () => {
                try {
                    this.button.classList.remove('loading');
                    this.button.disabled = false;
                } catch (e) {
                }
            });
            window.addEventListener('pageshow', () => {
                try {
                    this.button.classList.remove('loading');
                    this.button.disabled = false;
                } catch (e) {
                }
            });

            // 初次页面就绪后尝试回放
            if (document.readyState === 'loading') {
                window.addEventListener('DOMContentLoaded', () => {
                    if (notLogin()) setTimeout(() => this.replaySavedPathIfAny(), 300);
                });
            } else {
                if (notLogin()) setTimeout(() => this.replaySavedPathIfAny(), 300);
            }

            window.addEventListener('popstate', () => this.replayIfLogin());

            // 劫持 pushState/replaceState，触发回放检查
            const originalPushState = history.pushState;
            history.pushState = (...args) => {
                originalPushState.apply(history, args);
                this.replayIfLogin();
            };

            // 拦截 replaceState
            const originalReplaceState = history.replaceState;
            history.replaceState = (...args) => {
                originalReplaceState.apply(history, args);
                this.replayIfLogin();
            };

            window.addEventListener('beforeunload', () => savePathForReplay());

            document.addEventListener('click', (event) => {
                if (!event.isTrusted) return;
                const navContainer = event.target.closest('.menu, .folder');
                if (navContainer) {
                    setTimeout(() => savePathForReplay(), 100);
                }
            }, true);

            // 阻止 click 透传（按钮本身）
            this.button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, {capture: true});

            // pointer 事件（长按/短按逻辑）
            this.button.addEventListener('pointerdown', (e) => {
                if (this.button.classList.contains('loading')) return;
                this.clearPressTimer();
                this.longPressTriggered = false;
                this.activePointerId = e.pointerId;
                try {
                    if (this.button.setPointerCapture) this.button.setPointerCapture(this.activePointerId);
                } catch (err) {
                }
                this.pressTimer = setTimeout(() => this.triggerLongPress(), this.LONG_PRESS_MS);
            }, {passive: true});

            this.button.addEventListener('pointerup', () => {
                if (this.button.classList.contains('loading')) {
                    this.clearPressTimer();
                    return;
                }
                try {
                    if (this.activePointerId !== null && this.button.releasePointerCapture) this.button.releasePointerCapture(this.activePointerId);
                } catch (err) {
                }
                if (this.longPressTriggered) {
                    this.clearPressTimer();
                    this.longPressTriggered = false;
                    return;
                }
                this.clearPressTimer();
                this.handleShortPress().catch(() => {
                    this.button.classList.remove('loading');
                    this.button.disabled = false;
                });
            }, {passive: true});

            ['pointercancel', 'pointerleave', 'lostpointercapture'].forEach(evt => {
                this.button.addEventListener(evt, () => {
                    this.longPressTriggered = false;
                    this.clearPressTimer();
                });
            });
        }

        replayIfLogin() {
            if (!notLogin(this.oldHref) && notLogin()) {
                setTimeout(this.replaySavedPathIfAny, 300);
            }
            this.oldHref = window.location.href;
        }

        async replaySavedPathIfAny() {
            const pathJSON = await GM_getValue(REPLAY_STORAGE_KEY, null);
            if (!pathJSON || pathJSON === 'null') return;
            const path = JSON.parse(pathJSON);
            await replayPath(path);
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
                setTimeout(() => {
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
                }, 500);
            }
        }

        async handleShortPress() {
            if (this.button.classList.contains('loading')) return;
            this.button.classList.add('loading');
            this.button.disabled = true;
            try {
                await savePathForReplay();
            } catch (e) {
            }
            try {
                window.location.reload();
            } catch (e) {
                window.location.replace(window.location.href);
            }
        }

        clearPressTimer() {
            if (this.pressTimer) {
                clearTimeout(this.pressTimer);
                this.pressTimer = null;
            }
            if (this.activePointerId !== null) {
                try {
                    if (this.button.releasePointerCapture) this.button.releasePointerCapture(this.activePointerId);
                } catch (e) {
                }
                this.activePointerId = null;
            }
        }

        async triggerLongPress() {
            if (this.longPressTriggered) return;
            this.longPressTriggered = true;
            try {
                if (!this.button.classList.contains('loading')) {
                    this.button.classList.add('loading');
                    this.button.disabled = true;
                    try {
                        await savePathForReplay();
                    } catch (e) {
                    }
                    setTimeout(() => {
                        this.nukeAndReload().catch(() => {
                            this.button.classList.remove('loading');
                            this.button.disabled = false;
                        });
                    }, 50);
                }
            } catch (e) {
                this.button.classList.remove('loading');
                this.button.disabled = false;
            } finally {
                this.longPressTriggered = false;
                this.clearPressTimer();
            }
        }
    }

    const favBtn = new FavBtn();
    const searchBtn = new SearchBtn();
    const hardRefreshBtn = new HardRefreshBtn();

})();
