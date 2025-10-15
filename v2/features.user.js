// ==UserScript==
// @name         新能源课程系统增强 - 功能脚本（不含样式）
// @namespace    http://tampermonkey.net/
// @version      2.0-features
// @license      MIT
// @description  包含 v2/main.js 中的所有功能逻辑（收藏夹、回放、搜索、xhr 拦截、手写修复、设置页面、Pill 菜单等），但不包含大块的 UI 样式（已拆到 ui-only 脚本）。保留原始的 @run-at 与 @require 配置以便最小改动兼容性。
// @author       c-jeremy
// @match        *://bdfz.xnykcxt.com:5002/stu/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_notification
// @grant        GM_addStyle
// @run-at       document-start
// @require      https://unpkg.com/pinyin-match@1.2.8/dist/main.js
// ==/UserScript==

(function() {
    'use strict';

    // Lightweight implementation of updateConditionalStyles so v2/main.js won't throw if it calls it.
    function updateConditionalStyles(currentSettings) {
        try {
            var id = 'tampermonkey-conditional-styles';
            var styleEl = document.getElementById(id);
            if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.id = id;
                document.head && document.head.appendChild(styleEl);
            }
            var cssText = '';
            if (currentSettings && currentSettings.forceShowPDFButtons) {
                cssText = '[hidden]:not(#errorWrapper), button.hidden, div#editorModeButtons.hidden { display: block !important; }';
            }
            styleEl.textContent = cssText;
        } catch (e) {
            // silent
        }
    }

    // Expose to globals to maximize chance main.js can call it
    try { if (typeof globalThis !== 'undefined') globalThis.updateConditionalStyles = updateConditionalStyles; } catch (e) {}
    try { if (typeof window !== 'undefined') window.updateConditionalStyles = updateConditionalStyles; } catch (e) {}
    try { if (typeof self !== 'undefined') self.updateConditionalStyles = updateConditionalStyles; } catch (e) {}
    try { if (typeof unsafeWindow !== 'undefined') unsafeWindow.updateConditionalStyles = updateConditionalStyles; } catch (e) {}

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

    /* -------------------- 收藏夹核心逻辑 (来自旧脚本，未作修改) -------------------- */
    function cleanInnerText(el) { if (!el) return ""; const clone = el.cloneNode(true); clone.querySelectorAll("i, svg, path").forEach(n => n.remove()); return clone.textContent.trim(); }

    function captureCurrentPath() { let path = []; const root = document.querySelector('div.menu > div.active'); if (root) { path.push({ selector: "div.menu > div", text: cleanInnerText(root) }); }
        const activeFolder = document.querySelector('div.folderName.active');
        if (activeFolder) {
            path.push({ selector: "div.folderName", text: cleanInnerText(activeFolder) });
            const searchContext = activeFolder.closest('div.infinite-list-wrapper') || document;
            const uniqueNodes = new Map();
            const nodes = Array.from(searchContext.querySelectorAll('li[role="treeitem"] span.ant-tree-node-content-wrapper'));
            nodes.forEach(node => {
                const text = cleanInnerText(node);
                if (!uniqueNodes.has(text)) { uniqueNodes.set(text, node); }
            });
            // 找到第一个高亮或选中项
            const selected = Array.from(uniqueNodes.values()).find(n => n.closest('li')?.classList.contains('ant-tree-treenode-selected'));
            if (selected) {
                path.push({ selector: 'span.ant-tree-node-content-wrapper', text: cleanInnerText(selected) });
            }
        }
        return path;
    }

    async function getFavorites() { return JSON.parse(await GM_getValue(FAVORITES_STORAGE_KEY, '[]')); }

    async function saveFavorites(favorites) { await GM_setValue(FAVORITES_STORAGE_KEY, JSON.stringify(favorites)); }

    async function replayPath(path) { let lastClickedElement = null; async function click(sel, txt) { for (let i = 0; i < 50; i++) { for (const node of document.querySelectorAll(sel)) { if (cleanInnerText(node) === txt) { node.click(); await new Promise(r => setTimeout(r, 80)); lastClickedElement = node; return; } } await new Promise(r => setTimeout(r, 80)); } throw new Error('无法找到匹配节点: '+txt); }
        for (const step of path) { await click(step.selector, step.text); }
        await checkForNextStep(lastClickedElement);
    }

    function openNextStepDrawer(children) { renderNextStepList(children); nextStepDrawer.classList.add('open'); nextStepOverlay.classList.add('visible'); }

    function closeNextStepDrawer() { nextStepDrawer.classList.remove('open'); nextStepOverlay.classList.remove('visible'); }

    async function addCurrentPathToFavorites() { const path = captureCurrentPath(); if (!path || path.length === 0) { GM_notification({ title: '收藏失败', text: '无法捕获当前路径。', timeout: 3000 }); return; } const fav = await getFavorites(); fav.unshift({ title: path.map(p => p.text).join(' / '), path }); await saveFavorites(fav); renderFavoritesList(); GM_notification({ title: '已收藏', text: '路径已保存到收藏夹。', timeout: 2000 }); }

    async function deleteFavorite(index) { let f = await getFavorites(); f.splice(index, 1); await saveFavorites(f); renderFavoritesList(); }

    async function renderFavoritesList() { const favorites = await getFavorites(); favoritesList.innerHTML = ''; if (favorites.length === 0) { favoritesList.innerHTML = '<li id="empty-favorites-msg">暂无收藏</li>'; return; } favorites.forEach((item, idx) => { const li = document.createElement('li'); li.innerHTML = `<div class="item-text-content"><span class="item-title">${item.title}</span></div><div class="item-actions"><button class="action-btn" data-idx="${idx}">Go</button><button class="action-btn delete" data-idx="${idx}">Del</button></div>`; li.querySelectorAll('.action-btn').forEach(btn => { btn.addEventListener('click', (e) => { const i = parseInt(e.currentTarget.dataset.idx, 10); if (e.currentTarget.classList.contains('delete')) { deleteFavorite(i); } else { const fav = favorites[i]; replayPath(fav.path).catch(err=>console.error(err)); closeFavoritesDrawer(); } }); }); favoritesList.appendChild(li); }); }

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
        else { const observer = new MutationObserver((mutations, obs) => { const panel = document.querySelector('.stu-course-wrap'); if (panel) { panel.addEventListener('mouseleave', () => savePathImmediately("鼠标离开")); obs.disconnect(); } }); observer.observe(document.body, { childList: true, subtree: true }); }
    }

    function debounce(func, wait) { let timeout; return function executedFunction(...args) { const later = () => { clearTimeout(timeout); func(...args); }; clearTimeout(timeout); timeout = setTimeout(later, wait); }; }

    // 内容修改器（强制显示答案等）
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

    /* -------------------- XHR 请求拦截器 -------------------- */
    function setupXHRInterceptor() {
        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function(method, url) {
            if (typeof url === 'string' && url.endsWith('enchance')) { this._isMockTarget = true; }
            else if (typeof url === 'string' && url.includes('catalog/entity')) { this._isCatalogTarget = true; }
            else if (url && typeof url === 'string' && url.endsWith('/content')) { this._isContentTarget = true; }
            originalOpen.apply(this, arguments);
        };

        XMLHttpRequest.prototype.send = function() {
            if (this._isMockTarget && settings.enableMockEnhance) {
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

            if (this._isCatalogTarget) {
                this.addEventListener('load', function() {
                    if (this.status === 200) {
                        try {
                            const response = JSON.parse(this.responseText);
                            const activeMainMenu = document.querySelector('.menu > div.active');
                            const mainMenuContext = activeMainMenu ? cleanInnerText(activeMainMenu) : '课程';
                            const activeSubject = document.querySelector('.folderName.active');
                            const subjectContext = activeSubject ? cleanInnerText(activeSubject) : '未知科目';
                            processCatalogData(response, mainMenuContext, subjectContext);
                        } catch (e) { console.error('目录数据处理失败:', e); }
                    }
                });
            }

            originalSend.apply(this, arguments);
        };
    }

    function processCatalogData(response, mainMenuContext, subjectContext) {
        if (!response || !response.extra || subjectContext === '未知科目') { searchableItems = []; return; }
        const flatList = [];
        const mainMenuStep = { selector: "div.menu > div", text: mainMenuContext };
        const subjectStep = { selector: "div.folderName", text: subjectContext };
        const initialPath = [mainMenuStep, subjectStep, subjectStep];

        function flattenTree(nodes, parentPath) {
            if (!nodes || nodes.length === 0) return;
            nodes.forEach(node => {
                const currentSelector = "span.ant-tree-node-content-wrapper";
                const currentStep = { selector: currentSelector, text: node.catalogName };
                const replayablePath = [...parentPath, currentStep];
                const displayPath = replayablePath.slice(1, 2).concat(replayablePath.slice(3)).map(p => p.text).join(' / ');
                flatList.push({ title: node.catalogName, displayPath: displayPath, replayablePath: replayablePath });
                if (node.childList && node.childList.length > 0) { flattenTree(node.childList, replayablePath); }
            });
        }

        flattenTree(response.extra, initialPath);
        searchableItems = flatList;
        console.log(`🔍 已为科目“${subjectContext}”处理 ${searchableItems.length} 个可搜索项。`);
    }

    function createSearchUI() {
        if (document.getElementById('search-spotlight-overlay')) return;
        const overlay = document.createElement('div');
        overlay.id = 'search-spotlight-overlay';
        overlay.className = 'search-spotlight-overlay';
        const containerHTML = `
            <div class="search-spotlight-container">
                <div class="search-input-wrapper">
                    <svg class="icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
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
        function destroySearchUI(callback) { overlay.classList.remove('visible'); setTimeout(() => { overlay.remove(); if (typeof callback === 'function') { callback(); } }, 200); }
        function renderResults(query) {
            resultsList.innerHTML = '';
            currentHighlight = -1;
            if (!query) return;
            if (searchableItems.length === 0) { resultsList.innerHTML = '<div class="search-empty-state">请先点击一个科目以加载目录数据。</div>'; return; }
            const results = searchableItems.filter(item => PinyinMatch.match(item.title, query));
            if (results.length === 0) { resultsList.innerHTML = '<div class="search-empty-state">无匹配结果</div>'; }
            else { results.slice(0, 50).forEach(item => { const li = document.createElement('li'); li.innerHTML = `<span class="search-result-title">${item.title}</span><span class="search-result-path">${item.displayPath}</span>`; li.dataset.path = JSON.stringify(item.replayablePath); resultsList.appendChild(li); }); }
        }
        overlay.addEventListener('click', (e) => { if (e.target === overlay) destroySearchUI(); });
        resultsList.addEventListener('click', (e) => { const targetLi = e.target.closest('li'); if (targetLi && targetLi.dataset.path) { const path = JSON.parse(targetLi.dataset.path); destroySearchUI(() => { replayPath(path).catch(err => console.error("Search navigation failed:", err)); }); } });
        const debouncedSearch = debounce(renderResults, 200);
        input.addEventListener('input', () => debouncedSearch(input.value.trim()));
        input.addEventListener('keydown', e => {
            const items = resultsList.querySelectorAll('li'); if (!items.length) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); if (currentHighlight < items.length - 1) { currentHighlight++; items.forEach(item => item.classList.remove('highlighted')); items[currentHighlight].classList.add('highlighted'); } }
            else if (e.key === 'ArrowUp') { e.preventDefault(); if (currentHighlight > 0) { currentHighlight--; items.forEach(item => item.classList.remove('highlighted')); items[currentHighlight].classList.add('highlighted'); } }
            else if (e.key === 'Enter') { e.preventDefault(); const highlightedItem = resultsList.querySelector('li.highlighted'); if (highlightedItem) { highlightedItem.click(); } else if (items.length > 0) { items[0].click(); } }
            else if (e.key === 'Escape') { destroySearchUI(); }
        });
        requestAnimationFrame(() => { overlay.classList.add('visible'); input.focus(); });
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

    async function saveSettings(newSettings) { await GM_setValue(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings)); settings = newSettings; }

    function initializePdfIframeObserver() {
        const forceShowPDFButtonsCSS = '[hidden]:not(#errorWrapper), button.hidden, div#editorModeButtons.hidden { display: block !important; }';
        function injectFix(iframe) {
            if (settings.forceShowPDFButtons && iframe.contentDocument) {
                const styleId = 'tampermonkey-pdf-button-fix';
                if (iframe.contentDocument.getElementById(styleId)) return;
                const style = iframe.contentDocument.createElement('style'); style.id = styleId; style.textContent = forceShowPDFButtonsCSS; iframe.contentDocument.head.appendChild(style);
            }
        }
        const observer = new MutationObserver(mutations => {
            for (const mutation of mutations) { mutation.addedNodes.forEach(node => { if (node.nodeType === 1) { if (node.tagName === 'IFRAME') { node.addEventListener('load', () => injectFix(node)); } node.querySelectorAll('iframe').forEach(iframe => { iframe.addEventListener('load', () => injectFix(iframe)); }); } }); }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        document.querySelectorAll('iframe').forEach(iframe => { if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') { injectFix(iframe); } else { iframe.addEventListener('load', () => injectFix(iframe)); } });
    }

    function initializeAnswerAreaObserver() {
        if (!settings.autoExpandAnswerArea) { return; }
        let sentinelObserver = null; let buttonObserver = null;
        function checkAndClickButtons() { const buttons = document.querySelectorAll('button.ant-btn'); buttons.forEach(btn => { if (btn.innerText.trim().endsWith('答题区') && !btn.classList.contains('ant-btn-primary')) { btn.click(); } }); }
        function startFeature() { if (buttonObserver) return; checkAndClickButtons(); buttonObserver = new MutationObserver(checkAndClickButtons); buttonObserver.observe(document.body, { childList: true, subtree: true }); }
        function stopFeature() { if (buttonObserver) { buttonObserver.disconnect(); buttonObserver = null; } }
        function setupSentinel(contentElement) { if (sentinelObserver) { sentinelObserver.disconnect(); }
            sentinelObserver = new MutationObserver(() => { if (contentElement.querySelector('.top')) { startFeature(); } else { stopFeature(); } }); sentinelObserver.observe(contentElement, { childList: true, subtree: true }); if (contentElement.querySelector('.top')) { startFeature(); } else { stopFeature(); } }
        const containerObserver = new MutationObserver(() => { const contentEl = document.querySelector('div.content'); if (contentEl) { setupSentinel(contentEl); containerObserver.disconnect(); } });
        const initialContentEl = document.querySelector('div.content'); if (initialContentEl) { setupSentinel(initialContentEl); } else { containerObserver.observe(document.body, { childList: true, subtree: true }); }
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
        settingsPage.innerHTML = content; document.body.appendChild(settingsPage);
        const settingsList = settingsPage.querySelector('#settings-list');
        const settingDefs = {
            autoLogin: { title: '自动登录', desc: '在登录页面自动点击“开始使用”，跳过手动操作。' },
            enableHandwritingFix: { title: '手写优化', desc: '防止在平板或手机上手写时，因误触导致页面滚动或刷新。' },
            forceShowPDFButtons: { title: '强制下载', desc: '确保PDF阅读器中的下载、打印等按钮始终可见。' },
            enableSmartHints: { title: '智能提示', desc: '在您可能需要时（如首次使用、长时间停留），主动提示相关功能。' },
            enableMockEnhance: { title: '图片极速上传', desc: '拦截增强图片请求，从而使上传图片用时减少80%以上。' },
            enableAnswerForce: { title: '强制显示答案', desc: '自动修改题目数据，强制显示“查看答案”等通常被隐藏的按钮。' },
            autoExpandAnswerArea: { title: '自动展开答题区', desc: '在题目页面自动点击“显示答题区”按钮，免去手动操作。' }
        };
        for (const key in settingDefs) {
            const def = settingDefs[key];
            const item = document.createElement('div'); item.className = 'setting-item'; item.innerHTML = `<div class="setting-text"><h3>${def.title}</h3><p>${def.desc}</p></div><label class="toggle-switch"><input type="checkbox" id="setting-${key}" ${settings[key] ? 'checked' : ''}><span class="toggle-slider"></span></label>`;
            settingsList.appendChild(item);
            item.querySelector(`#setting-${key}`).addEventListener('change', async function() { const newSettings = await getSettings(); newSettings[key] = this.checked; await saveSettings(newSettings); updateConditionalStyles(newSettings); GM_notification({ title: '设置已保存', text: `“${def.title}”已${this.checked ? '开启' : '关闭'}。`, timeout: 2000 }); });
        }
        settingsPage.querySelector('.close-btn').addEventListener('click', () => { window.history.back(); });
    }

    function destroySettingsPage() { if (settingsPage) { settingsPage.remove(); settingsPage = null; } const appElement = document.querySelector('.app'); if (appElement) appElement.style.display = ''; }

    function handleHashChange() { if (window.location.hash === '#/settings/plugin') { const appElement = document.querySelector('.app'); if (appElement) appElement.style.display = 'none'; createSettingsPage(); } else { destroySettingsPage(); } }

    function setupSettingsListener() { window.addEventListener('hashchange', handleHashChange); handleHashChange(); }

    /* -------------------- DOM 注入与功能初始化 -------------------- */
    function injectPillAndDrawers() {
        if (!document.getElementById('rebootOverlay')) { const rebootOverlay = document.createElement('div'); rebootOverlay.className = 'reboot-overlay'; rebootOverlay.id = 'rebootOverlay'; document.documentElement.appendChild(rebootOverlay); }
        if (!document.getElementById('scanline')) { const scanline = document.createElement('div'); scanline.className = 'scanline'; scanline.id = 'scanline'; document.documentElement.appendChild(scanline); }
        if (!document.getElementById('pillMenu')) {
            const pillHTML = `
                <div class="pill-container" id="pillMenu" role="button" aria-label="Pill Menu">
                    <div class="pill-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </div>
                    <div class="pill-message"><span class="message-text"></span></div>
                    <div class="pill-buttons" id="pillButtons">
                        <button class="pill-button" title="Bookmarks" aria-label="Bookmarks">...</button>
                        <button class="pill-button" title="Add to Bookmarks" aria-label="Add to Bookmarks">...</button>
                        <button class="pill-button" title="Search" aria-label="Search">...</button>
                        <button class="pill-button" title="Reload" aria-label="Reload">...</button>
                        <button class="pill-button" title="Settings" aria-label="Settings">...</button>
                    </div>
                </div>`;
            const wrapper = document.createElement('div'); wrapper.innerHTML = pillHTML; document.body.appendChild(wrapper.firstElementChild);
        }
        (function initializeDrawers() { if (document.getElementById('favorites-drawer')) return; favoritesOverlay = document.createElement('div'); favoritesOverlay.className = 'drawer-overlay'; favoritesOverlay.id = 'favorites-overlay'; favoritesDrawer = document.createElement('div'); favoritesDrawer.id = 'favorites-drawer'; favoritesDrawer.className = 'bottom-sheet-drawer'; favoritesList = document.createElement('ul'); favoritesList.id = 'favorites-list'; favoritesDrawer.appendChild(favoritesList); document.body.appendChild(favoritesOverlay); document.body.appendChild(favoritesDrawer);
            nextStepOverlay = document.createElement('div'); nextStepOverlay.className = 'drawer-overlay'; nextStepOverlay.id = 'next-step-overlay'; nextStepDrawer = document.createElement('div'); nextStepDrawer.id = 'next-step-drawer'; nextStepDrawer.className = 'bottom-sheet-drawer'; nextStepList = document.createElement('ul'); nextStepList.id = 'next-step-list'; nextStepDrawer.appendChild(nextStepList); document.body.appendChild(nextStepOverlay); document.body.appendChild(nextStepDrawer); })();
    }

    function setupMenuDoubleClick() {
        document.body.addEventListener('dblclick', (event) => {
            const menuElement = event.target.closest('.slider');
            if (menuElement) { event.preventDefault(); event.stopPropagation(); createSearchUI(); }
        });
    }

    function setupPillBehavior() {
        const pillMenu = document.getElementById('pillMenu'); if (!pillMenu) return;
        const rebootOverlay = document.getElementById('rebootOverlay'), scanline = document.getElementById('scanline');
        const bookmarksBtn = pillMenu.querySelector('button[title="Bookmarks"]'), addBookmarkBtn = pillMenu.querySelector('button[title="Add to Bookmarks"]'), reloadBtn = pillMenu.querySelector('button[title="Reload"]'), settingsBtn = pillMenu.querySelector('button[title="Settings"]');
        const searchBtn = pillMenu.querySelector('button[title="Search"]');
        if (bookmarksBtn) { bookmarksBtn.addEventListener('click', (e) => { e.stopPropagation(); openFavoritesDrawer(); }); }
        if (searchBtn) { searchBtn.addEventListener('click', (e) => { e.stopPropagation(); createSearchUI(); }); }
        if (addBookmarkBtn) { addBookmarkBtn.addEventListener('click', (e)=>{ e.stopPropagation(); addCurrentPathToFavorites(); }); }
        if (reloadBtn) { reloadBtn.addEventListener('click', (e)=>{ e.stopPropagation(); const path = JSON.parse(GM_getValue(PATH_STORAGE_KEY, 'null') || 'null'); if (path) { replayPath(path).catch(()=>{}); } }); }
        if (settingsBtn) { settingsBtn.addEventListener('click', (e) => { e.stopPropagation(); window.location.hash = '#/settings/plugin'; }); }
        let singleClickTimer = null, isAnimating = false;
        function performLogoutRequest() { return new Promise((resolve) => { GM_xmlhttpRequest({ method: 'GET', url: 'https://bdfz.xnykcxt.com:5002/exam/login/api/logout', headers: { 'Accept': 'application/json' }, onload: () => resolve(); onerror: () => resolve(); }); }); }
        function initiateReboot() { isAnimating = true; pillMenu.classList.add('animating'); requestAnimationFrame(() => { pillMenu.style.animation = 'pill-implode 0.5s cubic-bezier(0.4, 0, 1, 1)'; setTimeout(()=>{ location.reload(); }, 600); }); }
        function handleClick(e) { if (isAnimating || e.target.closest('.pill-button') || e.target.closest('.message-text')) return; if (pillMenu.classList.contains('show-message') || pillMenu.classList.contains('show-suggestion')) { hidePillMessage(); } clearTimeout(singleClickTimer); singleClickTimer = setTimeout(() => { requestAnimationFrame(() => pillMenu.classList.toggle('expanded')); }, 200); }
        pillMenu.addEventListener('click', handleClick);
        pillMenu.addEventListener('dblclick', async (e) => { e.stopPropagation(); e.preventDefault(); if (isAnimating || e.target.closest('.pill-button')) return; clearTimeout(singleClickTimer); initiateReboot(); });
        ['mousedown', 'touchstart', 'touchend', 'touchmove'].forEach(evt => { pillMenu.addEventListener(evt, (ev) => { ev.stopPropagation(); }, { passive: false }); });
        pillMenu.tabIndex = 0; pillMenu.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); pillMenu.classList.toggle('expanded'); } });
        window.addEventListener('load', () => { setTimeout(() => { if (!pillMenu.classList.contains('expanded')) { pillMenu.style.willChange = 'auto'; } }, 1000); });
    }

    /* -------------------- 智能提示逻辑 -------------------- */
    let hintDismissTimer = null; let idleCheckTimer = null;
    function hidePillMessage() { clearTimeout(hintDismissTimer); const pillMenu = document.getElementById('pillMenu'); if (pillMenu) { pillMenu.classList.remove('show-message', 'show-suggestion'); const msgEl = pillMenu.querySelector('.message-text'); if (msgEl) msgEl.innerHTML = ''; } }
    async function setupSmartHints() { const pillMenu = document.getElementById('pillMenu'); if (!pillMenu) return; const msgTextEl = pillMenu.querySelector('.message-text'); const showPillMessage = ({ text, duration = 0, isSuggestion = false }) => { hidePillMessage(); msgTextEl.innerHTML = text; pillMenu.classList.add(isSuggestion ? 'show-suggestion' : 'show-message'); if (duration > 0) { hintDismissTimer = setTimeout(hidePillMessage, duration); } };
        const handleGreeting = async () => { const greetingsDone = await GM_getValue(GREETINGS_DONE_KEY, false); if (!greetingsDone) { setTimeout(() => { msgTextEl.onclick = () => { window.open('https://github.com/Jeremy-Cai/BDFZ-XNY', '_blank'); hidePillMessage(); }; showPillMessage({ text: '初次见面，请多关照', duration: 8000 }); GM_setValue(GREETINGS_DONE_KEY, true); }, 1500); } };
        const idleCheck = async () => { clearTimeout(idleCheckTimer); idleCheckTimer = setTimeout(async () => { const pillMenu = document.getElementById('pillMenu'); if (!pillMenu || pillMenu.classList.contains('show-message')) { return; } const path = captureCurrentPath(); const isAtRoot = !path || path.length < 2; const pathExists = await GM_getValue(PATH_STORAGE_KEY, null); const reloadBtn = pillMenu.querySelector('button[title="Reload"]'); if (reloadBtn) reloadBtn.style.display = pathExists ? '' : 'none'; if (isAtRoot && !document.getElementById('favorites-drawer')?.classList.contains('open')) { showPillMessage({ text: '去哪里？', duration: 8000, isSuggestion: true }); } }, 2000); };
        window.addEventListener('load', () => { handleGreeting(); idleCheck(); });
        document.body.addEventListener('click', (event) => { if (event.target.closest('.menu, .folder, .ant-tree-treenode, .drawer-overlay')) { setTimeout(idleCheck, 500); } }, true);
    }

    function setupMenuIndicator() { const initialObserver = new MutationObserver((mutations, obs) => { const menu = document.querySelector('.menu'); if (menu) { setupSlidingIndicator(menu); obs.disconnect(); } }); initialObserver.observe(document.body, { childList: true, subtree: true }); function setupSlidingIndicator(menu) { if (menu.querySelector('.menu-active-indicator')) return; const indicator = document.createElement('div'); indicator.className = 'menu-active-indicator'; menu.appendChild(indicator); const observer = new MutationObserver(() => { const active = menu.querySelector('div.active'); if (!active) return; indicator.style.top = (active.offsetTop - menu.offsetTop) + 'px'; indicator.style.height = active.offsetHeight + 'px'; }); observer.observe(menu, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] }); } }

    function setupAutoLogin() { window.addEventListener('load', function() { if (location.pathname === '/stu/' && location.hash === '#/login') { var loginButton = document.querySelector('.ant-btn-lg'); if (loginButton && loginButton.innerText.trim() === "开始使用") { console.log('找到了登录按钮，正在尝试点击...'); setTimeout(function() { loginButton.click(); }, 750); } else { console.log('未找到指定的登录按钮。'); } } else { console.log('当前不是登录页，不执行自动登录。'); } }); }

    function initializeHandwritingFixObserver() { const containerSelector = 'body', canvasSelector = '.board.answerCanvas', fixedAttribute = 'data-tampermonkey-fixed'; function applyFix(element) { if (element.hasAttribute(fixedAttribute)) { return; } element.addEventListener('touchmove', function(event) { event.preventDefault(); event.stopPropagation(); }, { passive: false }); element.style.overscrollBehaviorY = 'contain'; element.setAttribute(fixedAttribute, 'true'); }
        const container = document.querySelector(containerSelector); if (!container) { setTimeout(initializeHandwritingFixObserver, 500); return; } const observer = new MutationObserver(function(mutations) { for (const mutation of mutations) { if (mutation.addedNodes.length > 0) { mutation.addedNodes.forEach(node => { if (node.nodeType === 1) { if (node.matches && node.matches(canvasSelector)) { applyFix(node); } if (node.querySelectorAll) { node.querySelectorAll(canvasSelector).forEach(applyFix); } } }); } } }); observer.observe(container, { childList: true, subtree: true }); document.querySelectorAll(canvasSelector).forEach(applyFix); }

    /* -------------------- 脚本主入口 -------------------- */
    (async function main() {
        settings = await getSettings();
        injectPillAndDrawers();
        setupPillBehavior();
        setupMenuIndicator();
        attachGuardianListeners();
        setupXHRInterceptor();
        initializePdfIframeObserver();
        initializeAnswerAreaObserver();
        setupMenuDoubleClick();
        if (settings.autoLogin) { setupAutoLogin(); }
        if (settings.enableHandwritingFix) { initializeHandwritingFixObserver(); }
        if (settings.enableSmartHints) { setupSmartHints(); }
        setupSettingsListener();
    })();

})();
