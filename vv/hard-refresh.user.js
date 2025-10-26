// ==UserScript==
// @name         强制刷新
// @namespace    https://github.com/botaothomaszhao/pkus-xny-ultra
// @version      vv.2.1
// @license      GPL-3.0
// @description  提供强制服务器登出、彻底清除所有客户端数据并强制刷新的功能。点击前会先记录当前路径，刷新完成后尝试自动重放该路径。短按仅reload，长按触发强制清理并reload（保留回放逻辑）。
// @author       c-jeremy botaothomaszhao
// @match        https://bdfz.xnykcxt.com:5002/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
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
        document.addEventListener('DOMContentLoaded', () => document.body.appendChild(container));
    } else {
        document.body.appendChild(container);
    }

    // 路径捕获与回放
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
                    if (text) uniqueNodes.set(text, {selector: "span.ant-tree-node-content-wrapper", text});
                });
            path.push(...Array.from(uniqueNodes.values()));
        }

        return path.length ? path : null;
    }

    async function savePathForReplay() {
        try {
            const path = captureCurrentPath();
            await GM_setValue(REPLAY_STORAGE_KEY, JSON.stringify(path || null));
        } catch (e) {
            console.warn('保存回放路径失败：', e);
        }
    }

    async function replaySavedPathIfAny() {
        try {
            const pathJSON = await GM_getValue(REPLAY_STORAGE_KEY, null);
            if (!pathJSON || pathJSON === 'null') return;
            const path = JSON.parse(pathJSON);

            function sleep(ms) {
                return new Promise(r => setTimeout(r, ms));
            }

            async function clickBySelectorAndText(sel, expectedText) {
                for (let i = 0; i < 50; i++) {
                    const nodes = document.querySelectorAll(sel);
                    for (const node of nodes) {
                        if (cleanInnerText(node) === expectedText) {
                            node.click();
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
                const ok = await clickBySelectorAndText(step.selector, step.text);
                if (ok) await sleep(250);
            }

            //await GM_setValue(REPLAY_STORAGE_KEY, JSON.stringify(null));
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

    // sendLogoutRequest: 放弃 GM_xmlhttpRequest，优先使用 fetch + AbortController
    async function sendLogoutRequest() {
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
            // fetch 失败或超时，回退到 XHR
        }
    }

    // 主清理与刷新流程
    async function nukeAndReload() {
        if (!container.classList.contains('loading')) {
            container.classList.add('loading');
            button.disabled = true;
        }

        try {
            await sendLogoutRequest();

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

    // 长按/短按逻辑（保留并精简）
    async function onClickHandler() {
        if (container.classList.contains('loading')) return;
        container.classList.add('loading');
        button.disabled = true;
        try {
            await savePathForReplay();
        } catch (e) {
        }
        setTimeout(() => {
            nukeAndReload().catch(() => {
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
        }
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

    // 优化后的按键处理：pointer + 键盘（长按触发一次）
    const LONG_PRESS_MS = 3000;
    let pressTimer = null;
    let longPressTriggered = false;
    let activePointerId = null;
    let keyActive = false;

    function clearPressTimer() {
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
        if (activePointerId !== null) {
            try {
                if (button.releasePointerCapture) button.releasePointerCapture(activePointerId);
            } catch (e) {
            }
            activePointerId = null;
        }
    }

    async function triggerLongPress() {
        if (longPressTriggered) return;
        longPressTriggered = true;
        try {
            await onClickHandler();
        } catch (e) {
            container.classList.remove('loading');
            button.disabled = false;
        } finally {
            longPressTriggered = false;
            clearPressTimer();
        }
    }

    button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
    }, {capture: true});

    button.addEventListener('pointerdown', (e) => {
        if (container.classList.contains('loading')) return;
        clearPressTimer();
        longPressTriggered = false;
        activePointerId = e.pointerId;
        try {
            if (button.setPointerCapture) button.setPointerCapture(activePointerId);
        } catch (err) {
        }
        pressTimer = setTimeout(triggerLongPress, LONG_PRESS_MS);
    }, {passive: true});

    button.addEventListener('pointerup', () => {
        if (container.classList.contains('loading')) {
            clearPressTimer();
            return;
        }
        try {
            if (activePointerId !== null && button.releasePointerCapture) button.releasePointerCapture(activePointerId);
        } catch (err) {
        }
        if (longPressTriggered) {
            clearPressTimer();
            longPressTriggered = false;
            return;
        }
        clearPressTimer();
        handleShortPress().catch(() => {
            container.classList.remove('loading');
            button.disabled = false;
        });
    }, {passive: true});

    ['pointercancel', 'pointerleave', 'lostpointercapture'].forEach(evt => {
        button.addEventListener(evt, () => {
            longPressTriggered = false;
            clearPressTimer();
        });
    });

    button.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            if (keyActive) return;
            keyActive = true;
            e.preventDefault();
            handleShortPress().catch(() => {
                container.classList.remove('loading');
                button.disabled = false;
            });
        }
    });

    button.addEventListener('keyup', (e) => {
        if (e.key === 'Enter' || e.key === ' ') keyActive = false;
    });

})();
