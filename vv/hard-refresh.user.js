// ==UserScript==
// @name         强制刷新（含路径重放）
// @namespace    https://github.com/botaothomaszhao/pkus-xny-ultra
// @version      vv.2
// @license      GPL-3.0
// @description  提供强制服务器登出、彻底清除所有客户端数据并强制刷新的功能。点击前会先记录当前路径，刷新完成后尝试自动重放该路径。
// @author       c-jeremy botaothomaszhao
// @match        https://bdfz.xnykcxt.com:5002/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      bdfz.xnykcxt.com
// ==/UserScript==

(function () {
    'use strict';

    GM_addStyle(`
        #hard-refresh-container {
            position: fixed;
            bottom: 50px;
            right: 25px;
            z-index: 21474647;
            width: 48px;
            height: 48px;
        }
        #hard-refresh-btn {
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
            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        }
        #hard-refresh-btn:hover:not(:disabled) {
            transform: scale(1.1);
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
        }
        #hard-refresh-btn:active:not(:disabled) {
            transform: scale(0.95);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        #hard-refresh-btn .refresh-icon {
            width: 24px;
            height: 24px;
            color: #333333;
            transition: transform 0.3s ease;
            transform-origin: center;
        }
        #hard-refresh-btn .refresh-icon svg {
            width: 100%;
            height: 100%;
            fill: none;
            stroke: currentColor;
        }
        #hard-refresh-container.loading #hard-refresh-btn {
            cursor: not-allowed;
        }
        #hard-refresh-container.loading .refresh-icon {
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
    `);

    const REPLAY_STORAGE_KEY = 'vv_hard_refresh_replay_path_v1';

    const container = document.createElement('div');
    container.id = 'hard-refresh-container';
    const button = document.createElement('button');
    button.id = 'hard-refresh-btn';
    button.title = 'Hard Refresh - 强制刷新并清除所有数据（点击前会记录当前路径，刷新后尝试回放）';
    const refreshIcon = document.createElement('div');
    refreshIcon.className = 'refresh-icon';
    refreshIcon.innerHTML = `
        <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 4v6h6"/>
            <path d="M23 20v-6h-6"/>
            <path d="m20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
        </svg>
    `;
    button.appendChild(refreshIcon);
    container.appendChild(button);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { document.body.appendChild(container); });
    } else {
        document.body.appendChild(container);
    }

    // ----------------------------
    // 路径捕获与回放（轻量版，基于 selector + 可见文本）
    // ----------------------------

    function cleanInnerText(el) { if (!el) return ""; const clone = el.cloneNode(true); clone.querySelectorAll("i, svg, path").forEach(n => n.remove()); return clone.textContent.trim(); }

    function captureCurrentPath() {
        const path = [];

        // 尝试捕获主菜单激活项（与 path-replay 保持兼容）
        const root = document.querySelector('div.menu > div.active');
        if (root) path.push({ selector: "div.menu > div", text: cleanInnerText(root) });

        const activeFolder = document.querySelector('div.folderName.active');
        if (activeFolder) {
            path.push({ selector: "div.folderName", text: cleanInnerText(activeFolder) });

            const searchContext = activeFolder.closest('div.infinite-list-wrapper') || document;
            const uniqueNodes = new Map();

            searchContext.querySelectorAll("span.ant-tree-node-content-wrapper-open, span.ant-tree-node-content-wrapper.ant-tree-node-selected")
                .forEach(node => {
                    const text = cleanInnerText(node);
                    if (text) uniqueNodes.set(text, { selector: "span.ant-tree-node-content-wrapper", text: text });
                });

            path.push(...Array.from(uniqueNodes.values()));
        }

        return path.length > 0 ? path : null;
    }

    async function savePathForReplay(reason = 'hard-refresh') {
        try {
            const path = captureCurrentPath();
            if (path && path.length > 0) {
                await GM_setValue(REPLAY_STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), reason, path }));
                console.log('💾 已保存回放路径（供刷新后使用）：', path);
            } else {
                // 如果未能捕获到明确路径，则仍保存 null 表示无可回放内容
                await GM_setValue(REPLAY_STORAGE_KEY, JSON.stringify(null));
                console.log('ℹ️ 未捕获到路径，保存空回放占位符');
            }
        } catch (e) {
            console.warn('⚠️ 保存回放路径失败：', e);
        }
    }

    async function replaySavedPathIfAny() {
        try {
            const raw = await GM_getValue(REPLAY_STORAGE_KEY, null);
            if (!raw) return;
            let record;
            try { record = JSON.parse(raw); } catch (e) { record = raw; }
            if (!record || !record.path) return;

            const path = record.path;
            console.log('▶️ 检测到刷新前保存的回放路径，尝试回放：', path);

            function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

            async function clickBySelectorAndText(sel, expectedText) {
                for (let attempts = 0; attempts < 50; attempts++) {
                    const nodes = document.querySelectorAll(sel);
                    for (const node of nodes) {
                        if (cleanInnerText(node) === expectedText) {
                            node.click();
                            console.log(`✅ 回放点击: [${expectedText}]`);
                            return true;
                        }
                    }
                    await sleep(100);
                }
                return false;
            }

            // 如果页面需要先点击 "开始使用" 按钮，尝试处理
            const startButton = Array.from(document.querySelectorAll("button span")).find(s => s.innerText && s.innerText.trim() === "开始使用");
            if (startButton) {
                startButton.click();
                await sleep(500);
            }

            for (const step of path) {
                const success = await clickBySelectorAndText(step.selector, step.text);
                if (success) {
                    await sleep(250);
                } else {
                    console.warn(`⚠️ 在回放步骤未找到元素 "${step.text}"（selector: ${step.selector}）`);
                    // 不抛出错误，继续尝试剩余步骤
                }
            }

            // 回放完成后清理保存项，避免重复回放
            await GM_setValue(REPLAY_STORAGE_KEY, JSON.stringify(null));
            console.log('🎉 回放完成或已尝试，已清除回放记录');
        } catch (e) {
            console.error('❌ 回放过程中发生错误：', e);
        }
    }

    // 在脚本加载时尝试在页面稳定后回放（如果有保存）
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', () => {
            // 给页面一点时间挂载 UI，再尝试回放
            setTimeout(() => { replaySavedPathIfAny(); }, 800);
        });
    } else {
        setTimeout(() => { replaySavedPathIfAny(); }, 800);
    }

    // ----------------------------
    // 主流程：在点击前先保存路径，然后进行“核弹”清理并刷新
    // ----------------------------

    async function nukeAndReload() {
        // Attempt to always end with a reload - use multiple strategies and a fallback timer
        if (container.classList.contains('loading')) {
            // already in progress
        } else {
            container.classList.add('loading');
            button.disabled = true;
        }

        try {
            console.log('🚀 开始执行Hard Refresh...');
            console.log('📡 正在向服务器发送登出请求...');
            await new Promise((resolve) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: 'https://bdfz.xnykcxt.com:5002/exam/login/api/logout',
                    headers: { 'Accept': 'application/json, text/plain, */*', 'Cache-Control': 'no-cache' },
                    timeout: 5000,
                    onload: (response) => { console.log('✅ 服务器登出请求完成'); resolve(response); },
                    onerror: (error) => { console.warn('⚠️ 服务器登出请求失败，继续执行清理'); resolve(error); },
                    ontimeout: () => { console.warn('⏰ 服务器登出请求超时，继续执行清理'); resolve(); }
                });
            });

            console.log('🔧 正在清理Service Workers...');
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                await Promise.all(registrations.map(r => r.unregister()));
                console.log(`✅ 已清理 ${registrations.length} 个Service Workers`);
            }

            console.log('💾 正在清理Cache Storage...');
            if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map(key => caches.delete(key)));
                console.log(`✅ 已清理 ${keys.length} 个缓存`);
            }

            console.log('📦 正在清理Storage...');
            const localStorageSize = localStorage.length;
            const sessionStorageSize = sessionStorage.length;
            localStorage.clear();
            sessionStorage.clear();
            console.log(`✅ 已清理LocalStorage(${localStorageSize})和SessionStorage(${sessionStorageSize})`);

            console.log('🍪 正在清理Cookies...');
            const cookies = document.cookie.split(";");
            let cookieCount = 0;
            for (const cookie of cookies) {
                const name = cookie.split("=")[0].trim();
                if (name) {
                    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.xnykcxt.com`;
                    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
                    cookieCount++;
                }
            }
            console.log(`✅ 已清理 ${cookieCount} 个Cookies`);
            console.log('🎉 所有清理操作完成，准备刷新页面...');
        } catch (error) {
            console.error('❌ Hard Refresh过程中发生错误:', error);
        } finally {
            // primary reload attempt (most browsers)
            setTimeout(() => {
                try {
                    window.location.reload();
                } catch (e) {
                    try { window.location.href = window.location.href; } catch (e2) { window.location.replace(window.location.href); }
                }
            }, 500);

            // fallback: if reload didn't happen (still on page), try again after 3s and then remove loading state so user can retry
            const fallbackTimer = setTimeout(() => {
                if (container.classList.contains('loading')) {
                    console.warn('⚠️ 主动重载未触发，使用替代重载方式');
                    try { window.location.href = window.location.href; } catch (e) { window.location.replace(window.location.href); }
                    // still remove loading to avoid stuck spinner if reload was prevented
                    container.classList.remove('loading');
                    button.disabled = false;
                }
            }, 3000);

            // clear fallback if page is unloading
            window.addEventListener('beforeunload', () => clearTimeout(fallbackTimer));
        }
    }

    // 新的点击入口：先保存路径，再执行 nukeAndReload
    async function onClickHandler() {
        if (container.classList.contains('loading')) return;
        container.classList.add('loading');
        button.disabled = true;
        try {
            await savePathForReplay('用户点击强制刷新');
        } catch (e) {
            console.warn('⚠️ 保存路径时出错，仍继续进行刷新：', e);
        }

        // small delay so UI updates before heavy operations
        setTimeout(() => { nukeAndReload().catch(err => {
            console.error('nukeAndReload failed:', err);
            container.classList.remove('loading');
            button.disabled = false;
        }); }, 50);
    }

    button.addEventListener('click', onClickHandler);
    console.log('🎨 Hard Refresh（含路径重放）按钮已加载完成');
})();
