// ==UserScript==
// @name         路径收藏夹
// @namespace    https://github.com/botaothomaszhao/pkus-xny-ultra
// @version      vv.2.4
// @license      GPL-3.0
// @description  课程路径收藏夹，支持保存/回放/编辑/删除路径。
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

    const FAVORITES_STORAGE_KEY = 'bdfz_path_favorites_v2'; // 想改名，但是不想删已有记录，不改了。。。

    // 1. --- CSS样式（保持原观感） ---
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

    // 2. --- 核心功能 (路径捕获、存储、回放逻辑保持稳定) ---
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
        return path.length > 0 ? path : null;
    }

    async function getFavorites() {
        return JSON.parse(await GM_getValue(FAVORITES_STORAGE_KEY, '[]'));
    }

    async function saveFavorites(favorites) {
        await GM_setValue(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
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
                await new Promise(r => setTimeout(r, 100));
            }
            return false;
        }

        for (const step of path) {
            if (!(await click(step.selector, step.text))) {
                throw new Error('Replay failed');
            }
            await new Promise(r => setTimeout(r, 250));
        }
        return lastClickedElement;
    }

    // 3. --- “智能下一步”模块（按需创建/销毁 + 打开动画） ---
    let nextStepDrawer = null, nextStepOverlay = null, nextStepList = null;

    function renderNextStepList(children) {
        if (!nextStepList) return;
        nextStepList.innerHTML = '';
        children.forEach(childElement => {
            const li = document.createElement('li');
            li.innerHTML = `<span class="item-title">${cleanInnerText(childElement)}</span>`;
            li.addEventListener('click', () => {
                childElement.click();
                closeNextStepDrawer();
            });
            nextStepList.appendChild(li);
        });
    }

    function openNextStepDrawer(children) {
        nextStepOverlay = document.createElement('div');
        nextStepOverlay.className = 'drawer-overlay';

        nextStepDrawer = document.createElement('div');
        nextStepDrawer.id = 'next-step-drawer';
        nextStepDrawer.className = 'bottom-sheet-drawer';
        nextStepDrawer.innerHTML = `
            <div class="drawer-header"><h2>可能的下一步</h2></div>
            <div class="drawer-content"><ul id="next-step-list"></ul></div>
        `;
        nextStepList = nextStepDrawer.querySelector('#next-step-list');

        document.body.append(nextStepOverlay, nextStepDrawer);
        nextStepOverlay.addEventListener('click', closeNextStepDrawer, {once: true});

        renderNextStepList(children);

        // 确保初始状态完成渲染后再添加类，确保动画触发
        requestAnimationFrame(() => {
            nextStepDrawer.classList.add('open');
            nextStepOverlay.classList.add('visible');
        });
    }

    function closeNextStepDrawer() {
        if (!nextStepDrawer || !nextStepOverlay) return;
        nextStepDrawer.classList.remove('open');
        nextStepOverlay.classList.remove('visible');
        setTimeout(() => {
            nextStepOverlay?.remove();
            nextStepDrawer?.remove();
            nextStepOverlay = null;
            nextStepDrawer = null;
            nextStepList = null;
        }, 300);
    }

    async function checkForNextStep(lastElement) {
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
                openNextStepDrawer(childrenWrappers);
            }
        } else {
            console.log("下一步检测：未找到子节点或子节点列表为空。");
        }
    }

    // 4. --- 收藏夹模块（按需创建/销毁 + 键盘监听在 render 内部 + Esc 单独监听） ---
    let favoritesDrawer = null, favoritesOverlay = null, favoritesList = null;
    let favoritesCurrentIndex = -1;

    function openFavoritesDrawer() {
        favoritesOverlay = document.createElement('div');
        favoritesOverlay.className = 'drawer-overlay';

        favoritesDrawer = document.createElement('div');
        favoritesDrawer.id = 'favorites-drawer';
        favoritesDrawer.className = 'bottom-sheet-drawer';
        favoritesDrawer.innerHTML = `
            <div class="drawer-header"><h2>路径收藏夹</h2></div>
            <div class="drawer-content"><ul id="favorites-list"></ul></div>
        `;
        favoritesDrawer.tabIndex = -1; // 接收键盘事件
        favoritesList = favoritesDrawer.querySelector('#favorites-list');

        document.body.append(favoritesOverlay, favoritesDrawer);
        favoritesOverlay.addEventListener('click', closeFavoritesDrawer, {once: true});

        // Esc 监听：无论是否有条目，都可退出
        const escHandler = (e) => {
            if (e.key === 'Escape' || e.key === 'Esc') {
                e.preventDefault();
                closeFavoritesDrawer();
            }
        };
        favoritesDrawer.addEventListener('keydown', escHandler);

        renderFavoritesList();

        // 触发动画并聚焦抽屉以接收键盘事件
        requestAnimationFrame(() => {
            favoritesDrawer.classList.add('open');
            favoritesOverlay.classList.add('visible');
            favoritesDrawer.focus({preventScroll: true});
        });

        favoritesCurrentIndex = -1;
    }

    function closeFavoritesDrawer() {
        if (!favoritesDrawer || !favoritesOverlay) return;
        favoritesDrawer.classList.remove('open');
        favoritesOverlay.classList.remove('visible');
        favoritesCurrentIndex = -1;
        setTimeout(() => {
            favoritesOverlay?.remove();
            favoritesDrawer?.remove();
            favoritesOverlay = null;
            favoritesDrawer = null;
            favoritesList = null;
        }, 300);
    }

    async function addCurrentPathToFavorites() {
        const path = captureCurrentPath();
        if (!path || path.length === 0) {
            console.warn('收藏失败: 无法捕获当前路径。');
            return;
        }
        if (path.length < 2 && (document.querySelector('.folderName') || document.querySelector('.ant-tree'))) {
            console.warn('收藏失败: 请先进入一个具体的课程目录。');
            return;
        }
        const favorites = await getFavorites();
        if (favorites.some(fav => JSON.stringify(fav.path) === JSON.stringify(path))) {
            return;
        }
        favorites.push({title: path[path.length - 1].text, path: path});
        await saveFavorites(favorites);
        console.info(`收藏成功：已将“${path[path.length - 1].text}”加入收藏夹。`);
    }

    async function deleteFavorite(index) {
        let f = await getFavorites();
        f.splice(index, 1);
        await saveFavorites(f);
        renderFavoritesList();
    }

    async function renderFavoritesList() {
        if (!favoritesList || !favoritesDrawer) return;

        const favorites = await getFavorites();
        favoritesList.innerHTML = '';
        favoritesCurrentIndex = -1;

        if (favorites.length === 0) {
            favoritesList.innerHTML = '<li id="empty-favorites-msg" style="border:none;background:transparent;cursor:default;">您的收藏夹是空的<br>点击“+”按钮添加吧</li>';
            // 无条目时取消导航监听，仅保留上层 Esc 监听
            favoritesDrawer.onkeydown = null;
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
                closeFavoritesDrawer();
                try {
                    const activeFolder = document.querySelector('div.folderName.active');
                    if (activeFolder) activeFolder.click(); // 先点击一次当前科目以将其关闭
                    const lastClickedElement = await replayPath(fav.path);
                    await checkForNextStep(lastClickedElement);
                } catch (error) {
                    console.error("Replay or next step check failed:", error);
                }
            });

            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteFavorite(index);
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
                        const c = await getFavorites();
                        c[index].title = newTitle;
                        await saveFavorites(c);
                        fav.title = newTitle;
                    }
                    titleSpan.textContent = fav.title;
                    textContentDiv.replaceChild(titleSpan, input);
                    // 保存后把焦点移回该项
                    highlightFavoritesIndex(index);
                    favoritesDrawer.focus({preventScroll: true});
                };
                input.addEventListener('blur', saveEdit);
            });

            favoritesList.appendChild(li);
        });

        const items = Array.from(favoritesList.querySelectorAll('li'));

        function highlightFavoritesIndex(idx) {
            if (!items.length) return;
            if (idx < 0) idx = items.length - 1;
            if (idx >= items.length) idx = 0;
            favoritesCurrentIndex = idx;
            items.forEach(it => it.classList.remove('highlighted'));
            const el = items[favoritesCurrentIndex];
            el.classList.add('highlighted');
            el.scrollIntoView({block: 'nearest', behavior: 'auto'});
        }

        // 导航监听仅在有条目时绑定；用 onkeydown 覆盖旧的，避免重复注册
        favoritesDrawer.onkeydown = (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                highlightFavoritesIndex(favoritesCurrentIndex + 1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                highlightFavoritesIndex(favoritesCurrentIndex - 1);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (favoritesCurrentIndex >= 0 && favoritesCurrentIndex < items.length) {
                    items[favoritesCurrentIndex].click();
                } else if (items.length > 0) {
                    items[0].click();
                }
            }
        };

        // 渲染完成后确保焦点仍在抽屉上（便于键盘操作）
        favoritesDrawer.focus({preventScroll: true});
    }

    // 5. --- 初始化（仅创建两个悬浮按钮；抽屉按需创建/销毁） ---
    function initialize() {
        const addBtn = document.createElement('button');
        addBtn.className = 'fav-btn';
        addBtn.id = 'add-favorite-btn';
        addBtn.title = '收藏当前路径';
        addBtn.innerHTML = `<div class="icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                <line x1="12" y1="8" x2="12" y2="14"></line>
                <line x1="9" y1="11" x2="15" y2="11"></line>
            </svg>
        </div>`;

        const showBtn = document.createElement('button');
        showBtn.className = 'fav-btn';
        showBtn.id = 'show-favorites-btn';
        showBtn.title = '查看收藏夹';
        showBtn.innerHTML = `<div class="icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
            </svg>
        </div>`;

        document.body.append(addBtn, showBtn);
        addBtn.addEventListener('click', addCurrentPathToFavorites);
        showBtn.addEventListener('click', openFavoritesDrawer);
    }

    initialize();

})();
