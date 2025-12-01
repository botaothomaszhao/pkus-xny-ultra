// ==UserScript==

// @name         路径收藏夹

// @namespace    http://tampermonkey.net/

// @version      3.2

// @description  【重要】修复了“智能下一步”抽屉不弹出的致命bug。根据用户提供的DOM结构，修正了对父节点的选择器，确保功能恢复正常。

// @author       CJeremy

// @match        https://bdfz.xnykcxt.com:5002/*

// @grant        GM_setValue

// @grant        GM_getValue

// @grant        GM_addStyle

// @grant        GM_notification

// @run-at       document-body

// ==/UserScript==

(function() {

    'use strict';

    const FAVORITES_STORAGE_KEY = 'bdfz_path_favorites_v2'; // 使用在 v3.1 中引入的、安全的新键

    // 1. --- CSS样式 (无变化) ---

    GM_addStyle(`/* ... CSS样式与上一版完全相同 ... */

        .fav-btn { position: fixed; right: 25px; z-index: 2147483646; width: 48px; height: 48px; background-color: #ffffff; border: none; border-radius: 50%; box-shadow: 0 4px 12px rgba(0,0,0,0.15); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); color: #333; }

        .fav-btn:hover { transform: scale(1.1); box-shadow: 0 8px 20px rgba(0,0,0,0.2); }

        .fav-btn .icon { width: 24px; height: 24px; } .fav-btn .icon svg { width: 100%; height: 100%; }

        #add-favorite-btn { bottom: 170px; } #show-favorites-btn { bottom: 230px; }

        .drawer-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.4); backdrop-filter: blur(4px); z-index: 2147483647; opacity: 0; visibility: hidden; transition: opacity 0.3s ease, visibility 0.3s; }

        .drawer-overlay.visible { opacity: 1; visibility: visible; }

        .bottom-sheet-drawer { position: fixed; left: 0; bottom: 0; right: 0; max-height: 70%; background-color: #f9f9f9; border-top-left-radius: 16px; border-top-right-radius: 16px; box-shadow: 0 -4px 20px rgba(0,0,0,0.1); z-index: 2147483647; transform: translateY(100%); transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1); display: flex; flex-direction: column; }

        .bottom-sheet-drawer.open { transform: translateY(0); }

        .drawer-header { padding: 12px 16px; text-align: center; flex-shrink: 0; position: relative; }

        .drawer-header::before { content: ''; position: absolute; top: 8px; left: 50%; transform: translateX(-50%); width: 40px; height: 4px; background-color: #d1d5db; border-radius: 2px; }

        .drawer-header h2 { margin: 12px 0 0; font-size: 1.1rem; font-weight: 600; color: #111827; }

        .drawer-content { padding: 0 16px 16px; overflow-y: auto; } .drawer-content ul { list-style: none; margin: 0; padding: 0; }

        #favorites-drawer .drawer-content li { background-color: #fff; border-radius: 12px; padding: 14px 12px 14px 16px; margin-top: 12px; cursor: pointer; border: 1px solid #f0f0f0; transition: transform 0.2s ease, box-shadow 0.2s ease; display: flex; align-items: center; justify-content: space-between; gap: 8px; }

        #favorites-drawer .drawer-content li:hover { transform: translateY(-2px) scale(1.01); box-shadow: 0 4px 15px rgba(0,0,0,0.08); }

        .item-text-content { flex-grow: 1; min-width: 0; }

        .item-title, #next-step-drawer .item-title { font-size: 1rem; font-weight: 500; color: #1f2937; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }

        .item-fullpath { font-size: 0.8rem; color: #6b7280; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }

        .title-edit-input { width: 100%; border: 1px solid #3b82f6; border-radius: 6px; padding: 2px 4px; font-size: 1rem; font-weight: 500; color: #1f2937; outline: none; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2); }

        .item-actions { display: flex; align-items: center; flex-shrink: 0; }

        .action-btn { background: none; border: none; color: #9ca3af; cursor: pointer; padding: 8px; line-height: 1; border-radius: 50%; }

        .action-btn:hover { background-color: #f3f4f6; color: #374151; } .action-btn.delete:hover { color: #ef4444; }

        .action-btn .icon { width: 20px; height: 20px; display: block; }

        #next-step-drawer .drawer-content li { background-color: #fff; border-radius: 10px; padding: 16px; margin-top: 10px; cursor: pointer; border: 1px solid #f0f0f0; transition: background-color 0.2s ease; }

        #next-step-drawer .drawer-content li:hover { background-color: #f3f4f6; }

    `);

    // 2. --- 核心功能 (路径捕获、存储、回放逻辑保持稳定) ---

    // ... 这些函数已经过验证，无需改动 ...

    function cleanInnerText(el) { if (!el) return ""; const clone = el.cloneNode(true); clone.querySelectorAll("i, svg, path").forEach(n => n.remove()); return clone.textContent.trim(); }

    function captureCurrentPath() { let path = []; const root = document.querySelector('div.menu > div.active'); if (root) { path.push({ selector: "div.menu > div", text: cleanInnerText(root) }); } const activeFolder = document.querySelector('div.folderName.active'); if (activeFolder) { path.push({ selector: "div.folderName", text: cleanInnerText(activeFolder) }); } const searchContext = activeFolder ? (activeFolder.closest('div.infinite-list-wrapper') || document) : document; const uniqueNodes = new Map(); searchContext.querySelectorAll("span.ant-tree-node-content-wrapper-open, span.ant-tree-node-content-wrapper.ant-tree-node-selected").forEach(node => { const text = cleanInnerText(node); if (text) { uniqueNodes.set(text, { selector: "span.ant-tree-node-content-wrapper", text: text }); } }); path.push(...Array.from(uniqueNodes.values())); return path.length > 0 ? path : null; }

    async function getFavorites() { return JSON.parse(await GM_getValue(FAVORITES_STORAGE_KEY, '[]')); }

    async function saveFavorites(favorites) { await GM_setValue(FAVORITES_STORAGE_KEY, JSON.stringify(favorites)); }

    async function replayPath(path) { let lastClickedElement = null; async function click(sel, txt) { for (let i = 0; i < 50; i++) { for (const node of document.querySelectorAll(sel)) { if (cleanInnerText(node) === txt) { node.click(); lastClickedElement = node; return true; } } await new Promise(r => setTimeout(r, 100)); } return false; } const btn = Array.from(document.querySelectorAll("button span")).find(s => s.innerText.trim() === "开始使用"); if(btn) { btn.click(); await new Promise(r => setTimeout(r, 500)); } for (const step of path) { if (!(await click(step.selector, step.text))) { GM_notification({ title: '导航失败', text: `无法找到 "${step.text}"`, timeout: 5000 }); throw new Error('Replay failed'); } await new Promise(r => setTimeout(r, 250)); } return lastClickedElement; }

    // 3. --- “智能下一步”模块 (已修复) ---

    let nextStepDrawer, nextStepOverlay, nextStepList;

    function openNextStepDrawer(children) { renderNextStepList(children); nextStepDrawer.classList.add('open'); nextStepOverlay.classList.add('visible'); }

    function closeNextStepDrawer() { nextStepDrawer.classList.remove('open'); nextStepOverlay.classList.remove('visible'); }

    function renderNextStepList(children) { nextStepList.innerHTML = ''; children.forEach(childElement => { const li = document.createElement('li'); li.innerHTML = `<span class="item-title">${cleanInnerText(childElement)}</span>`; li.addEventListener('click', () => { childElement.click(); closeNextStepDrawer(); }); nextStepList.appendChild(li); }); }

    /**

     * 检查并触发“下一步”的核心函数 (已修复)

     */

    async function checkForNextStep(lastElement) {

        if (!lastElement) return;

        // --- 核心修复 ---

        // 使用更可靠的 role 属性来定位父级 <li> 容器

        const parentLi = lastElement.closest('li[role="treeitem"]');

        if (!parentLi) {

            console.log("下一步检测：未能找到父级 treeitem 容器。");

            return;

        }

        // 后续逻辑保持不变，因为一旦找到正确的父级，它就能正常工作

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

    // 4. --- UI 交互与渲染 (收藏夹部分无变化) ---

    // ... 所有收藏夹的功能函数 (open/close/add/delete/render) 保持稳定 ...

    let favoritesDrawer, favoritesOverlay, favoritesList;

    function openFavoritesDrawer() { renderFavoritesList(); favoritesDrawer.classList.add('open'); favoritesOverlay.classList.add('visible'); }

    function closeFavoritesDrawer() { favoritesDrawer.classList.remove('open'); favoritesOverlay.classList.remove('visible'); }

    async function addCurrentPathToFavorites() { const path = captureCurrentPath(); if (!path || path.length === 0) { GM_notification({ title: '收藏失败', text: '无法捕获当前路径。', timeout: 4000 }); return; } if (path.length < 2 && (document.querySelector('.folderName') || document.querySelector('.ant-tree'))) { GM_notification({ title: '收藏失败', text: '请先进入一个具体的课程目录。', timeout: 4000 }); return; } const favorites = await getFavorites(); if (favorites.some(fav => JSON.stringify(fav.path) === JSON.stringify(path))) { GM_notification({ title: '提示', text: '该路径已在收藏夹中。', timeout: 3000 }); return; } favorites.push({ title: path[path.length - 1].text, path: path }); await saveFavorites(favorites); GM_notification({ title: '收藏成功！', text: `已将“${path[path.length - 1].text}”加入收藏夹。`, timeout: 3000 }); }

    async function deleteFavorite(index) { let f = await getFavorites(); f.splice(index, 1); await saveFavorites(f); renderFavoritesList(); }

    async function renderFavoritesList() { const favorites = await getFavorites(); favoritesList.innerHTML = ''; if (favorites.length === 0) { favoritesList.innerHTML = '<li id="empty-favorites-msg" style="border:none;background:transparent;cursor:default;">您的收藏夹是空的<br>点击“+”按钮添加吧</li>'; return; } favorites.forEach((fav, index) => { const li = document.createElement('li'); const fullPath = fav.path.map(p => p.text).join(' / '); li.innerHTML = `<div class="item-text-content"><span class="item-title">${fav.title}</span><span class="item-fullpath">${fullPath}</span></div><div class="item-actions"><button class="action-btn edit" title="编辑名称"><svg class="icon" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z"></path><path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd"></path></svg></button><button class="action-btn delete" title="删除此收藏"><svg class="icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg></button></div>`; const textContentDiv = li.querySelector('.item-text-content'); const titleSpan = li.querySelector('.item-title'); const editBtn = li.querySelector('.edit'); const deleteBtn = li.querySelector('.delete'); li.addEventListener('click', async (e) => { if (editBtn.contains(e.target) || deleteBtn.contains(e.target)) return; closeFavoritesDrawer(); try { const lastClickedElement = await replayPath(fav.path); await checkForNextStep(lastClickedElement); } catch (error) { console.error("Replay or next step check failed:", error); } }); deleteBtn.addEventListener('click', () => deleteFavorite(index)); editBtn.addEventListener('click', () => { const input = document.createElement('input'); input.type = 'text'; input.className = 'title-edit-input'; input.value = fav.title; textContentDiv.replaceChild(input, titleSpan); input.focus(); input.select(); const saveEdit = async () => { const newTitle = input.value.trim(); if (newTitle && newTitle !== fav.title) { const c = await getFavorites(); c[index].title = newTitle; await saveFavorites(c); fav.title = newTitle; } titleSpan.textContent = fav.title; textContentDiv.replaceChild(titleSpan, input); }; input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); }); input.addEventListener('blur', saveEdit); }); favoritesList.appendChild(li); }); }

    // 5. --- 初始化UI (无变化) ---

    function initialize() {

        const addBtn = document.createElement('button'); addBtn.className = 'fav-btn'; addBtn.id = 'add-favorite-btn'; addBtn.title = '收藏当前路径'; addBtn.innerHTML = `<div class="icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg></div>`;

        const showBtn = document.createElement('button'); showBtn.className = 'fav-btn'; showBtn.id = 'show-favorites-btn'; showBtn.title = '查看收藏夹'; showBtn.innerHTML = `<div class="icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></div>`;

        favoritesOverlay = document.createElement('div'); favoritesOverlay.className = 'drawer-overlay'; favoritesDrawer = document.createElement('div'); favoritesDrawer.id = 'favorites-drawer'; favoritesDrawer.className = 'bottom-sheet-drawer'; favoritesDrawer.innerHTML = `<div class="drawer-header"><h2>收藏夹</h2></div><div class="drawer-content"><ul></ul></div>`; favoritesList = favoritesDrawer.querySelector('.drawer-content ul');

        nextStepOverlay = document.createElement('div'); nextStepOverlay.className = 'drawer-overlay'; nextStepDrawer = document.createElement('div'); nextStepDrawer.id = 'next-step-drawer'; nextStepDrawer.className = 'bottom-sheet-drawer'; nextStepDrawer.innerHTML = `<div class="drawer-header"><h2>下一步…</h2></div><div class="drawer-content"><ul></ul></div>`; nextStepList = nextStepDrawer.querySelector('.drawer-content ul');

        document.body.append(addBtn, showBtn, favoritesOverlay, favoritesDrawer, nextStepOverlay, nextStepDrawer);

        addBtn.addEventListener('click', addCurrentPathToFavorites); showBtn.addEventListener('click', openFavoritesDrawer); favoritesOverlay.addEventListener('click', closeFavoritesDrawer); nextStepOverlay.addEventListener('click', closeNextStepDrawer);

    }

    initialize();

})();