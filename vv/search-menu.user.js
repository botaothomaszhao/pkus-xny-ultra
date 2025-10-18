// ==UserScript==
// @name         目录搜索
// @namespace    https://github.com/botaothomaszhao/pkus-xny-ultra
// @version      vv.1
// @license      GPL-3.0
// @description  课程目录搜索，支持拼音/首字母搜索并回放点击路径。
// @author       c-jeremy botaothomaszhao
// @match        https://bdfz.xnykcxt.com:5002/stu/*
// @grant        GM_addStyle
// @grant        GM_notification
// @run-at       document-body
// @require      https://unpkg.com/pinyin-match@1.2.8/dist/main.js
// ==/UserScript==

(function () {
    'use strict';

    /* ------------------------------------------------------------
       CSS：与 path-replay 的圆形按钮尺寸/风格一致（48px 圆），
       icon 居中优化，并包含搜索 overlay 的样式
    ------------------------------------------------------------ */
    GM_addStyle(`
        /* 按钮容器（与 path-replay 保持一致的位置与尺寸） */
        #search-spotlight-container {
            position: fixed;
            bottom: 110px;
            right: 25px;
            z-index: 2147483646;
            width: 48px;
            height: 48px;
        }
        #search-spotlight-btn {
            width: 100%;
            height: 100%;
            background-color: #ffffff;
            border: none;
            border-radius: 50%;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            line-height: 0; /* 防止 inline SVG 影响垂直对齐 */
        }
        #search-spotlight-btn:hover { transform: scale(1.05); transition: transform .12s ease; }
        #search-spotlight-btn .icon {
            width: 24px;
            height: 24px;
            color: #333333;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        #search-spotlight-btn .icon svg { display: block; width: 20px; height: 20px; }
        #search-spotlight-container.loading #search-spotlight-btn { cursor: not-allowed; opacity: 0.85; }
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
    `);

    /* -------------------- 工具函数 -------------------- */
    function cleanInnerText(el) {
        if (!el) return "";
        try {
            const clone = el.cloneNode(true);
            clone.querySelectorAll("i, svg, path").forEach(n => n.remove());
            return (clone.textContent || "").trim();
        } catch (e) {
            return (el.textContent || "").trim();
        }
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

    /* -------------------- 数据与入口变量 -------------------- */
    let searchableItems = []; // { title, displayPath, replayablePath }
    const MAX_DISPLAY = 50;

    /* -------------------- XHR 拦截：监听 catalog/entity 返回 -------------------- */
    function setupXHRInterceptorForCatalog() {
        const origOpen = XMLHttpRequest.prototype.open;
        const origSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function (method, url) {
            try {
                if (typeof url === 'string' && url.includes('catalog/entity')) {
                    this._isCatalogTarget = true;
                }
            } catch (e) { /* ignore */ }
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
                            processCatalogData(response, mainMenuContext, subjectContext);
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
    function processCatalogData(response, mainMenuContext, subjectContext) {
        if (!response || !response.extra || subjectContext === '未知科目') {
            searchableItems = [];
            return;
        }
        const flatList = [];

        const mainMenuStep = { selector: "div.menu > div", text: mainMenuContext };
        const subjectStep = { selector: "div.folderName", text: subjectContext };

        // 重复 subjectStep 一次以模拟“双击展开”需要的行为
        const initialPath = [mainMenuStep, subjectStep, subjectStep];

        function flattenTree(nodes, parentPath) {
            if (!nodes || nodes.length === 0) return;
            nodes.forEach(node => {
                const currentSelector = "span.ant-tree-node-content-wrapper";
                const currentStep = { selector: currentSelector, text: node.catalogName };
                const replayablePath = [...parentPath, currentStep];
                const displayPath = replayablePath
                    .slice(1, 2) // 只显示科目
                    .concat(replayablePath.slice(3)) // 后续显示
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
        console.log(`Search Spotlight: loaded ${searchableItems.length} items for "${subjectContext}"`);
    }

    /* -------------------- 回放路径逻辑（独立实现） -------------------- */
    async function replayPath(path) {
        if (!Array.isArray(path) || path.length === 0) return;
        console.log('Search Spotlight: replayPath start', path);
        GM_notification({ title: '搜索导航', text: '正在导航到选中的目录...', timeout: 3000 });

        // 用 selector + text 去匹配并点击节点（带重试机制）
        async function clickBySelectorAndText(sel, expectedText) {
            for (let attempts = 0; attempts < 50; attempts++) {
                const nodes = document.querySelectorAll(sel);
                for (const node of nodes) {
                    if (cleanInnerText(node) === expectedText) {
                        node.click();
                        console.log(`Search Spotlight: clicked "${expectedText}"`);
                        return true;
                    }
                }
                await new Promise(r => setTimeout(r, 100));
            }
            return false;
        }

        // 有些页面在起始状态需要先点击“开始使用”
        const startButtonSpan = Array.from(document.querySelectorAll("button span")).find(s => s.innerText.trim() === "开始使用");
        if (startButtonSpan && startButtonSpan.closest('button')) {
            startButtonSpan.closest('button').click();
            await new Promise(r => setTimeout(r, 500));
        }

        for (const step of path) {
            const ok = await clickBySelectorAndText(step.selector, step.text);
            if (!ok) {
                GM_notification({ title: '导航失败', text: `无法定位 "${step.text}"，回放中止。`, timeout: 4000 });
                throw new Error(`Replay failed at step: ${step.text}`);
            }
            // 等待短时间以让页面处理展开等动作
            await new Promise(r => setTimeout(r, 250));
        }
        GM_notification({ title: '导航完成', text: '已尝试导航到所选目录。', timeout: 2500 });
        console.log('Search Spotlight: replayPath finished');
    }

    /* -------------------- UI：圆形按钮注入 -------------------- */
    function injectButton() {
        if (document.getElementById('search-spotlight-container')) return;
        const container = document.createElement('div');
        container.id = 'search-spotlight-container';
        const btn = document.createElement('button');
        btn.id = 'search-spotlight-btn';
        btn.title = '目录搜索';
        btn.setAttribute('aria-label', '目录搜索');

        const icon = document.createElement('div');
        icon.className = 'icon';
        icon.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
        btn.appendChild(icon);
        container.appendChild(btn);
        document.body.appendChild(container);

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            createSearchUI();
        });
    }

    /* -------------------- UI：Spotlight 搜索（按需创建/销毁） -------------------- */
    function createSearchUI() {
        if (document.getElementById('search-spotlight-overlay')) return;
        const overlay = document.createElement('div');
        overlay.id = 'search-spotlight-overlay';
        overlay.className = 'search-spotlight-overlay';

        overlay.innerHTML = `
            <div class="search-spotlight-card" role="dialog" aria-modal="true">
                <div class="search-input-wrapper">
                    <svg class="icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <input type="text" class="search-spotlight-input" placeholder="搜索课程目录 (支持拼音或拼音首字母)..." autocomplete="off" />
                </div>
                <ul class="search-results-list"></ul>
            </div>
        `;
        document.body.appendChild(overlay);

        const input = overlay.querySelector('.search-spotlight-input');
        const resultsList = overlay.querySelector('.search-results-list');
        let currentHighlight = -1;

        function destroySearchUI() {
            overlay.classList.remove('visible');
            setTimeout(() => {
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            }, 160);
        }

        function renderResults(query) {
            resultsList.innerHTML = '';
            currentHighlight = -1;
            if (!query) return;
            if (!searchableItems || searchableItems.length === 0) {
                resultsList.innerHTML = `<div class="search-empty-state">请先点击左侧的科目以加载目录数据。</div>`;
                return;
            }
            const results = searchableItems.filter(item => {
                try {
                    return PinyinMatch.match(item.title, query);
                } catch (e) { return item.title && item.title.includes(query); }
            });
            if (!results || results.length === 0) {
                resultsList.innerHTML = `<div class="search-empty-state">无匹配结果</div>`;
                return;
            }
            results.slice(0, MAX_DISPLAY).forEach(item => {
                const li = document.createElement('li');
                li.innerHTML = `<span class="search-result-title">${item.title}</span><span class="search-result-path">${item.displayPath}</span>`;
                li.dataset.path = JSON.stringify(item.replayablePath);
                resultsList.appendChild(li);
            });
        }

        const debounced = debounce((q) => renderResults(q), 180);
        input.addEventListener('input', () => debounced(input.value.trim()));

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) destroySearchUI();
        });

        resultsList.addEventListener('click', (e) => {
            const li = e.target.closest('li');
            if (li && li.dataset.path) {
                const path = JSON.parse(li.dataset.path);
                destroySearchUI();
                // 延迟一点触发回放，让 UI 完全销毁
                setTimeout(() => {
                    replayPath(path).catch(err => {
                        console.error('Search Spotlight: replay error', err);
                    });
                }, 120);
            }
        });

        input.addEventListener('keydown', (e) => {
            const items = resultsList.querySelectorAll('li');
            if (!items.length) {
                if (e.key === 'Escape') destroySearchUI();
                return;
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (currentHighlight < items.length - 1) {
                    currentHighlight++;
                    items.forEach(it => it.classList.remove('highlighted'));
                    items[currentHighlight].classList.add('highlighted');
                    items[currentHighlight].scrollIntoView({ block: 'nearest' });
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (currentHighlight > 0) {
                    currentHighlight--;
                    items.forEach(it => it.classList.remove('highlighted'));
                    items[currentHighlight].classList.add('highlighted');
                    items[currentHighlight].scrollIntoView({ block: 'nearest' });
                }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const hi = resultsList.querySelector('li.highlighted');
                if (hi) hi.click();
                else if (items.length > 0) items[0].click();
            } else if (e.key === 'Escape') {
                destroySearchUI();
            }
        });

        // 显示并聚焦
        requestAnimationFrame(() => {
            overlay.classList.add('visible');
            input.focus();
            input.select();
        });
    }

    /* -------------------- 初始化 -------------------- */
    (function main() {
        setupXHRInterceptorForCatalog();
        // 注入按钮（按钮始终可见）
        injectButton();
        // 也尝试在 load 完成时再注入一次以确保在所有场景可见
        window.addEventListener('load', () => {
            setTimeout(() => injectButton(), 300);
        });
    })();
})();
