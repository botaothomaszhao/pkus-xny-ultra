// ==UserScript==
// @name         路径记忆与一键回放
// @namespace    https://github.com/botaothomaszhao/pkus-xny-ultra
// @version      vv.1
// @license      GPL-3.0
// @description  记录并一键回放上次访问的课程路径。
// @author       c-jeremy botaothomaszhao
// @match        https://bdfz.xnykcxt.com:5002/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_notification
// @run-at       document-body
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = 'bdfz_persistent_path_v3';

    // 1. --- 注入CSS样式 (无变化) ---

    GM_addStyle(`
        #replay-path-container { position: fixed; bottom: 110px; right: 25px; z-index: 2147483646; width: 48px; height: 48px; }
        #replay-path-btn { width: 100%; height: 100%; background-color: #ffffff; border: none; border-radius: 50%; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); }
        #replay-path-btn:hover:not(:disabled) { transform: scale(1.1); box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2); }
        #replay-path-btn .replay-icon { width: 24px; height: 24px; color: #333333; }
        #replay-path-btn .replay-icon svg { width: 100%; height: 100%; fill: currentColor; stroke: none; }
        #replay-path-container.loading #replay-path-btn { cursor: not-allowed; }
        #replay-path-container.loading .replay-icon { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    `);

    // 2. --- 核心功能 (无变化) ---

    let lastKnownPath = null;

    function cleanInnerText(el) {
        if (!el) return "";
        const clone = el.cloneNode(true);
        clone.querySelectorAll("i, svg, path").forEach(n => n.remove());
        return clone.textContent.trim();
    }

    function captureCurrentPath() {
        let path = [];
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

    function savePathImmediately(reason = "常规") {
        const path = captureCurrentPath();
        if (path && JSON.stringify(path) !== JSON.stringify(lastKnownPath)) {
            lastKnownPath = path;
            GM_setValue(STORAGE_KEY, JSON.stringify(path));
            console.log(`💾 路径已保存 (${reason}):`, path);
        }
    }

    async function replayPath(path) {
        console.log("▶️ 开始回放路径:", path);
        GM_notification({title: '路径回放', text: '正在自动导航至记忆的位置...', timeout: 4000});

        async function clickBySelectorAndText(sel, expectedText) {
            for (let attempts = 0; attempts < 50; attempts++) {
                const nodes = document.querySelectorAll(sel);
                for (const node of nodes) {
                    if (cleanInnerText(node) === expectedText) {
                        node.click();
                        console.log(`✅ 重播点击: [${expectedText}]`);
                        return true;
                    }
                }
                await new Promise(r => setTimeout(r, 100));
            }
            return false;
        }

        const startButton = Array.from(document.querySelectorAll("button span")).find(s => s.innerText.trim() === "开始使用");
        if (startButton) {
            startButton.click();
            await new Promise(r => setTimeout(r, 500));
        }

        for (const step of path) {
            const success = await clickBySelectorAndText(step.selector, step.text);
            if (success) {
                await new Promise(r => setTimeout(r, 250));
            } else {
                GM_notification({title: '路径回放失败', text: `无法找到元素 "${step.text}"`, timeout: 5000});
                throw new Error(`Replay failed at step: ${step.text}`);
            }
        }
    }

    // 3. --- 全新的、分步式的初始化逻辑 ---

    // 步骤一：无条件创建UI

    // 确保按钮总是存在

    const container = document.createElement('div');
    container.id = 'replay-path-container';

    const button = document.createElement('button');
    button.id = 'replay-path-btn';
    button.title = '一键回放至上次记录的路径';

    const replayIcon = document.createElement('div');
    replayIcon.className = 'replay-icon';
    replayIcon.innerHTML = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>`;

    button.appendChild(replayIcon);
    container.appendChild(button);
    document.body.appendChild(container);

    // 步骤二：为UI绑定核心的回放功能

    button.addEventListener('click', async () => {
        if (container.classList.contains('loading')) return;
        container.classList.add('loading');
        button.disabled = true;

        try {
            const pathJSON = await GM_getValue(STORAGE_KEY, null);
            if (!pathJSON || pathJSON === 'null') {
                GM_notification({title: '提示', text: '尚未记录任何路径。', timeout: 3000});
                return;
            }
            const path = JSON.parse(pathJSON);
            await replayPath(path);
        } catch (error) {
            console.error('回放失败:', error);
        } finally {
            container.classList.remove('loading');
            button.disabled = false;
        }
    });

    // 步骤三：智能地附加"守护者"保存功能

    function attachGuardianListeners() {
        // 守护者 1 (最终保障): 页面即将卸载时，强制保存
        window.addEventListener('beforeunload', () => savePathImmediately("页面卸载"));

        // 守护者 2: 点击导航元素时，稍作延迟后保存
        document.body.addEventListener('click', (event) => {
            const navContainer = event.target.closest('.menu-wrap, .folder-wrap');
            if (navContainer) {
                setTimeout(() => savePathImmediately("点击导航"), 100);
            }
        });

        // 守护者 3: 当鼠标离开整个左侧导航区域时，立即保存
        const leftPanel = document.querySelector('.stu-course-wrap');
        if (leftPanel) {
            leftPanel.addEventListener('mouseleave', () => savePathImmediately("鼠标离开"));
        } else {
            // 如果左侧面板还不存在（比如在登录页），就设置一个观察者来等待它
            const observer = new MutationObserver((mutations, obs) => {
                const panel = document.querySelector('.stu-course-wrap');
                if (panel) {
                    panel.addEventListener('mouseleave', () => savePathImmediately("鼠标离开 (延迟附加)"));
                    obs.disconnect(); // 任务完成，停止观察
                }
            });
            observer.observe(document.body, {childList: true, subtree: true});
        }
    }

    // 在文档加载完成后，立即执行守护者附加逻辑

    attachGuardianListeners();
})();
