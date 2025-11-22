// ==UserScript==
// @name         新能源课程系统增强 - 功能脚本（不含样式）
// @namespace    http://tampermonkey.net/
// @version      2.0-features.4
// @license      MIT
// @description  从 v2/main.js 拆出的完整功能脚本：收藏夹、路径回放、目录搜索、XHR 拦截、手写修复、设置页、Pill 菜单与智能提示等；不包含站点的全局黑白配色与字体样式（这些在 ui-only 脚本中）。
// @author       c-jeremy
// @match        *://bdfz.xnykcxt.com:5002/stu/*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_notification
// @run-at       document-start
// @connect      bdfz.xnykcxt.com
// @require      https://unpkg.com/pinyin-match@1.2.8/dist/main.js
// ==/UserScript==

(function() {
    'use strict';

    /* -------------------- 合并 CSS（pill + 收藏夹抽屉 + 设置 + 提示） -------------------- */
    GM_addStyle(`
        /* ========== Pill 样式（保留你原始的视觉和行为样式） ========== */
        * { margin: 0; padding: 0; box-sizing: border-box; }


         /* [hidden]:not(#errorWrapper), button.hidden, div#editorModeButtons.hidden{display: block !important;}*/

        .pill-container {
            position: fixed;
            bottom: 24px;
            left: 55px;
            background-color: #0a0a0a;
            border-radius: 50px;
            padding: 0;
            display: flex;
            align-items: center;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            cursor: pointer; /* 不可拖，改为 pointer */
            color: #ffffff;
            -webkit-user-select: none;
            user-select: none;
            z-index: 10000;
            will-change: transform, padding;
            transform: translateZ(0);
            backface-visibility: hidden;
            -webkit-font-smoothing: antialiased;
        }

        .pill-container.dragging { cursor: grabbing; transition: none; }
        .pill-container.expanded { padding: 0 12px 0 0; }

        .pill-icon {
            width: 44px;
            height: 44px;
            transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            flex-shrink: 0;
            will-change: transform;
            transform: translateZ(0);
        }
        .pill-container.expanded .pill-icon { transform: rotate(45deg) translateZ(0); }

        .pill-buttons {
            display: flex;
            align-items: center;
            max-width: 0;
            opacity: 0;
            transition: max-width 0.4s cubic-bezier(0.4, 0, 0.2, 1),
                        opacity 0.3s ease,
                        padding-left 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            will-change: max-width, opacity, transform;
            overflow: hidden;
            white-space: nowrap;
            gap: 4px;
            margin-left: 0;
            transform: translateZ(0);
        }
        .pill-container.expanded .pill-buttons, .pill-container.show-suggestion .pill-buttons {
            max-width: 500px;
            opacity: 1;
            margin-left: 8px;
        }
        .pill-container.show-suggestion .pill-buttons {
            padding-left: 70px; /* 为文字“去哪里？”腾出空间 */
        }

        .pill-button {
            background: transparent;
            color: #ffffff;
            border: none;
            padding: 8px;
            border-radius: 50%;
            cursor: pointer;
            transition: background 0.2s ease, display 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
            will-change: background;
            transform: translateZ(0);
        }
        .pill-button:hover { background: rgba(255, 255, 255, 0.15); }

        /* 重启效果 */
        .reboot-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #0a0a0a; opacity: 0; pointer-events: none; z-index: 10001; will-change: opacity; transform: translateZ(0); }
        @keyframes flash-reboot { 0% { opacity: 0; } 15% { opacity: 1; } 30% { opacity: 0; } 45% { opacity: 1; } 100% { opacity: 1; } }
        @keyframes pill-implode { 0% { transform: scale(1) translateZ(0); opacity: 1; } 60% { transform: scale(1.15) translateZ(0); opacity: 1; } 100% { transform: scale(0) translateZ(0); opacity: 0; } }
        @keyframes scanline { 0% { transform: translateY(-100%) translateZ(0); } 100% { transform: translateY(100vh) translateZ(0); } }
        .scanline { position: fixed; top: 0; left: 0; width: 100%; height: 3px; background: linear-gradient(to bottom, transparent, rgba(0, 0, 0, 0.8), transparent); pointer-events: none; z-index: 10002; opacity: 0; will-change: transform, opacity; transform: translateZ(0); }
        .pill-container.animating { will-change: transform, opacity; }

        /* ========== Favorites Drawer & Buttons CSS ========== */
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
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        /* ========== Search Spotlight CSS ========== */
.search-spotlight-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(255, 255, 255, 0.5); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); z-index: 21000; opacity: 0; transition: opacity 0.2s ease-out; }
.search-spotlight-overlay.visible { opacity: 1; }
.search-spotlight-container { position: fixed; top: 15vh; left: 50%; transform: translateX(-50%); width: 90%; max-width: 640px; background-color: #f9f9f9; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); display: flex; flex-direction: column; overflow: hidden; }
.search-input-wrapper { display: flex; align-items: center; padding: 0 16px; border-bottom: 1px solid #eee; }
.search-input-wrapper .icon { color: #9ca3af; width: 20px; height: 20px; margin-right: 12px; }
.search-spotlight-input { width: 100%; height: 56px; border: none; outline: none; background: transparent; font-size: 1.1rem; color: #111827; }
.search-results-list { list-style: none; margin: 0; padding: 8px; max-height: 50vh; overflow-y: auto; }
.search-results-list li { padding: 12px 16px; border-radius: 8px; cursor: pointer; transition: background-color 0.15s ease; }
.search-results-list li:hover, .search-results-list li.highlighted { background-color: #eee; }
.search-result-title { font-size: 0.95rem; color: #1f2937; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
.search-result-path { font-size: 0.75rem; color: #6b7280; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
.search-empty-state { padding: 40px; text-align: center; color: #9ca3af; }

        /* ========== Settings Page CSS ========== */
        .settings-page-container { font-family: 'Noto Serif SC', serif !important; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: #fff; z-index: 20000; padding: 20px; box-sizing: border-box; display: flex; justify-content: center; align-items: flex-start; overflow-y: auto; }
        .settings-page-content { max-width: 700px; width: 100%; margin-top: 5vh; }
        .settings-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #000; padding-bottom: 15px; margin-bottom: 30px; }
        .settings-header h1 { font-size: 2rem; font-weight: 700; margin: 0; }
        .settings-header .close-btn { font-family: 'Noto Serif SC', serif !important; font-size: 1rem; color: #000; background: #eee; border: 1px solid #ccc; border-radius: 8px; padding: 8px 16px; cursor: pointer; transition: background-color 0.2s; }
        .settings-header .close-btn:hover { background-color: #ddd; }
        .setting-item { display: flex; justify-content: space-between; align-items: center; padding: 20px 0; border-bottom: 1px solid #eee; }
        .setting-text h3 { font-size: 1.1rem; font-weight: 500; margin: 0 0 5px 0; }
        .setting-text p { font-size: 0.9rem; color: #666; margin: 0; max-width: 450px; }
        .toggle-switch { position: relative; display: inline-block; width: 50px; height: 28px; flex-shrink: 0; margin-left: 20px; }
        .toggle-switch input { opacity: 0; width: 0; height: 0; }
        .toggle-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 28px; }
        .toggle-slider:before { position: absolute; content: ""; height: 20px; width: 20px; left: 4px; bottom: 4px; background-color: white; transition: .4s; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
        input:checked + .toggle-slider { background-color: #000; }
        input:checked + .toggle-slider:before { transform: translateX(22px); }
        .settings-footer { text-align: justify; margin-top: 40px; padding: 20px; color: #999; font-size: 0.7rem; }
        .settings-footer p { margin: 5px 0; }

        /* ========== Pill Hints CSS ========== */
        .pill-message {
            position: absolute;
            left: 48px; /* 从圆形icon的边缘开始 */
            top: 0;
            height: 100%;
            display: flex;
            align-items: center;
            padding-left: 12px; /* 文字与icon的间距 */
            white-space: nowrap;
            overflow: hidden;
            max-width: 0;
            opacity: 0;
            transition: max-width 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
            will-change: max-width, opacity;
            transform: translateZ(0);
            color: #fff;
            font-size: 14px;
            pointer-events: none; /* 默认让鼠标事件穿透消息背景 */
        }
        .pill-message .message-text {
            pointer-events: auto; /* 恢复文本自身的点击能力 */
        }
        .pill-container.show-message, .pill-container.show-suggestion {
            overflow: visible; /* 允许绝对定位的子元素溢出显示 */
        }
        .pill-container.show-message .pill-message, .pill-container.show-suggestion .pill-message {
            max-width: 500px;
            opacity: 1;
        }
        .pill-message .message-text {
            cursor: pointer;
            padding-right: 16px;
        }
        /* Suggestion state: show only specific buttons and hide others */
        .pill-container.show-suggestion .pill-button {
            display: none;
        }
        .pill-container.show-suggestion .pill-button[title="Bookmarks"],
        .pill-container.show-suggestion .pill-button[title="Reload"] {
            display: flex;
        }
    `);

    /* -------------------- 脚本配置与状态 -------------------- */
    const FAVORITES_STORAGE_KEY = 'bdfz_path_favorites_v2';
    const PATH_STORAGE_KEY = 'bdfz_persistent_path_v3';
    const SETTINGS_STORAGE_KEY = 'bdfz_enhancer_settings_v3';
    const GREETINGS_DONE_KEY = 'bdfz_enhancer_greetings_done_v1';
    let lastKnownPath = null;
    let favoritesDrawer, favoritesOverlay, favoritesList;
    let nextStepDrawer, nextStepOverlay, nextStepList;
    let settings = {}; // 运行时缓存设置
    let searchableItems = []; // 用于存储所有可搜索的目录项

    /* -------------------- 等待 body 准备就绪 -------------------- */
    function waitForBody() {
        return new Promise((resolve) => {
            if (document.body) {
                resolve();
            } else if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => resolve(), { once: true });
            } else {
                // Fallback: poll for body
                const checkBody = setInterval(() => {
                    if (document.body) {
                        clearInterval(checkBody);
                        resolve();
                    }
                }, 50);
            }
        });
    }


    /* -------------------- 收藏夹核心逻辑 (来自旧脚本，未作修改) -------------------- */
    function cleanInnerText(el) { if (!el) return ""; const clone = el.cloneNode(true); clone.querySelectorAll("i, svg, path").forEach(n => n.remove()); return clone.textContent.trim(); }

    function captureCurrentPath() { let path = []; const root = document.querySelector('div.menu > div.active'); if (root) { path.push({ selector: "div.menu > div", text: cleanInnerText(root) }); } const activeFolder = document.querySelector('div.folderName.active'); if (activeFolder) { path.push({ selector: "div.folderName", text: cleanInnerText(activeFolder) }); } const searchContext = activeFolder ? (activeFolder.closest('div.infinite-list-wrapper') || document) : document; const uniqueNodes = new Map(); searchContext.querySelectorAll("span.ant-tree-node-content-wrapper-open, span.ant-tree-node-content-wrapper.ant-tree-node-selected").forEach(node => { const text = cleanInnerText(node); if (text) { uniqueNodes.set(text, { selector: "span.ant-tree-node-content-wrapper", text: text }); } }); path.push(...Array.from(uniqueNodes.values())); return path.length > 0 ? path : null; }

    async function getFavorites() { return JSON.parse(await GM_getValue(FAVORITES_STORAGE_KEY, '[]')); }

    async function saveFavorites(favorites) { await GM_setValue(FAVORITES_STORAGE_KEY, JSON.stringify(favorites)); }

    async function replayPath(path) { let lastClickedElement = null; async function click(sel, txt) { for (let i = 0; i < 50; i++) { for (const node of document.querySelectorAll(sel)) { if (cleanInnerText(node) === txt) { node.click(); lastClickedElement = node; return true; } } await new Promise(r => setTimeout(r, 100)); } return false; } const btn = Array.from(document.querySelectorAll("button span")).find(s => s.innerText.trim() === "开始使用"); if(btn) { btn.click(); await new Promise(r => setTimeout(r, 500)); } for (const step of path) { if (!(await click(step.selector, step.text))) { GM_notification({ title: '导航失败', text: `无法找到 "${step.text}"`, timeout: 5000 }); throw new Error('Replay failed'); } await new Promise(r => setTimeout(r, 250)); } return lastClickedElement; }

    function openNextStepDrawer(children) { renderNextStepList(children); nextStepDrawer.classList.add('open'); nextStepOverlay.classList.add('visible'); }

    function closeNextStepDrawer() { nextStepDrawer.classList.remove('open'); nextStepOverlay.classList.remove('visible'); }

    function renderNextStepList(children) { nextStepList.innerHTML = ''; children.forEach(childElement => { const li = document.createElement('li'); li.innerHTML = `<span class="item-title">${cleanInnerText(childElement)}</span>`; li.addEventListener('click', () => { childElement.click(); closeNextStepDrawer(); }); nextStepList.appendChild(li); }); }

    async function checkForNextStep(lastElement) {
        if (!lastElement) return;
        const parentLi = lastElement.closest('li[role="treeitem"]');
        if (!parentLi) { console.log("下一步检测：未能找到父级 treeitem 容器。"); return; }
        const childTree = parentLi.querySelector('ul.ant-tree-child-tree');
        if (childTree && childTree.children.length > 0) {
            const childrenWrappers = Array.from(childTree.querySelectorAll(':scope > li > span.ant-tree-node-content-wrapper'));
            if (childrenWrappers.length > 0) { console.log(`下一步检测：找到 ${childrenWrappers.length} 个子节点，准备弹出抽屉。`); openNextStepDrawer(childrenWrappers); }
        } else { console.log("下一步检测：未找到子节点或子节点列表为空。"); }
    }

    function openFavoritesDrawer() { renderFavoritesList(); favoritesDrawer.classList.add('open'); favoritesOverlay.classList.add('visible'); }

    function closeFavoritesDrawer() { favoritesDrawer.classList.remove('open'); favoritesOverlay.classList.remove('visible'); }

    async function addCurrentPathToFavorites() { const path = captureCurrentPath(); if (!path || path.length === 0) { GM_notification({ title: '收藏失败', text: '无法捕获当前路径。', timeout: 4000 }); return; } if (path.length < 2 && (document.querySelector('.folderName') || document.querySelector('.ant-tree'))) { GM_notification({ title: '收藏失败', text: '请先进入一个具体的课程目录。', timeout: 4000 }); return; } const favorites = await getFavorites(); if (favorites.some(fav => JSON.stringify(fav.path) === JSON.stringify(path))) { GM_notification({ title: '提示', text: '该路径已在收藏夹中。', timeout: 3000 }); return; } favorites.push({ title: path[path.length - 1].text, path: path }); await saveFavorites(favorites); GM_notification({ title: '收藏成功！', text: `已将“${path[path.length - 1].text}”加入收藏夹。`, timeout: 3000 }); }

    async function deleteFavorite(index) { let f = await getFavorites(); f.splice(index, 1); await saveFavorites(f); renderFavoritesList(); }

    async function renderFavoritesList() { const favorites = await getFavorites(); favoritesList.innerHTML = ''; if (favorites.length === 0) { favoritesList.innerHTML = '<li id="empty-favorites-msg" style="border:none;background:transparent;cursor:default;">您的收藏夹是空的<br>点击“+”按钮添加吧</li>'; return; } favorites.forEach((fav, index) => { const li = document.createElement('li'); const fullPath = fav.path.map(p => p.text).join(' / '); li.innerHTML = `<div class="item-text-content"><span class="item-title">${fav.title}</span><span class="item-fullpath">${fullPath}</span></div><div class="item-actions"><button class="action-btn edit" title="编辑名称"><svg class="icon" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z"></path><path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd"></path></svg></button><button class="action-btn delete" title="删除此收藏"><svg class="icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg></button></div>`; const textContentDiv = li.querySelector('.item-text-content'); const titleSpan = li.querySelector('.item-title'); const editBtn = li.querySelector('.edit'); const deleteBtn = li.querySelector('.delete'); li.addEventListener('click', async (e) => { if (editBtn.contains(e.target) || deleteBtn.contains(e.target)) return; closeFavoritesDrawer(); try { const lastClickedElement = await replayPath(fav.path); await checkForNextStep(lastClickedElement); } catch (error) { console.error("Replay or next step check failed:", error); } }); deleteBtn.addEventListener('click', () => deleteFavorite(index)); editBtn.addEventListener('click', () => { const input = document.createElement('input'); input.type = 'text'; input.className = 'title-edit-input'; input.value = fav.title; textContentDiv.replaceChild(input, titleSpan); input.focus(); input.select(); const saveEdit = async () => { const newTitle = input.value.trim(); if (newTitle && newTitle !== fav.title) { const c = await getFavorites(); c[index].title = newTitle; await saveFavorites(c); fav.title = newTitle; } titleSpan.textContent = fav.title; textContentDiv.replaceChild(titleSpan, input); }; input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); }); input.addEventListener('blur', saveEdit); }); favoritesList.appendChild(li); }); }

    function savePathImmediately(reason = "常规") {
        const path = captureCurrentPath();
        if (path && JSON.stringify(path) !== JSON.stringify(lastKnownPath)) {
            lastKnownPath = path;
            GM_setValue(PATH_STORAGE_KEY, JSON.stringify(path));
            console.log(`💾 路径已保存 (${reason}):`, path);
        }
    }

    function attachGuardianListeners() {
        window.addEventListener('beforeunload', () => savePathImmediately("页面卸载"));
        document.body.addEventListener('click', (event) => {
            const navContainer = event.target.closest('.menu-wrap, .folder-wrap');
            if (navContainer) {
                setTimeout(() => savePathImmediately("点击导航"), 100);
            }
        });
        const leftPanel = document.querySelector('.stu-course-wrap');
        if (leftPanel) { leftPanel.addEventListener('mouseleave', () => savePathImmediately("鼠标离开")); }
        else { const observer = new MutationObserver((mutations, obs) => { const panel = document.querySelector('.stu-course-wrap'); if (panel) { panel.addEventListener('mouseleave', () => savePathImmediately("鼠标离开 (延迟附加)")); obs.disconnect(); } }); observer.observe(document.body, { childList: true, subtree: true }); }
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
// --- 新增：用于修改题目内容以强制显示答案的核心函数 ---
function modifyContentData(data) {
    try {
        if (data && Array.isArray(data.extra)) {
            data.extra.forEach(item => {
                if (item && item.content) {
                    const content = item.content;
                    const keysToEnable = [
                        "previewAnswer", "answerWayHandle", "answerWayPhoto",
                        "answerWayTalking", "answerWayVideo", "answerWayKeyboard",
                        "questionTalkingSwitch"
                    ];
                    keysToEnable.forEach(key => {
                        if (typeof content[key] !== 'undefined') { content[key] = 1; }
                    });
                    if (typeof content.mustDoSwitch !== 'undefined') {
                        content.mustDoSwitch = 0;
                    }
                }
            });
        }
        return data;
    } catch (e) {
        // 在 sandbox 中 console.error 不可见，但保留无害
        console.error('[Content Modifier] Error modifying data:', e);
        return data;
    }
}

/* -------------------- XHR 请求拦截器（注入到页面上下文） -------------------- */
function injectXHRInterceptorToPage(config) {
    const script = document.createElement('script');
    script.textContent = `
(function() {
    const settings = ${JSON.stringify(config)};
    
    // 修改题目内容以强制显示答案
    function modifyContentData(data) {
        try {
            if (data && Array.isArray(data.extra)) {
                data.extra.forEach(item => {
                    if (item && item.content) {
                        const content = item.content;
                        const keysToEnable = [
                            "previewAnswer", "answerWayHandle", "answerWayPhoto",
                            "answerWayTalking", "answerWayVideo", "answerWayKeyboard",
                            "questionTalkingSwitch"
                        ];
                        keysToEnable.forEach(key => {
                            if (typeof content[key] !== 'undefined') { content[key] = 1; }
                        });
                        if (typeof content.mustDoSwitch !== 'undefined') {
                            content.mustDoSwitch = 0;
                        }
                    }
                });
            }
            return data;
        } catch (e) {
            console.error('[Content Modifier] Error modifying data:', e);
            return data;
        }
    }
    
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url) {
        if (typeof url === 'string' && url.endsWith('enchance')) {
            this._isMockTarget = true;
        } else if (typeof url === 'string' && url.includes('catalog/entity')) {
            this._isCatalogTarget = true;
        } else if (url && typeof url === 'string' && url.endsWith('/content')) {
            this._isContentTarget = true;
        }
        originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function() {
        // 1. 处理 Mock 请求
        if (this._isMockTarget && settings.enableMockEnhance) {
            console.log('⚡️ XHR Interceptor: Mocking request to', this.responseURL);
            const mockResponse = { code: 1, message: "新能源ULTRA加速上传中…", time: Date.now(), extra: "" };
            const mockResponseJSON = JSON.stringify(mockResponse);
            Object.defineProperties(this, {
                status: { value: 200, writable: false },
                statusText: { value: 'OK', writable: false },
                response: { value: mockResponseJSON, writable: false },
                responseText: { value: mockResponseJSON, writable: false },
                readyState: { value: 4, writable: false }
            });
            this.dispatchEvent(new Event('readystatechange'));
            this.dispatchEvent(new ProgressEvent('load'));
            this.dispatchEvent(new ProgressEvent('loadend'));
            return;
        }

        // 2. 处理"强制答案"请求
        if (this._isContentTarget && settings.enableAnswerForce) {
            const originalDescriptorText = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'responseText');
            const originalDescriptorResponse = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'response');

            Object.defineProperty(this, 'responseText', {
                get: function() {
                    const realResponseText = originalDescriptorText.get.call(this);
                    try {
                        const data = JSON.parse(realResponseText);
                        const modifiedData = modifyContentData(data);
                        return JSON.stringify(modifiedData);
                    } catch (e) { return realResponseText; }
                },
                configurable: true
            });

            Object.defineProperty(this, 'response', {
                get: function() {
                    const realResponse = originalDescriptorResponse.get.call(this);
                    try {
                        const data = (typeof realResponse === 'string') ? JSON.parse(realResponse) : realResponse;
                        return modifyContentData(data);
                    } catch (e) { return realResponse; }
                },
                configurable: true
            });
        }

        // 3. 处理"搜索目录"请求 - 发送自定义事件给用户脚本
        if (this._isCatalogTarget) {
            this.addEventListener('load', function() {
                if (this.status === 200) {
                    window.dispatchEvent(new CustomEvent('xnyultra-catalog-loaded', {
                        detail: { responseText: this.responseText }
                    }));
                }
            });
        }

        // 4. 最终总是调用原始的 send 方法
        originalSend.apply(this, arguments);
    };
})();
`;
    (document.head || document.documentElement).appendChild(script);
    script.remove();
}

// 在用户脚本上下文中监听目录加载事件
function setupCatalogEventListener() {
    window.addEventListener('xnyultra-catalog-loaded', (e) => {
        try {
            const response = JSON.parse(e.detail.responseText);
            const activeMainMenu = document.querySelector('.menu > div.active');
            const mainMenuContext = activeMainMenu ? cleanInnerText(activeMainMenu) : '课程';
            const activeSubject = document.querySelector('.folderName.active');
            const subjectContext = activeSubject ? cleanInnerText(activeSubject) : '未知科目';
            processCatalogData(response, mainMenuContext, subjectContext);
        } catch (err) {
            console.error('目录数据处理失败:', err);
        }
    });
}

function processCatalogData(response, mainMenuContext, subjectContext) {
    if (!response || !response.extra || subjectContext === '未知科目') {
        searchableItems = [];
        return;
    }

    const flatList = [];

    // 步骤1：构建正确的、包含双击逻辑的初始路径
    const mainMenuStep = { selector: "div.menu > div", text: mainMenuContext };
    const subjectStep = { selector: "div.folderName", text: subjectContext };

    // 关键：将科目/教师步骤重复一次，以实现“双击”效果
    const initialPath = [mainMenuStep, subjectStep, subjectStep];

    function flattenTree(nodes, parentPath) {
        if (!nodes || nodes.length === 0) return;

        nodes.forEach(node => {
            // 步骤2：修正选择器逻辑
            // 根据您的分析，JSON 数据中的所有层级都对应 antd 树节点
            const currentSelector = "span.ant-tree-node-content-wrapper";

            const currentStep = { selector: currentSelector, text: node.catalogName };
            const replayablePath = [...parentPath, currentStep];
            const displayPath = replayablePath.slice(1, 2) // 只显示科目
                .concat(replayablePath.slice(3)) // 和后续路径
                .map(p => p.text).join(' / ');

            flatList.push({
                title: node.catalogName,
                displayPath: displayPath,
                replayablePath: replayablePath
            });

            if (node.childList && node.childList.length > 0) {
                flattenTree(node.childList, replayablePath);
            }
        });
    }

    flattenTree(response.extra, initialPath);
    searchableItems = flatList;
    console.log(`🔍 已为科目“${subjectContext}”处理 ${searchableItems.length} 个可搜索项。`); // 此 console.log 在 sandbox 中不可见，但保留无害
}

function createSearchUI() {
    // 防止重复创建
    if (document.getElementById('search-spotlight-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'search-spotlight-overlay';
    overlay.className = 'search-spotlight-overlay';

    const containerHTML = `
        <div class="search-spotlight-container">
            <div class="search-input-wrapper">
                <svg class="icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <input type="text" class="search-spotlight-input" placeholder="搜索课程目录 (支持拼音或拼音首字母)...">
            </div>
            <ul class="search-results-list"></ul>
        </div>
    `;
    overlay.innerHTML = containerHTML;
    document.body.appendChild(overlay);

    const input = overlay.querySelector('.search-spotlight-input');
    const resultsList = overlay.querySelector('.search-results-list');
    let currentHighlight = -1;

    // 销毁函数
    function destroySearchUI(callback) { // 增加一个 callback 参数
    overlay.classList.remove('visible');
    setTimeout(() => {
        overlay.remove();
        if (typeof callback === 'function') {
            callback(); // 在移除后执行回调
        }
    }, 200);
    }

    // 渲染结果函数
    function renderResults(query) {
        resultsList.innerHTML = '';
        currentHighlight = -1;

        if (!query) return;
        if (searchableItems.length === 0) {
             resultsList.innerHTML = '<div class="search-empty-state">请先点击一个科目以加载目录数据。</div>';
             return;
        }

        const results = searchableItems.filter(item => PinyinMatch.match(item.title, query));

        if (results.length === 0) {
            resultsList.innerHTML = '<div class="search-empty-state">无匹配结果</div>';
        } else {
            results.slice(0, 50).forEach(item => { // 最多显示50条结果
                const li = document.createElement('li');
                li.innerHTML = `<span class="search-result-title">${item.title}</span><span class="search-result-path">${item.displayPath}</span>`;
                li.dataset.path = JSON.stringify(item.replayablePath);
                resultsList.appendChild(li);
            });
        }
    }

    // 事件处理
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) destroySearchUI();
    });

    resultsList.addEventListener('click', (e) => {
    const targetLi = e.target.closest('li');
    if (targetLi && targetLi.dataset.path) {
        const path = JSON.parse(targetLi.dataset.path);
        // 将导航操作作为回调函数传递进去
        destroySearchUI(() => {
            replayPath(path).catch(err => console.error("Search navigation failed:", err));
        });
    }
});

    const debouncedSearch = debounce(renderResults, 200);
    input.addEventListener('input', () => debouncedSearch(input.value.trim()));

    // 键盘导航
    input.addEventListener('keydown', e => {
        const items = resultsList.querySelectorAll('li');
        if (!items.length) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (currentHighlight < items.length - 1) {
                currentHighlight++;
                items.forEach(item => item.classList.remove('highlighted'));
                items[currentHighlight].classList.add('highlighted');
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (currentHighlight > 0) {
                currentHighlight--;
                items.forEach(item => item.classList.remove('highlighted'));
                items[currentHighlight].classList.add('highlighted');
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const highlightedItem = resultsList.querySelector('li.highlighted');
            if (highlightedItem) {
                highlightedItem.click();
            } else if (items.length > 0) {
                items[0].click(); // 默认选择第一项
            }
        } else if (e.key === 'Escape') {
             destroySearchUI();
        }
    });

    // 动画入场并聚焦
    requestAnimationFrame(() => {
        overlay.classList.add('visible');
        input.focus();
    });
}
    /* -------------------- 设置管理 -------------------- */
    async function getSettings() {
        const defaults = {
            autoLogin: true,
            enableHandwritingFix: true,
            forceShowPDFButtons: true,
            enableSmartHints: true,
            enableMockEnhance: false,
            enableAnswerForce: false,
            autoExpandAnswerArea: true,
        };
        const saved = JSON.parse(await GM_getValue(SETTINGS_STORAGE_KEY, '{}'));
        return { ...defaults, ...saved };
    }

    async function saveSettings(newSettings) {
        await GM_setValue(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
        settings = newSettings;
    }

    /* THIS FUNCTION IS DEPRECATED.
    function updateConditionalStyles(currentSettings) {
        let styleEl = document.getElementById('tampermonkey-conditional-styles');
        if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = 'tampermonkey-conditional-styles'; document.head.appendChild(styleEl); }
        let cssText = '';
        if (currentSettings.forceShowPDFButtons) { cssText += `[hidden]:not(#errorWrapper), button.hidden, div#editorModeButtons.hidden { display: block !important; }`; }
        styleEl.textContent = cssText;
    }*/

    function initializePdfIframeObserver() {
    const forceShowPDFButtonsCSS = '[hidden]:not(#errorWrapper), button.hidden, div#editorModeButtons.hidden { display: block !important; }';

    function injectFix(iframe) {
        // 再次确认设置是否开启，并确保iframe内容可访问
        if (settings.forceShowPDFButtons && iframe.contentDocument) {
            const styleId = 'tampermonkey-pdf-button-fix';
            // 如果样式已注入，则不再重复操作
            if (iframe.contentDocument.getElementById(styleId)) return;

            const style = iframe.contentDocument.createElement('style');
            style.id = styleId;
            style.textContent = forceShowPDFButtonsCSS;
            iframe.contentDocument.head.appendChild(style);
        }
    }

    // 创建一个MutationObserver来监听iframe的动态添加
    const observer = new MutationObserver(mutations => {
        for (const mutation of mutations) {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) { // 确保是元素节点
                    if (node.tagName === 'IFRAME') {
                        node.addEventListener('load', () => injectFix(node));
                    }
                    // 检查新添加的节点内部是否包含iframe
                    node.querySelectorAll('iframe').forEach(iframe => {
                        iframe.addEventListener('load', () => injectFix(iframe));
                    });
                }
            });
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // 为脚本运行时页面上已经存在的iframe注入样式
    document.querySelectorAll('iframe').forEach(iframe => {
        if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
            injectFix(iframe);
        } else {
            iframe.addEventListener('load', () => injectFix(iframe));
        }
    });
    }



function initializeAnswerAreaObserver() {
    // 1. 检查总开关
    if (!settings.autoExpandAnswerArea) {
        return;
    }

    let sentinelObserver = null;
    let buttonObserver = null;


    // 2. 核心功能：检查并点击按钮（保持不变）
    function checkAndClickButtons() {
        const buttons = document.querySelectorAll('button.ant-btn');
        buttons.forEach(btn => {
            if (btn.innerText.trim().endsWith('答题区') && !btn.classList.contains('ant-btn-primary')) {
                btn.click();
            }
        });
    }

    // 3. 启动/停止核心功能的函数（保持不变）
    function startFeature() {
        if (buttonObserver) return;
        checkAndClickButtons();
        buttonObserver = new MutationObserver(checkAndClickButtons);
        buttonObserver.observe(document.body, { childList: true, subtree: true });

    }

    function stopFeature() {
        if (buttonObserver) {
            buttonObserver.disconnect();
            buttonObserver = null;
        }

    }

    // 4. 新的、更精准的“哨兵”设置函数
    function setupSentinel(contentElement) {
        // 如果已存在哨兵，先断开，以防重复
        if (sentinelObserver) {
            sentinelObserver.disconnect();
        }

        // 创建哨兵，它的任务现在是观察 .content 内部
        sentinelObserver = new MutationObserver(() => {
            if (contentElement.querySelector('.top')) {
                startFeature();
            } else {
                stopFeature();
            }
        });

        // 启动哨兵
        sentinelObserver.observe(contentElement, { childList: true, subtree: true });

        // 立即检查一次初始状态
        if (contentElement.querySelector('.top')) {
            startFeature();
        } else {
            stopFeature();
        }
    }

    // 5. 创建一个“容器”观察者，它的唯一任务是寻找 .content 元素
    const containerObserver = new MutationObserver(() => {
        const contentEl = document.querySelector('div.content');
        if (contentEl) {
            // 找到 .content 后，为它设置哨兵
            setupSentinel(contentEl);
            // 任务完成，断开这个容器观察者，因为它是一次性的
            containerObserver.disconnect();
        }
    });

    // 6. 启动流程
    const initialContentEl = document.querySelector('div.content');
    if (initialContentEl) {
        // 如果 .content 已存在，直接设置哨兵
        setupSentinel(initialContentEl);
    } else {
        // 如果不存在，则启动“容器”观察者去等待它出现
        containerObserver.observe(document.body, { childList: true, subtree: true });
    }
}

    /* -------------------- 设置页面逻辑 -------------------- */
    let settingsPage = null;

    function createSettingsPage() {
        if (settingsPage) return;
        settingsPage = document.createElement('div');
        settingsPage.className = 'settings-page-container';
        const content = `
            <div class="settings-page-content">
                <div class="settings-header"><h1>插件设置</h1><button class="close-btn">返回</button></div>
                <div id="settings-list"></div>
                <div class="settings-footer">
                    <p style="color:black">Note: 修改设置后需手动刷新页面方可生效。</p>
                    <p>This software is developed under the joint effort of @c-jeremy, Aaron Tang ("ts"), and @ZhongChuTaFei.</p>
                    <p>Special credits given to Gemini 2.5 Pro & Claude 4.5 Sonnet.</p>
                    <p>Special thanks to Geeker LStar, who although never contributed to this project, played a vital role in making this all possible.</p>
                </div>
            </div>`;
        settingsPage.innerHTML = content;
        document.body.appendChild(settingsPage);

        const settingsList = settingsPage.querySelector('#settings-list');
        const settingDefs = {
            autoLogin: { title: '自动登录', desc: '在登录页面自动点击“开始使用”，跳过手动操作。' },
            enableHandwritingFix: { title: '手写优化', desc: '防止在平板或手机上手写时，因误触导致页面滚动或刷新。' },
            forceShowPDFButtons: { title: '强制下载', desc: '确保PDF阅读器中的下载、打印等按钮始终可见。<br>开启则表示你愿意为所有下载行为负责，并且已经解除了下列开发者对你下载行为的责任。' },
            enableSmartHints: { title: '智能提示', desc: '在您可能需要时（如首次使用、长时间停留），主动提示相关功能。' },
            enableMockEnhance: { title: '图片极速上传', desc: '拦截增强图片请求，从而使上传图片用时减少80%以上。' },
            enableAnswerForce: { title: '强制显示答案', desc: '自动修改题目数据，强制显示“查看答案”等通常被隐藏的按钮。<br>开启即表示你完全对你的行为负责。' },
            autoExpandAnswerArea: { title: '自动展开答题区', desc: '在题目页面自动点击“显示答题区”按钮，免去手动操作。' }
        };

        for (const key in settingDefs) {
            const def = settingDefs[key];
            const item = document.createElement('div');
            item.className = 'setting-item';
            item.innerHTML = `<div class="setting-text"><h3>${def.title}</h3><p>${def.desc}</p></div><label class="toggle-switch"><input type="checkbox" id="setting-${key}" ${settings[key] ? 'checked' : ''}><span class="toggle-slider"></span></label>`;
            settingsList.appendChild(item);
            item.querySelector(`#setting-${key}`).addEventListener('change', async function() {
                const newSettings = await getSettings();
                newSettings[key] = this.checked;
                await saveSettings(newSettings);
                if (typeof updateConditionalStyles === 'function') { updateConditionalStyles(newSettings); }
                GM_notification({ title: '设置已保存', text: `“${def.title}”已${this.checked ? '开启' : '关闭'}。`, timeout: 2000 });
            });
        }
        settingsPage.querySelector('.close-btn').addEventListener('click', () => { window.history.back(); });
    }

    function destroySettingsPage() {
        if (settingsPage) { settingsPage.remove(); settingsPage = null; }
        const appElement = document.querySelector('.app');
        if (appElement) appElement.style.display = '';
    }

    function handleHashChange() {
        if (window.location.hash === '#/settings/plugin') {
            const appElement = document.querySelector('.app');
            if (appElement) appElement.style.display = 'none';
            createSettingsPage();
        } else { destroySettingsPage(); }
    }

    function setupSettingsListener() {
        window.addEventListener('hashchange', handleHashChange);
        handleHashChange();
    }

    /* -------------------- DOM 注入与功能初始化 -------------------- */
    function injectPillAndDrawers() {
        if (!document.getElementById('rebootOverlay')) { const rebootOverlay = document.createElement('div'); rebootOverlay.className = 'reboot-overlay'; rebootOverlay.id = 'rebootOverlay'; document.documentElement.appendChild(rebootOverlay); }
        if (!document.getElementById('scanline')) { const scanline = document.createElement('div'); scanline.className = 'scanline'; scanline.id = 'scanline'; document.documentElement.appendChild(scanline); }
        if (!document.getElementById('pillMenu')) {
            const pillHTML = `
                <div class="pill-container" id="pillMenu" role="button" aria-label="Pill Menu">
                    <div class="pill-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    </div>
                    <div class="pill-message"><span class="message-text"></span></div>
                    <div class="pill-buttons" id="pillButtons">
                        <button class="pill-button" title="Bookmarks" aria-label="Bookmarks"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg></button>
                        <button class="pill-button" title="Add to Bookmarks" aria-label="Add to Bookmarks"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path><line x1="12" y1="7" x2="12" y2="13"></line><line x1="9" y1="10" x2="15" y2="10"></line></svg></button>
                        <button class="pill-button" title="Search" aria-label="Search"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg></button>
                        <button class="pill-button" title="Reload" aria-label="Reload"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"></path></svg></button>
                        <button class="pill-button" title="Settings" aria-label="Settings"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg></button>
                    </div>
                </div>`;
            const wrapper = document.createElement('div');
            wrapper.innerHTML = pillHTML;
            document.body.appendChild(wrapper.firstElementChild);
        }
        (function initializeDrawers() { if (document.getElementById('favorites-drawer')) return; favoritesOverlay = document.createElement('div'); favoritesOverlay.className = 'drawer-overlay'; favoritesDrawer = document.createElement('div'); favoritesDrawer.id = 'favorites-drawer'; favoritesDrawer.className = 'bottom-sheet-drawer'; favoritesDrawer.innerHTML = `<div class="drawer-header"><h2>收藏夹</h2></div><div class="drawer-content"><ul></ul></div>`; favoritesList = favoritesDrawer.querySelector('.drawer-content ul'); nextStepOverlay = document.createElement('div'); nextStepOverlay.className = 'drawer-overlay'; nextStepDrawer = document.createElement('div'); nextStepDrawer.id = 'next-step-drawer'; nextStepDrawer.className = 'bottom-sheet-drawer'; nextStepDrawer.innerHTML = `<div class="drawer-header"><h2>下一步…</h2></div><div class="drawer-content"><ul></ul></div>`; nextStepList = nextStepDrawer.querySelector('.drawer-content ul'); document.body.append(favoritesOverlay, favoritesDrawer, nextStepOverlay, nextStepDrawer); favoritesOverlay.addEventListener('click', closeFavoritesDrawer); nextStepOverlay.addEventListener('click', closeNextStepDrawer); })();
    }
// 新的双击处理函数，替换 setupMenuLongPress

function setupMenuDoubleClick() {

    // 依然使用事件委托，以处理动态加载的 .menu 元素

    document.body.addEventListener('dblclick', (event) => {

        // 检查双击事件是否起源于 .menu 内部

        const menuElement = event.target.closest('.slider');

        if (menuElement) {

            // 关键：阻止双击的默认行为（例如，选择文本）

            event.preventDefault();

            event.stopPropagation(); // 阻止事件进一步冒泡

            // 呼出搜索栏

            createSearchUI();

        }

    });

}
    function setupPillBehavior() {
        const pillMenu = document.getElementById('pillMenu');
        if (!pillMenu) return;
        const rebootOverlay = document.getElementById('rebootOverlay'), scanline = document.getElementById('scanline');
        const bookmarksBtn = pillMenu.querySelector('button[title="Bookmarks"]'), addBookmarkBtn = pillMenu.querySelector('button[title="Add to Bookmarks"]'), reloadBtn = pillMenu.querySelector('button[title="Reload"]'), settingsBtn = pillMenu.querySelector('button[title="Settings"]');
        const searchBtn = pillMenu.querySelector('button[title="Search"]');
        if (bookmarksBtn) { bookmarksBtn.addEventListener('click', (e) => { e.stopPropagation(); openFavoritesDrawer(); }); }
        if (searchBtn) { searchBtn.addEventListener('click', (e) => { e.stopPropagation(); createSearchUI(); }); }
        if (addBookmarkBtn) { const originalAddIconHTML = addBookmarkBtn.innerHTML; const checkmarkSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`; addBookmarkBtn.addEventListener('click', (e) => { e.stopPropagation(); addCurrentPathToFavorites(); addBookmarkBtn.innerHTML = checkmarkSVG; setTimeout(() => { addBookmarkBtn.innerHTML = originalAddIconHTML; }, 1000); }); }
        if (reloadBtn) { const originalReloadIconHTML = reloadBtn.innerHTML; const loadingIconHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite;"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"></path></svg>`; reloadBtn.addEventListener('click', async (e) => { e.stopPropagation(); if (reloadBtn.disabled) return; reloadBtn.disabled = true; reloadBtn.innerHTML = loadingIconHTML; try { const pathJSON = await GM_getValue(PATH_STORAGE_KEY, null); if (!pathJSON || pathJSON === 'null') { GM_notification({ title: '提示', text: '尚未记录任何路径可供回放。', timeout: 3000 }); return; } const path = JSON.parse(pathJSON); await replayPath(path); } catch (error) { console.error('路径回放失败:', error); } finally { reloadBtn.disabled = false; reloadBtn.innerHTML = originalReloadIconHTML; } }); }
        if (settingsBtn) { settingsBtn.addEventListener('click', (e) => { e.stopPropagation(); window.location.hash = '#/settings/plugin'; }); }
        let singleClickTimer = null, isAnimating = false;
        function performLogoutRequest() { return new Promise((resolve) => { GM_xmlhttpRequest({ method: 'GET', url: 'https://bdfz.xnykcxt.com:5002/exam/login/api/logout', headers: { 'Accept': 'application/json, text/plain, */*', 'Cache-Control': 'no-cache' }, timeout: 5000, onload: (response) => { console.log('登出请求完成'); resolve(response); }, onerror: (error) => { console.warn('登出请求失败'); resolve(error); }, ontimeout: () => { console.warn('登出请求超时'); resolve(); } }); }); }
        function initiateReboot() { isAnimating = true; pillMenu.classList.add('animating'); requestAnimationFrame(() => { pillMenu.style.animation = 'pill-implode 0.5s cubic-bezier(0.4, 0, 1, 1) forwards'; }); setTimeout(() => { requestAnimationFrame(() => { if (rebootOverlay) { rebootOverlay.style.animation = 'flash-reboot 0.8s ease-out forwards'; } setTimeout(() => { requestAnimationFrame(() => { if (scanline) { scanline.style.opacity = '1'; scanline.style.animation = 'scanline 0.6s ease-in forwards'; } }); }, 400); }); }, 300); setTimeout(() => { try { pillMenu.style.animation = ''; if (rebootOverlay) rebootOverlay.style.animation = ''; if (scanline) scanline.style.animation = ''; } catch (e) {} window.location.reload(); }, 900); }
        function handleClick(e) {
            if (isAnimating || e.target.closest('.pill-button') || e.target.closest('.message-text')) return;
            if (pillMenu.classList.contains('show-message') || pillMenu.classList.contains('show-suggestion')) {
                hidePillMessage();
            }
            clearTimeout(singleClickTimer);
            singleClickTimer = setTimeout(() => { requestAnimationFrame(() => pillMenu.classList.toggle('expanded')); }, 200);
        }
        pillMenu.addEventListener('click', handleClick);
        pillMenu.addEventListener('dblclick', async (e) => { e.stopPropagation(); e.preventDefault(); if (isAnimating || e.target.closest('.pill-button')) return; clearTimeout(singleClickTimer); try { await performLogoutRequest(); } catch (err) { console.warn('logout request failed:', err); } finally { initiateReboot(); } }, { passive: false });
        ['mousedown', 'touchstart', 'touchend', 'touchmove'].forEach(evt => { pillMenu.addEventListener(evt, (ev) => { ev.stopPropagation(); }, { passive: false }); });
        pillMenu.tabIndex = 0;
        pillMenu.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); pillMenu.classList.toggle('expanded'); } else if ((e.key === 'Enter' && (e.ctrlKey || e.metaKey)) || e.key === 'F5') { e.preventDefault(); (async () => { if (isAnimating) return; await performLogoutRequest().catch(()=>{}); initiateReboot(); })(); } });
        window.addEventListener('load', () => { setTimeout(() => { if (!pillMenu.classList.contains('expanded')) { pillMenu.style.willChange = 'auto'; } }, 1000); });
    }

    /* -------------------- 智能提示逻辑 -------------------- */
    let hintDismissTimer = null;
    let idleCheckTimer = null;
    function hidePillMessage() {
        clearTimeout(hintDismissTimer);
        const pillMenu = document.getElementById('pillMenu');
        if (pillMenu) {
            pillMenu.classList.remove('show-message', 'show-suggestion');
            const msgEl = pillMenu.querySelector('.message-text');
            if (msgEl) msgEl.innerHTML = '';
        }
    }
    async function setupSmartHints() {
        const pillMenu = document.getElementById('pillMenu');
        if (!pillMenu) return;
        const msgTextEl = pillMenu.querySelector('.message-text');
        const showPillMessage = ({ text, duration = 0, isSuggestion = false }) => {
            hidePillMessage();
            msgTextEl.innerHTML = text;
            pillMenu.classList.add(isSuggestion ? 'show-suggestion' : 'show-message');
            if (duration > 0) {
                hintDismissTimer = setTimeout(hidePillMessage, duration);
            }
        };
        const handleGreeting = async () => {
            const greetingsDone = await GM_getValue(GREETINGS_DONE_KEY, false);
            if (!greetingsDone) {
                setTimeout(() => {
                    msgTextEl.onclick = () => { window.open('https://github.com/Jeremy-Cai/BDFZ-XNY', '_blank'); hidePillMessage(); };
                    showPillMessage({ text: '初次见面，请多关照', duration: 8000 });
                    GM_setValue(GREETINGS_DONE_KEY, true);
                }, 1500);
            }
        };
        const idleCheck = async () => {
            clearTimeout(idleCheckTimer);
            idleCheckTimer = setTimeout(async () => {
                const pillMenu = document.getElementById('pillMenu');
// 如果Pill菜单不存在，或当前正在显示首次问候，则直接退出，不执行闲置检查
if (!pillMenu || pillMenu.classList.contains('show-message')) {
    return;
}

const path = captureCurrentPath();
                const isAtRoot = !path || path.length < 2;
                const pathExists = await GM_getValue(PATH_STORAGE_KEY, null);
                const reloadBtn = pillMenu.querySelector('button[title="Reload"]');
                if (reloadBtn) reloadBtn.style.display = pathExists ? '' : 'none';
                if (isAtRoot && !document.getElementById('favorites-drawer')?.classList.contains('open')) {
                    showPillMessage({ text: '去哪里？', duration: 8000, isSuggestion: true });
                }
            }, 2000);
        };
        window.addEventListener('load', () => {
            handleGreeting();
            idleCheck();
        });
        document.body.addEventListener('click', (event) => {
            if (event.target.closest('.menu, .folder, .ant-tree-treenode, .drawer-overlay')) {
                setTimeout(idleCheck, 500);
            }
        }, true);
    }


    function setupMenuIndicator() {
        const initialObserver = new MutationObserver((mutations, obs) => { const menu = document.querySelector('.menu'); if (menu) { setupSlidingIndicator(menu); obs.disconnect(); } });
        initialObserver.observe(document.body, { childList: true, subtree: true });
        function setupSlidingIndicator(menu) { if (menu.querySelector('.menu-active-indicator')) return; const indicator = document.createElement('div'); indicator.className = 'menu-active-indicator'; menu.prepend(indicator); const updateIndicator = () => { const activeElement = menu.querySelector('div.active'); if (activeElement) { indicator.style.top = `${activeElement.offsetTop}px`; indicator.style.height = `${activeElement.offsetHeight}px`; indicator.style.opacity = '1'; } else { indicator.style.opacity = '0'; } }; setTimeout(updateIndicator, 150); const menuObserver = new MutationObserver(() => updateIndicator()); menuObserver.observe(menu, { attributes: true, attributeFilter: ['class'], subtree: true }); window.addEventListener('resize', updateIndicator); }
    }

    function setupAutoLogin() {
        window.addEventListener('load', function() {
            if (location.pathname === '/stu/' && location.hash === '#/login') {
                var loginButton = document.querySelector('.ant-btn-lg');
                if (loginButton && loginButton.innerText.trim() === "开始使用") { console.log('找到了登录按钮，正在尝试点击...'); setTimeout(function() { loginButton.click(); }, 750); }
                else { console.log('未找到指定的登录按钮。'); }
            } else { console.log('当前不是登录页，不执行自动登录。'); }
        });
    }

    function initializeHandwritingFixObserver() {
        const containerSelector = 'body', canvasSelector = '.board.answerCanvas', fixedAttribute = 'data-tampermonkey-fixed';
        function applyFix(element) { if (element.hasAttribute(fixedAttribute)) { return; } element.addEventListener('touchmove', function(event) { event.preventDefault(); event.stopPropagation(); }, { passive: false }); element.style.overscrollBehaviorY = 'contain'; element.setAttribute(fixedAttribute, 'true'); }
        const container = document.querySelector(containerSelector);
        if (!container) { setTimeout(initializeHandwritingFixObserver, 500); return; }
        const observer = new MutationObserver(function(mutations) { for (const mutation of mutations) { if (mutation.addedNodes.length > 0) { mutation.addedNodes.forEach(node => { if (node.nodeType === 1) { if (node.matches(canvasSelector)) { applyFix(node); } node.querySelectorAll(canvasSelector).forEach(applyFix); } }); } } });
        observer.observe(container, { childList: true, subtree: true });
        document.querySelectorAll(canvasSelector).forEach(applyFix);
    }

    /* -------------------- 脚本主入口 -------------------- */
    (async function main() {
        settings = await getSettings();

        // 注入 XHR 拦截器到页面上下文（越早越好）
        injectXHRInterceptorToPage(settings);
        setupCatalogEventListener();

        // 等待 body 准备就绪后再执行 DOM 操作
        await waitForBody();


        // DEPRECATED: updateConditionalStyles(settings);
        injectPillAndDrawers();
        setupPillBehavior();
        setupMenuIndicator();
        attachGuardianListeners();
        initializePdfIframeObserver();
        initializeAnswerAreaObserver();
        setupMenuDoubleClick();

        if (settings.autoLogin) { setupAutoLogin(); }
        if (settings.enableHandwritingFix) { initializeHandwritingFixObserver(); }
        if (settings.enableSmartHints) { setupSmartHints(); }

        setupSettingsListener();
    })();

})();
