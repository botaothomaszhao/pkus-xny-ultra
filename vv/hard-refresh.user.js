// ==UserScript==
// @name         强制刷新
// @namespace    https://github.com/botaothomaszhao/pkus-xny-ultra
// @version      vv.1.3
// @license      GPL-3.0
// @description  提供强制服务器登出、彻底清除所有客户端数据并强制刷新的功能。点击前会先记录当前路径，刷新完成后尝试自动重放该路径。短按仅reload，长按触发强制清理并reload（保留回放逻辑）。
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
    button.title = 'Hard Refresh';
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
        document.addEventListener('DOMContentLoaded', () => {
            document.body.appendChild(container);
        });
    } else {
        document.body.appendChild(container);
    }

    // 路径捕获与回放（基于 selector + 可见文本）

    function cleanInnerText(el) {
        if (!el) return "";
        const clone = el.cloneNode(true);
        clone.querySelectorAll("i, svg, path").forEach(n => n.remove());
        return clone.textContent.trim();
    }

    function captureCurrentPath() {
        const path = [];

        const root = document.querySelector('div.menu > div.active');
        if (root) path.push({selector: "div.menu > div", text: cleanInnerText(root)});

        const activeFolder = document.querySelector('div.folderName.active');
        if (activeFolder) {
            path.push({selector: "div.folderName", text: cleanInnerText(activeFolder)});

            const searchContext = activeFolder.closest('div.infinite-list-wrapper') || document;
            const uniqueNodes = new Map();

            searchContext.querySelectorAll("span.ant-tree-node-content-wrapper-open, span.ant-tree-node-content-wrapper.ant-tree-node-selected")
                .forEach(node => {
                    const text = cleanInnerText(node);
                    if (text) uniqueNodes.set(text, {selector: "span.ant-tree-node-content-wrapper", text: text});
                });

            path.push(...Array.from(uniqueNodes.values()));
        }

        return path.length > 0 ? path : null;
    }

    async function savePathForReplay() {
        try {
            const path = captureCurrentPath();
            if (path && path.length > 0) {
                await GM_setValue(REPLAY_STORAGE_KEY, JSON.stringify(path));
                console.log('已保存回放路径（供刷新后使用）：', path);
            } else {
                await GM_setValue(REPLAY_STORAGE_KEY, JSON.stringify(null));
                console.log('未捕获到路径，保存空回放占位符');
            }
        } catch (e) {
            console.warn('保存回放路径失败：', e);
        }
    }

    async function replaySavedPathIfAny() {
        try {
            const pathJSON = await GM_getValue(REPLAY_STORAGE_KEY, null);
            if (!pathJSON || pathJSON === 'null') {
                return;
            }
            const path = JSON.parse(pathJSON);
            console.log('检测到刷新前保存的回放路径，尝试回放：', path);

            function sleep(ms) {
                return new Promise(r => setTimeout(r, ms));
            }

            async function clickBySelectorAndText(sel, expectedText) {
                for (let attempts = 0; attempts < 50; attempts++) {
                    const nodes = document.querySelectorAll(sel);
                    for (const node of nodes) {
                        if (cleanInnerText(node) === expectedText) {
                            node.click();
                            console.log('回放点击:', expectedText);
                            return true;
                        }
                    }
                    await sleep(100);
                }
                return false;
            }

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
                    console.warn('在回放步骤未找到元素', step.text, '(selector:', step.selector + ')');
                }
            }

            await GM_setValue(REPLAY_STORAGE_KEY, JSON.stringify(null));
            console.log('回放尝试完成，已清除回放记录');
        } catch (e) {
            console.error('回放过程中发生错误：', e);
        }
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                replaySavedPathIfAny();
            }, 300);
        });
    } else {
        setTimeout(() => {
            replaySavedPathIfAny();
        }, 300);
    }

    // 主流程：先保存路径，然后清理并刷新
    async function sendLogoutRequest() {
        const url = 'https://bdfz.xnykcxt.com:5002/exam/login/api/logout';
        return new Promise((resolve) => {
            // 尝试使用 GM_xmlhttpRequest 并显式允许携带 Cookie（via 需要 withCredentials）
            try {
                if (typeof GM_xmlhttpRequest === 'function') {
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url,
                        headers: { 'Accept': 'application/json, text/plain, */*', 'Cache-Control': 'no-cache' },
                        timeout: 5000,
                        // 关键：在 Via 中保证发送 cookie
                        withCredentials: true,
                        onload: (response) => {
                            console.log('GM_xmlhttpRequest logout onload', response && response.status);
                            resolve(response);
                        },
                        onerror: (err) => {
                            console.warn('GM_xmlhttpRequest logout error, fallback to fetch', err);
                            resolve(null);
                        },
                        ontimeout: () => {
                            console.warn('GM_xmlhttpRequest logout timeout, fallback to fetch');
                            resolve(null);
                        }
                    });
                    return;
                }
            } catch (e) {
                console.warn('call to GM_xmlhttpRequest threw', e);
            }

            // 回退：使用标准 fetch 并携带凭证（cookie）
            try {
                fetch(url, {
                    method: 'GET',
                    credentials: 'include',
                    cache: 'no-cache',
                    headers: { 'Accept': 'application/json, text/plain, */*' }
                }).then(res => {
                    console.log('fetch logout result', res && res.status);
                    resolve(res);
                }).catch(err => {
                    console.warn('fetch logout failed', err);
                    resolve(null);
                });
            } catch (e) {
                console.warn('fetch threw', e);
                resolve(null);
            }
        });
    }

    async function nukeAndReload() {
        if (!container.classList.contains('loading')) {
            container.classList.add('loading');
            button.disabled = true;
        }

        try {
            console.log('开始执行 Hard Refresh...');
            console.log('正在向服务器发送登出请求...');
            try {
                await sendLogoutRequest();
            } catch (e) {
                console.warn('发送登出请求时发生意外错误：', e);
            }

            console.log('正在清理 Service Workers...');
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                await Promise.all(registrations.map(r => r.unregister()));
                console.log('已清理 Service Workers 数量:', registrations.length);
            }

            console.log('正在清理 Cache Storage...');
            if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map(key => caches.delete(key)));
                console.log('已清理 缓存 数量:', keys.length);
            }

            console.log('正在清理 Storage...');
            const localStorageSize = localStorage.length;
            const sessionStorageSize = sessionStorage.length;
            localStorage.clear();
            sessionStorage.clear();
            console.log('已清理 LocalStorage 和 SessionStorage:', localStorageSize, sessionStorageSize);

            console.log('正在清理 Cookies...');
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
            console.log('已清理 Cookies 数量:', cookieCount);
            console.log('清理完成，准备刷新页面...');
        } catch (error) {
            console.error('Hard Refresh 过程中发生错误:', error);
        } finally {
            setTimeout(() => {
                try {
                    window.location.reload();
                } catch (e) {
                    try {
                        window.location.href = window.location.href;
                    } catch (e2) {
                        window.location.replace(window.location.href);
                    }
                }
            }, 500);
        }
    }

    // 保留原有的 onClickHandler 逻辑（用于长按时触发）
    async function onClickHandler() {
        if (container.classList.contains('loading')) return;
        container.classList.add('loading');
        button.disabled = true;
        try {
            await savePathForReplay();
        } catch (e) {
            console.warn('保存路径时出错，仍继续进行刷新：', e);
        }

        setTimeout(() => {
            nukeAndReload().catch(err => {
                console.error('nukeAndReload failed:', err);
                container.classList.remove('loading');
                button.disabled = false;
            });
        }, 50);
    }

    async function handleShortPress() {
        if (container.classList.contains('loading')) return;
        container.classList.add('loading');
        button.disabled = true;
        try {
            await savePathForReplay();
        } catch (e) {
            console.warn('保存路径时出错，仍继续进行短按刷新：', e);
        }
        // 立刻 reload（回放逻辑在页面加载时仍会执行）
        try {
            window.location.reload();
        } catch (e) {
            try {
                window.location.href = window.location.href;
            } catch (e2) {
                window.location.replace(window.location.href);
            }
        }
    }

// 优化后的按键处理逻辑（替换原有 pointer/keyboard 相关事件处理部分）
    const LONG_PRESS_MS = 2000;
    let pressTimer = null;
    let longPressTriggered = false;
    let activePointerId = null;
    let startX = 0, startY = 0;
    const MOVE_THRESHOLD = 10; // px
    let keyActive = false;

    function clearPressTimer() {
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
        if (activePointerId !== null) {
            try {
                if (button.releasePointerCapture) button.releasePointerCapture(activePointerId);
            } catch (e) { /* ignore */
            }
            activePointerId = null;
        }
        startX = startY = 0;
    }

// 使用已有的 triggerLongPress/onClickHandler/handleShortPress 逻辑
    async function triggerLongPress() {
        if (longPressTriggered) return;
        longPressTriggered = true;
        try {
            await onClickHandler();
        } catch (e) {
            console.error('长按触发强制刷新失败：', e);
            container.classList.remove('loading');
            button.disabled = false;
        } finally {
            // 保证状态在结束后被重置（在 onClickHandler 内也有保护）
            longPressTriggered = false;
            clearPressTimer();
        }
    }

// 阻止原生 click 以避免重复触发
    button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
    }, {capture: true});

// pointerdown: 开始计时并尝试捕获指针
    button.addEventListener('pointerdown', (e) => {
        if (container.classList.contains('loading')) return;
        clearPressTimer();
        longPressTriggered = false;
        activePointerId = e.pointerId;
        startX = e.clientX;
        startY = e.clientY;
        try {
            if (button.setPointerCapture) button.setPointerCapture(activePointerId);
        } catch (err) { /* ignore */
        }

        pressTimer = setTimeout(() => {
            triggerLongPress();
        }, LONG_PRESS_MS);
    }, {passive: true});

// pointermove: 超过阈值则取消长按计时（避免拖拽触发）
    button.addEventListener('pointermove', (e) => {
        if (activePointerId === null || e.pointerId !== activePointerId) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (Math.sqrt(dx * dx + dy * dy) > MOVE_THRESHOLD) {
            longPressTriggered = false;
            clearPressTimer();
        }
    }, {passive: true});

// pointerup: 根据是否已触发长按决定短按或不做任何事
    button.addEventListener('pointerup', () => {
        if (container.classList.contains('loading')) {
            clearPressTimer();
            return;
        }
        // release capture if any
        try {
            if (activePointerId !== null && button.releasePointerCapture) button.releasePointerCapture(activePointerId);
        } catch (err) { /* ignore */
        }

        // 如果长按已经触发，则忽略本次 pointerup
        if (longPressTriggered) {
            clearPressTimer();
            longPressTriggered = false;
            return;
        }

        // 短按处理
        clearPressTimer();
        handleShortPress().catch(err => {
            console.error('短按刷新失败：', err);
            container.classList.remove('loading');
            button.disabled = false;
        });
    }, {passive: true});

// 取消场景统一清理
    ['pointercancel', 'pointerleave', 'lostpointercapture'].forEach(evt => {
        button.addEventListener(evt, () => {
            longPressTriggered = false;
            clearPressTimer();
        });
    });

// 键盘：按下 Enter/Space 触发一次短按，按住不重复触发；keyup 恢复状态
    button.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            if (keyActive) return;
            keyActive = true;
            e.preventDefault();
            handleShortPress().catch(err => {
                console.error('键盘触发短按刷新失败：', err);
                container.classList.remove('loading');
                button.disabled = false;
            });
        }
    });

    button.addEventListener('keyup', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            keyActive = false;
        }
    });
})();
