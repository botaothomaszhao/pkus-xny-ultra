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
// ==/UserScript==

(function () {
    'use strict';

    // 收藏夹配置
    const FAVORITES_STORAGE_KEY = 'bdfz_path_favorites_v2'; // 想改名，但是不想删已有记录，不改了。。。

    // 收藏夹样式
    GM_addStyle(`
        .fav-btn{
            position:fixed;right:25px;z-index:2147483646;width:48px;height:48px;
            background-color:#fff;border:none;border-radius:50%;
            box-shadow:0 4px 12px rgba(0,0,0,0.15);
            cursor:pointer;display:flex;align-items:center;justify-content:center;
            transition:transform .15s ease,box-shadow .15s ease;
        }
        .fav-btn:hover{transform:scale(1.1);box-shadow:0 8px 20px rgba(0,0,0,0.2)}
        .fav-btn .icon{width:24px;height:24px}
        .fav-btn .icon svg{width:100%;height:100%}
        #add-favorite-btn{bottom:170px}
        #show-favorites-btn{bottom:230px}

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
    `);

    // 通用函数
    function notLogin(url = window.location.href) {
        return !url.includes("/stu/#/login")
    }

    function sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
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
        constructor(className, id, title, html, onclick) {
            this.button = document.createElement('button');
            this.button.className = className;
            this.button.id = id;
            this.button.title = title;
            this.button.innerHTML = html;
            document.body.appendChild(this.button);
            this.button.addEventListener('click', onclick);
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
                'fav-btn',
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
                'fav-btn',
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




    const favBtn = new FavBtn();

})();
