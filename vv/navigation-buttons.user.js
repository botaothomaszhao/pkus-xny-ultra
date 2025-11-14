// ==UserScript==
// @name         快捷导航按钮
// @namespace    https://github.com/botaothomaszhao/pkus-xny-ultra
// @version      vv.2.0
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
    const FAVORITES_STORAGE_KEY = 'bdfz_path_favorites_v2'; // 想改名，但是不想删已有记录，不改了。。。
    const REPLAY_STORAGE_KEY = 'hard_refresh_replay_path';

    // 收藏夹样式
    GM_addStyle(`
        .btn{
            position:fixed;right:25px;z-index:2147483646;width:48px;height:48px;
            background-color:#fff;border:none;border-radius:50%;
            box-shadow:0 4px 12px rgba(0,0,0,0.15);
            cursor:pointer;display:flex;align-items:center;justify-content:center;
            transition:transform .15s ease,box-shadow .15s ease;
        }
        .btn:hover{transform:scale(1.1);box-shadow:0 8px 20px rgba(0,0,0,0.2)}
        .btn .icon{width:24px;height:24px}
        .btn .icon svg{width:100%;height:100%}
        #add-favorite-btn{bottom:170px}
        #show-favorites-btn{bottom:230px}
        #search-btn { bottom: 110px; }
        #hard-refresh-btn { bottom: 50px; }

        .drawer-overlay{
            position:fixed;top:0;left:0;width:100%;height:100%;
            background-color:rgba(0,0,0,0.4);backdrop-filter:blur(4px);
            z-index:2147483647;opacity:0;visibility:hidden;
            transition:opacity .25s ease;
        }
        .drawer-overlay.visible{opacity:1;visibility:visible}

        .bottom-sheet-drawer{
            position:fixed;left:0;right:0;bottom:0;max-height:70%;
            background-color:#f9f9f9;border-top-left-radius:16px;border-top-right-radius:16px;
            box-shadow:0 -4px 20px rgba(0,0,0,0.12);
            transform:translateY(100%);transition:transform .25s ease-out;
            z-index:2147483648;display:flex;flex-direction:column;overflow:hidden;
            outline:none;
        }
        .bottom-sheet-drawer.open{transform:translateY(0)}

        .drawer-header{
            padding:12px 16px;text-align:center;flex-shrink:0;position:relative;background:#f9f9f9;
        }
        .drawer-header::before{
            content:'';position:absolute;top:8px;left:50%;transform:translateX(-50%);
            width:40px;height:4px;background-color:#d1d5db;border-radius:2px;
        }
        .drawer-header h2{margin:12px 0 0;font-size:1.1rem;font-weight:600;color:#111827}

        .drawer-content{padding:0 16px 16px;overflow-y:auto}
        .drawer-content ul{list-style:none;margin:0;padding:0}

        #favorites-drawer .drawer-content li{
            display:flex;align-items:center;gap:8px;
            background:#fff;border-radius:12px;padding:14px 12px 14px 16px;margin-top:12px;
            cursor:pointer;border:1px solid #f0f0f0;
            transition:transform .2s ease,box-shadow .2s ease,background-color .2s ease;
        }
        #favorites-drawer .drawer-content li:hover{
            transform:translateY(-2px) scale(1.01);box-shadow:0 4px 15px rgba(0,0,0,0.08)
        }
        .item-text-content{flex-grow:1;min-width:0}
        .item-title,#next-step-drawer .item-title{
            font-size:1rem;font-weight:500;color:#1f2937;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block
        }
        .item-fullpath{
            font-size:.8rem;color:#6b7280;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block
        }
        .title-edit-input{
            width:100%;border:1px solid #3b82f6;border-radius:6px;padding:2px 4px;font-size:1rem;font-weight:500;color:#1f2937;outline:none;box-shadow:0 0 0 2px rgba(59,130,246,0.2)
        }
        .item-actions{display:flex;align-items:center;flex-shrink:0}
        .action-btn{
            background:none;border:none;color:#9ca3af;cursor:pointer;padding:8px;line-height:1;border-radius:50%;
            display:flex;align-items:center;justify-content:center
        }
        .action-btn:hover{background-color:#f3f4f6;color:#374151}
        .action-btn.delete:hover{color:#ef4444}
        .action-btn .icon{width:20px;height:20px;display:block}

        #next-step-drawer .drawer-content li{
            background:#fff;border-radius:10px;padding:16px;margin-top:10px;cursor:pointer;border:1px solid #f0f0f0;transition:background-color .2s ease
        }
        #next-step-drawer .drawer-content li:hover{background-color:#f3f4f6}

        /* 高亮选择（键盘上下选择） */
        #favorites-drawer .drawer-content li.highlighted { background: #eef2ff; transform: none; box-shadow: none; }

        /* 搜索 Overlay */
        .search-spotlight-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(255,255,255,0.5); backdrop-filter: blur(10px); z-index: 2147483647; opacity: 0; transition: opacity .18s ease; pointer-events: none; }
        .search-spotlight-overlay.visible { opacity: 1; pointer-events: auto; }
        .search-spotlight-card { position: fixed; top: 12vh; left: 50%; transform: translateX(-50%); width: 92%; max-width: 720px; background: #fff; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.12); z-index: 2147483648; overflow: hidden; }
        .search-input-wrapper { display:flex; align-items:center; padding: 12px 16px; border-bottom:1px solid #eee; }
        .search-input-wrapper .icon { width:20px;height:20px;color:#9ca3af;margin-right:10px; display:flex; align-items:center; justify-content:center; }
        .search-spotlight-input { width:100%; height:44px; border: none; outline:none; font-size:16px; background:transparent; color:#111827; }
        .search-results-list { max-height:60vh; overflow-y:auto; list-style:none; margin:0; padding:8px; }
        .search-results-list li { padding:12px 16px; border-radius:8px; cursor:pointer; transition: background-color .12s ease; display:flex; flex-direction:column; }
        .search-results-list li:hover, .search-results-list li.highlighted { background:#f3f4f6; }
        .search-result-title { font-size:0.95rem; color:#111827; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .search-result-path { font-size:0.78rem; color:#6b7280; margin-top:6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .search-empty-state { padding:40px; text-align:center; color:#9ca3af; }
        
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

    /* 用面向对象封装 next-step 抽屉与顶层应用状态，便于后续扩展 */
    class NextStepManager {
        constructor() {
            this.overlay = null;
            this.drawerEl = null;
            this.listEl = null;
        }

        renderList(children) {
            if (!this.listEl) return;
            this.listEl.innerHTML = '';
            children.forEach(childElement => {
                const li = document.createElement('li');
                li.className = 'next-step-item';
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
            // 先关闭已有的
            this.close();

            this.overlay = document.createElement('div');
            this.overlay.className = 'drawer-overlay';

            this.drawerEl = document.createElement('div');
            this.drawerEl.id = 'next-step-drawer';
            this.drawerEl.className = 'bottom-sheet-drawer';
            this.drawerEl.innerHTML = `
                <div class="drawer-header"><h2>可能的下一步</h2></div>
                <div class="drawer-content"><ul id="next-step-list"></ul></div>
            `;
            this.listEl = this.drawerEl.querySelector('#next-step-list');

            document.body.append(this.overlay, this.drawerEl);
            this.overlay.addEventListener('click', () => this.close(), {once: true});

            this.renderList(children);

            requestAnimationFrame(() => {
                this.drawerEl.classList.add('open');
                this.overlay.classList.add('visible');
            });
        }

        close() {
            if (!this.drawerEl && !this.overlay) return;
            this.drawerEl?.classList.remove('open');
            this.overlay?.classList.remove('visible');
            setTimeout(() => {
                this.overlay?.remove();
                this.drawerEl?.remove();
                this.overlay = null;
                this.drawerEl = null;
                this.listEl = null;
            }, 300);
        }

        async checkForNextStep(lastElement) {
            if (!lastElement) return;
            const parentLi = lastElement.closest('li[role="treeitem"]');
            if (!parentLi) {
                console.log("下一步检测：未能找到父级 treeitem 容器。");
                return;
            }
            const childTree = parentLi.querySelector('ul.ant-tree-child-tree');
            if (childTree && childTree.children.length > 0) {
                const childrenWrappers = Array.from(childTree.querySelectorAll(':scope > li > span.ant-tree-node-content-wrapper'));
                if (childrenWrappers.length > 0) {
                    console.log(`下一步检测：找到 ${childrenWrappers.length} 个子节点，准备弹出抽屉。`);
                    this.open(childrenWrappers);
                }
            } else {
                console.log("下一步检测：未找到子节点或子节点列表为空。");
            }
        }
    }

    class NavigationButton {
        constructor(id, title, html, onclick) {
            this.button = document.createElement('button');
            this.button.className = 'btn';
            this.button.id = id;
            this.button.title = title;
            this.button.innerHTML = html;
            document.body.appendChild(this.button);
            if (onclick) this.button.addEventListener('click', onclick);
        }
    }

    class FavBtn {
        constructor() {
            // 实例状态
            this.favoritesDrawer = null;
            this.favoritesOverlay = null;
            this.favoritesList = null;
            this.favoritesCurrentIndex = -1;
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
            // 清理旧的（如果存在）
            this.closeFavoritesDrawer();

            this.favoritesOverlay = document.createElement('div');
            this.favoritesOverlay.className = 'drawer-overlay';

            this.favoritesDrawer = document.createElement('div');
            this.favoritesDrawer.id = 'favorites-drawer';
            this.favoritesDrawer.className = 'bottom-sheet-drawer';
            this.favoritesDrawer.innerHTML = `
                <div class="drawer-header"><h2>路径收藏夹</h2></div>
                <div class="drawer-content"><ul id="favorites-list"></ul></div>
            `;
            this.favoritesDrawer.tabIndex = -1; // 接收键盘事件
            this.favoritesList = this.favoritesDrawer.querySelector('#favorites-list');

            document.body.append(this.favoritesOverlay, this.favoritesDrawer);
            this.favoritesOverlay.addEventListener('click', () => this.closeFavoritesDrawer(), {once: true});

            // Esc 监听：无论是否有条目，都可退出
            const escHandler = (e) => {
                if (e.key === 'Escape' || e.key === 'Esc') {
                    e.preventDefault();
                    this.closeFavoritesDrawer();
                }
            };
            this.favoritesDrawer.addEventListener('keydown', escHandler);

            this.renderFavoritesList();

            requestAnimationFrame(() => {
                this.favoritesDrawer.classList.add('open');
                this.favoritesOverlay.classList.add('visible');
                this.favoritesDrawer.focus({preventScroll: true});
            });

            this.favoritesCurrentIndex = -1;
        }

        closeFavoritesDrawer() {
            if (!this.favoritesDrawer && !this.favoritesOverlay) return;
            this.favoritesDrawer?.classList.remove('open');
            this.favoritesOverlay?.classList.remove('visible');
            this.favoritesCurrentIndex = -1;
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
            this.favoritesCurrentIndex = -1;

            if (favorites.length === 0) {
                this.favoritesList.innerHTML = '<li id="empty-favorites-msg" style="border:none;background:transparent;cursor:default;">您的收藏夹夹是空的<br>点击“+”按钮添加吧</li>';
                // 无条目时取消导航监听，仅保留上层 Esc 监听
                this.favoritesDrawer.onkeydown = null;
                return;
            }

            favorites.forEach((fav, index) => {
                const li = document.createElement('li');
                const fullPath = fav.path.map(p => p.text).join(' / ');
                li.innerHTML = `
                    <div class="item-text-content">
                        <span class="item-title">${fav.title}</span>
                        <span class="item-fullpath">${fullPath}</span>
                    </div>
                    <div class="item-actions">
                        <button class="action-btn edit" title="重命名">
                            <span class="icon">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <path d="M12 20h9" />
                                    <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
                                </svg>
                            </span>
                        </button>
                        <button class="action-btn delete" title="删除">
                            <span class="icon">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <polyline points="3 6 5 6 21 6"/>
                                    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                                    <path d="M10 11v6"/>
                                    <path d="M14 11v6"/>
                                    <path d="M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2"/>
                                </svg>
                            </span>
                        </button>
                    </div>
                `;

                const textContentDiv = li.querySelector('.item-text-content');
                const titleSpan = li.querySelector('.item-title');
                const editBtn = li.querySelector('.edit');
                const deleteBtn = li.querySelector('.delete');

                li.addEventListener('click', async (e) => {
                    if (editBtn.contains(e.target) || deleteBtn.contains(e.target)) return;
                    this.closeFavoritesDrawer();
                    try {
                        const activeFolder = document.querySelector('div.folderName.active');
                        if (activeFolder) activeFolder.click(); // 先点击一次当前科目以将其关闭
                        const lastClickedElement = await replayPath(fav.path);
                        await this.nextStepManager.checkForNextStep(lastClickedElement);
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
                        // 保存后把焦点移回该项
                        highlightFavoritesIndex(index);
                        this.favoritesDrawer.focus({preventScroll: true});
                    };
                    input.addEventListener('blur', saveEdit);
                });

                this.favoritesList.appendChild(li);
            });

            const items = Array.from(this.favoritesList.querySelectorAll('li'));

            const highlightFavoritesIndex = (idx) => {
                if (!items.length) return;
                if (idx < 0) idx = items.length - 1;
                if (idx >= items.length) idx = 0;
                this.favoritesCurrentIndex = idx;
                items.forEach(it => it.classList.remove('highlighted'));
                const el = items[this.favoritesCurrentIndex];
                el.classList.add('highlighted');
                el.scrollIntoView({block: 'nearest', behavior: 'auto'});
            };

            // 导航监听仅在有条目时绑定；用 onkeydown 覆盖旧的，避免重复注册
            this.favoritesDrawer.onkeydown = (e) => {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    highlightFavoritesIndex(this.favoritesCurrentIndex + 1);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    highlightFavoritesIndex(this.favoritesCurrentIndex - 1);
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (this.favoritesCurrentIndex >= 0 && this.favoritesCurrentIndex < items.length) {
                        items[this.favoritesCurrentIndex].click();
                    } else if (items.length > 0) {
                        items[0].click();
                    }
                }
            };

            // 渲染完成后确保焦点仍在抽屉上（便于键盘操作）
            this.favoritesDrawer.focus({preventScroll: true});
        }
    }

    // 替换原有的 class searchBtn ... 的定义为下面的新类（修复 function 在 class 内的错误写法，修复 this 在 super 前使用等问题）
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

            // 启动 XHR 拦截以捕获 catalog/entity 响应
            this.setupXHRInterceptorForCatalog();
        }

        /* -------------------- XHR 拦截：监听 catalog/entity 返回 -------------------- */
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

        /* -------------------- 将目录树扁平化为 searchableItems -------------------- */
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

            overlay.innerHTML = `
                <div class="search-spotlight-card" role="dialog" aria-modal="true">
                    <div class="search-input-wrapper">
                        <svg class="icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="11" cy="11" r="7"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        <input type="text" class="search-spotlight-input" placeholder="搜索课程目录 (支持拼音或拼音首字母)..." autocomplete="off" />
                    </div>
                    <ul class="search-results-list"></ul>
                </div>
            `;
            document.body.appendChild(overlay);

            const input = overlay.querySelector('.search-spotlight-input');
            const resultsList = overlay.querySelector('.search-results-list');
            let currentHighlight = -1;

            const destroySearchUI = () => {
                overlay.classList.remove('visible');
                overlay.addEventListener('transitionend', () => overlay.remove(), {once: true});
            };

            const renderResults = (query) => {
                resultsList.innerHTML = '';
                currentHighlight = -1;
                if (!query) return;
                if (!this.searchableItems || this.searchableItems.length === 0) {
                    resultsList.innerHTML = `<div class="search-empty-state">请先点击左侧的科目以加载目录数据。</div>`;
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
                    resultsList.innerHTML = `<div class="search-empty-state">无匹配结果</div>`;
                    return;
                }
                results.slice(0, this.MAX_DISPLAY).forEach(item => {
                    const li = document.createElement('li');
                    li.innerHTML = `<span class="search-result-title">${item.title}</span><span class="search-result-path">${item.displayPath}</span>`;
                    li.dataset.path = JSON.stringify(item.replayablePath);
                    resultsList.appendChild(li);
                });
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
                    const lastClickedElement = await replayPath(path);
                    await this.nextStepManager.checkForNextStep(lastClickedElement);
                }
            });

            input.addEventListener('keydown', (e) => {
                const items = resultsList.querySelectorAll('li');
                if (e.key === 'Escape' || e.key === 'Esc') {
                    e.preventDefault();
                    destroySearchUI();
                    return;
                }
                if (!items.length) return;

                const setHighlightIndex = (index) => {
                    items.forEach(it => it.classList.remove('highlighted'));
                    currentHighlight = index;
                    if (index < 0) currentHighlight = items.length - 1;
                    if (index >= items.length) currentHighlight = 0;
                    items[currentHighlight].classList.add('highlighted');
                    items[currentHighlight].scrollIntoView({block: 'nearest'});
                };

                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setHighlightIndex(currentHighlight + 1);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setHighlightIndex(currentHighlight - 1);
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (currentHighlight >= 0 && currentHighlight < items.length) {
                        items[currentHighlight].click();
                    } else {
                        // 如果没有高亮，默认点击第一个
                        items[0].click();
                    }
                }
            });

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
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24.0703125" viewBox="0 0 1024 1027"><path fill="currentColor" d="M990 1L856 135q-69-63-157.5-98.5T512 1Q353 1 223.5 90.5T37 323l119 48q43-108 139.5-175T512 129q145 0 254 97L640 353q-1 14 8.5 23.5T672 385h309q14 0 27.5-13.5T1023 344l1-320q1-24-34-23M512 897q-145 0-254-96l126-127q1-14-8.5-23.5T352 641H43q-14 1-27.5 14.5T1 683l-1 320q-1 24 34 23l134-134q69 63 157.5 98t186.5 35q159 0 288.5-89T987 703l-119-47q-43 108-139.5 174.5T512 897"></path></svg>
                </div>`,
                null
            );

            // 状态
            this.LONG_PRESS_MS = 2500;
            this.pressTimer = null;
            this.longPressTriggered = false;
            this.activePointerId = null;
            this.oldHref = window.location.href;

            // 绑定实例方法 this
            /*this.replayIfLogin = this.replayIfLogin.bind(this);
            this.savePathForReplay = this.savePathForReplay.bind(this);
            this.replaySavedPathIfAny = this.replaySavedPathIfAny.bind(this);
            this.sendLogoutRequest = this.sendLogoutRequest.bind(this);
            this.nukeAndReload = this.nukeAndReload.bind(this);
            this.onClickHandler = this.onClickHandler.bind(this);
            this.handleShortPress = this.handleShortPress.bind(this);
            this.clearPressTimer = this.clearPressTimer.bind(this);
            this.triggerLongPress = this.triggerLongPress.bind(this);*/

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

            window.addEventListener('beforeunload', () => this.savePathForReplay());

            document.addEventListener('click', (event) => {
                if (!event.isTrusted) return;
                const navContainer = event.target.closest('.menu, .folder');
                if (navContainer) {
                    setTimeout(this.savePathForReplay, 100);
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

        async savePathForReplay() {
            try {
                if (!notLogin()) return;
                const path = captureCurrentPath();
                // 防止在登录页面触发保存空路径
                if (path) await GM_setValue(REPLAY_STORAGE_KEY, JSON.stringify(path));
            } catch (e) {
                console.warn('保存回放路径失败：', e);
            }
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
                await this.savePathForReplay();
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
                        await this.savePathForReplay();
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
    const searchbtn = new SearchBtn();
    const hardRefreshBtn = new HardRefreshBtn();

})();

