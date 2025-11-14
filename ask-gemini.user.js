// ==UserScript==

// @name         Ask Gemini (Mobile Long Press)

// @namespace    http://tampermonkey.net/

// @version      2.1

// @description  Long press an image to ask Gemini about it. Uses regular API calls instead of streaming.

// @author       CJeremy

// @match        *://*/*

// @grant        GM_addStyle

// @grant        GM_xmlhttpRequest

// @connect      generativelanguage.googleapis.com

// ==/UserScript==

(function() {

    'use strict';

    // --- 1. 配置 ---

    const GEMINI_API_KEY = getSecureGeminiApiKey(); // 安全获取 API 密钥

/**
 * 安全获取 Gemini API 密钥
 * @returns {string} API 密钥或默认值
 */
function getSecureGeminiApiKey() {
    // 优先级 1: 环境变量（最安全）
    if (typeof unsafeWindow !== 'undefined' && unsafeWindow.GEMINI_API_KEY) {
        return unsafeWindow.GEMINI_API_KEY;
    }

    // 优先级 2: 临时会话存储
    const sessionKey = sessionStorage.getItem('bdfz_gemini_api_key_temp');
    if (sessionKey && sessionKey.startsWith('AIza')) {
        // 验证密钥格式
        if (validateApiKeyFormat(sessionKey)) {
            return sessionKey;
        } else {
            sessionStorage.removeItem('bdfz_gemini_api_key_temp');
            console.warn('[Security] Invalid API key format detected in session storage');
        }
    }

    // 优先级 3: 用户的设置（最不安全，但保持兼容性）
    return "YOUR_GEMINI_API_KEY";
}

/**
 * 验证 API 密钥格式
 * @param {string} apiKey - API 密钥
 * @returns {boolean} 是否有效
 */
function validateApiKeyFormat(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') return false;

    // Gemini API 密钥基本格式验证
    return /^AIza[A-Za-z0-9_-]{35}$/.test(apiKey);
}

/**
 * 设置 API 密钥（用于用户输入）
 * @param {string} apiKey - 新的 API 密钥
 * @returns {boolean} 设置是否成功
 */
function setSecureGeminiApiKey(apiKey) {
    if (!validateApiKeyFormat(apiKey)) {
        throw new Error('Invalid API key format');
    }

    sessionStorage.setItem('bdfz_gemini_api_key_temp', apiKey);
    console.log('[Security] API key stored in temporary session storage');
    return true;
}

    const LONG_PRESS_DURATION = 500;

    // --- 状态变量 ---

    let pressTimer = null;

    let longPressTriggered = false;

    let targetImageElement = null;

    let currentRequest = null;

    // --- 2. 长按检测事件监听 ---

    const onTouchStart = (e) => {

        if (e.target.tagName !== 'IMG') return;

        targetImageElement = e.target;

        longPressTriggered = false;

        pressTimer = setTimeout(() => {

            longPressTriggered = true;

            e.preventDefault();

            showCustomContextMenu(e.touches[0].pageX, e.touches[0].pageY);

        }, LONG_PRESS_DURATION);

    };

    const onTouchEnd = () => clearTimeout(pressTimer);

    const onTouchMove = () => clearTimeout(pressTimer);

    const onContextMenu = (e) => { if (longPressTriggered) e.preventDefault(); };

    document.addEventListener('touchstart', onTouchStart, { passive: false });

    document.addEventListener('touchend', onTouchEnd);

    document.addEventListener('touchmove', onTouchMove);

    document.addEventListener('contextmenu', onContextMenu);

    // --- 3. UI 创建 (自定义菜单和对话框) ---

    function showCustomContextMenu(x, y) {

        removeExistingUI('.gemini-context-menu');

        const menu = document.createElement('div');

        menu.className = 'gemini-context-menu';

        menu.innerHTML = `<div class="gemini-context-menu-item">Ask Gemini</div>`;

        menu.style.left = `${x}px`;

        menu.style.top = `${y}px`;

        menu.addEventListener('click', (e) => {

            e.stopPropagation();

            removeExistingUI('.gemini-context-menu');

            showGeminiDialog();

        });

        document.body.appendChild(menu);

        setTimeout(() => document.addEventListener('click', () => removeExistingUI('.gemini-context-menu'), { once: true }), 0);

    }

    function showGeminiDialog() {

        removeExistingUI('.gemini-dialog-overlay');

        const dialogOverlay = document.createElement('div');

        dialogOverlay.className = 'gemini-dialog-overlay';

        dialogOverlay.innerHTML = `

            <div class="gemini-dialog">

                <div class="gemini-dialog-header">

                    <h3 class="gemini-dialog-title">询问 Gemini 关于图片的问题</h3>

                    <div class="gemini-model-selector">

                        <label for="gemini-model-select" class="gemini-model-label">模型：</label>

                        <select id="gemini-model-select" class="gemini-model-select">

                            <option value="gemini-2.5-flash" selected>Gemini 2.5 Flash</option>

                            <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>

                            <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</option>

                        </select>

                    </div>

                </div>

                <div class="gemini-dialog-content">

                    <img class="gemini-dialog-preview-image" src="${targetImageElement.src}" alt="Image preview"/>

                    <textarea class="gemini-dialog-input" id="gemini-question" placeholder="例如：这是什么？">解答本题。</textarea>

                    <div id="gemini-response-area" class="gemini-dialog-response"></div>

                </div>

                <div class="gemini-dialog-footer">

                    <button class="gemini-dialog-button gemini-dialog-button-secondary" id="gemini-cancel-btn">取消</button>

                    <button class="gemini-dialog-button gemini-dialog-button-primary" id="gemini-ask-btn">发送</button>

                </div>

            </div>

        `;

        document.body.appendChild(dialogOverlay);

        const dialog = dialogOverlay.querySelector('.gemini-dialog');

        dialog.addEventListener('click', e => e.stopPropagation());

        document.getElementById('gemini-ask-btn').addEventListener('click', handleAskGemini);

        document.getElementById('gemini-cancel-btn').addEventListener('click', closeDialog);

        dialogOverlay.addEventListener('click', closeDialog);

    }

    function closeDialog() {

        if (currentRequest) {

            currentRequest.abort();

            currentRequest = null;

        }

        removeExistingUI('.gemini-dialog-overlay');

    }

    function removeExistingUI(selector) {

        const element = document.querySelector(selector);

        if (element) element.remove();

    }

    // --- 4. 核心逻辑 (图片转换与 API 调用) ---

    async function handleAskGemini() {

        const question = document.getElementById('gemini-question').value;

        if (!question.trim()) { alert("请输入问题。"); return; }

        if (GEMINI_API_KEY === "YOUR_GEMINI_API_KEY") {

            showError("请设置 GEMINI_API_KEY。你可以在浏览器控制台中运行 setSecureGeminiApiKey('your-api-key-here') 来设置，或者使用环境变量。");

            return;

        }

        // 安全检查：记录 API 调用（不包含敏感信息）
        console.log('[Security] Gemini API call initiated for image analysis', {
            timestamp: new Date().toISOString(),
            model: document.getElementById('gemini-model-select').value,
            hasValidKey: GEMINI_API_KEY.startsWith('AIza')
        });

        const askBtn = document.getElementById('gemini-ask-btn');

        const cancelBtn = document.getElementById('gemini-cancel-btn');

        askBtn.disabled = true;

        askBtn.textContent = '生成中...';

        cancelBtn.textContent = '停止';

        showLoadingAnimation();

        try {

            const base64Image = await imageToBase64(targetImageElement.src);

            const mimeType = base64Image.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/)[1];

            const cleanBase64 = base64Image.split(',')[1];

            callGeminiAPI(question, cleanBase64, mimeType);

        } catch (error) {

            console.error('图片处理错误:', error);

            showError("无法处理图片。请检查图片链接是否有效或查看浏览器控制台。");

            resetButtons();

        }

    }

    function imageToBase64(url) {

        return new Promise((resolve, reject) => {

            GM_xmlhttpRequest({

                method: 'GET', url: url, responseType: 'blob',

                onload: (response) => {

                    const reader = new FileReader();

                    reader.onloadend = () => resolve(reader.result);

                    reader.onerror = reject;

                    reader.readAsDataURL(response.response);

                },

                onerror: reject

            });

        });

    }

    function callGeminiAPI(prompt, base64Image, mimeType) {

        const selectedModel = document.getElementById('gemini-model-select').value;



        // 【安全】使用 Google 官方 API 地址。GM_xmlhttpRequest 会处理跨域。

        // 生成请求ID用于审计和错误追踪
        const requestId = Date.now().toString(36) + Math.random().toString(36).substr(2);
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${GEMINI_API_KEY}`;

        const headers = {

            "Content-Type": "application/json"

        };

        const requestBody = {

            "contents": [{

                "parts": [

                    { "text": prompt + "[SYSTEM]以上是用户要求；输出时请不要使用markdown格式，也不要用LaTeX。只许输出纯文本。" },

                    { "inline_data": { "mime_type": mimeType, "data": base64Image } }

                ]

            }],

            "generationConfig": {

                "thinkingConfig": { "thinkingBudget": 5000 }

            }

        };

        currentRequest = GM_xmlhttpRequest({

            method: "POST",

            url: apiUrl,

            headers: headers,

            data: JSON.stringify(requestBody),

            onload: function(response) {

                currentRequest = null;

                if (response.status !== 200) {

                    let errorMessage = `API 返回错误 (状态码: ${response.status})`;

                    try {

                        const errorData = JSON.parse(response.responseText);

                        const message = errorData.error?.message || "未知 API 错误";

                        if (message.includes("API key not valid")) {

                            errorMessage = "API 密钥无效或已过期，请在脚本中检查你的密钥。";

                        } else {

                            errorMessage = message;

                        }

                    } catch (e) {

                        errorMessage = "无法解析 API 错误信息。";

                    }

                    showError(errorMessage);

                } else {

                    try {

                        const data = JSON.parse(response.responseText);

                        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

                        if (responseText) {

                            showResponse(responseText);

                        } else {

                            showError("模型未返回任何内容，可能是由于安全设置或其他原因。");

                        }

                    } catch (e) {

                        console.error('解析响应失败:', e);

                        showError("无法解析API响应。");

                    }

                }

                resetButtons();

            },

            onerror: function(error) {

                console.error('网络或 GM_xmlhttpRequest 错误:', error);

                showError("网络连接失败。无法访问 Gemini API，请检查网络或浏览器控制台。");

                resetButtons();

                currentRequest = null;

            }

        });

    }

    function showLoadingAnimation() {

        const responseArea = document.getElementById('gemini-response-area');

        if (responseArea) {

             responseArea.innerHTML = `<div class="gemini-loader-container"><div class="gemini-loader"></div></div>`;

        }

    }

    function showResponse(text) {

        const responseArea = document.getElementById('gemini-response-area');

        if (responseArea) {

            responseArea.innerHTML = '';

            responseArea.innerText = text;

        }

    }

    function showError(message) {

        const responseArea = document.getElementById('gemini-response-area');

        if (responseArea) {

            responseArea.innerHTML = `<div class="gemini-error-message"><strong>出错了：</strong><br>${message}</div>`;

        }

    }

    function resetButtons() {

        const askBtn = document.getElementById('gemini-ask-btn');

        const cancelBtn = document.getElementById('gemini-cancel-btn');

        if (askBtn) {

            askBtn.disabled = false;

            askBtn.textContent = '发送';

        }

        if (cancelBtn) {

            cancelBtn.textContent = '取消';

        }

    }

    // --- 5. 样式 (shadcn/ui 风格) ---

    GM_addStyle(`

        :root {

            --background: 0 0% 100%; --foreground: 222.2 84% 4.9%;

            --card: 0 0% 100%; --card-foreground: 222.2 84% 4.9%;

            --popover: 0 0% 100%; --popover-foreground: 222.2 84% 4.9%;

            --primary: 222.2 47.4% 11.2%; --primary-foreground: 210 40% 98%;

            --secondary: 210 40% 96.1%; --secondary-foreground: 222.2 47.4% 11.2%;

            --muted: 210 40% 96.1%; --muted-foreground: 215.4 16.3% 46.9%;

            --border: 214.3 31.8% 91.4%; --input: 214.3 31.8% 91.4%;

            --destructive: 0 84.2% 60.2%;

            --radius: 0.5rem;

        }

        .gemini-context-menu {

            position: fixed; z-index: 2147483647; background-color: hsl(var(--popover));

            color: hsl(var(--popover-foreground)); border: 1px solid hsl(var(--border));

            border-radius: var(--radius); box-shadow: 0 4px 12px rgba(0,0,0,0.1);

            padding: 4px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;

            font-size: 14px;

        }

        .gemini-context-menu-item { padding: 6px 12px; cursor: pointer; border-radius: calc(var(--radius) - 2px); user-select: none; }

        .gemini-context-menu-item:hover { background-color: hsl(var(--secondary)); }

        .gemini-dialog-overlay {

            position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0,0,0,0.7);

            display: flex; align-items: center; justify-content: center; z-index: 2147483646;

            -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);

        }

        .gemini-dialog {

            background-color: hsl(var(--card)); color: hsl(var(--card-foreground)); border-radius: var(--radius);

            box-shadow: 0 8px 32px rgba(0,0,0,0.2); width: 90%; max-width: 500px;

            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;

            animation: gemini-dialog-fade-in 0.2s ease-out; display: flex; flex-direction: column; max-height: 80vh;

        }

        @keyframes gemini-dialog-fade-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }

        .gemini-dialog-header { padding: 24px 24px 0; }

        .gemini-dialog-content { padding: 16px 24px; overflow-y: auto; }

        .gemini-dialog-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 0 24px 24px; border-top: 1px solid hsl(var(--border)); margin-top: 16px; padding-top: 16px; }

        .gemini-dialog-title { font-size: 18px; font-weight: 600; margin: 0 0 12px 0; }

        .gemini-model-selector {

            display: flex; align-items: center; gap: 8px; margin-bottom: 8px;

        }

        .gemini-model-label {

            font-size: 14px; color: hsl(var(--foreground)); font-weight: 500;

        }

        .gemini-model-select {

            padding: 4px 8px; border: 1px solid hsl(var(--input)); border-radius: calc(var(--radius) - 2px);

            font-size: 14px; background-color: hsl(var(--background)); color: hsl(var(--foreground));

            cursor: pointer;

        }

        .gemini-model-select:focus {

            outline: none; border-color: hsl(var(--primary)); box-shadow: 0 0 0 2px hsl(var(--primary) / 0.2);

        }

        .gemini-dialog-preview-image {

            width: 100%; max-height: 200px; object-fit: contain; border-radius: calc(var(--radius) - 2px);

            margin-bottom: 16px; border: 1px solid hsl(var(--border));

        }

        .gemini-dialog-input {

            width: 100%; padding: 8px 12px; border: 1px solid hsl(var(--input)); border-radius: var(--radius);

            font-size: 14px; box-sizing: border-box; background-color: transparent; color: hsl(var(--foreground)); min-height: 80px;

        }

        .gemini-dialog-response {

            margin-top: 16px; padding: 12px; background-color: hsl(var(--muted)); border-radius: var(--radius);

            font-size: 14px; line-height: 1.5; min-height: 24px; white-space: pre-wrap;

            word-break: break-word;

        }

        .gemini-dialog-button {

            padding: 8px 16px; border: none; border-radius: var(--radius); font-size: 14px; font-weight: 500; cursor: pointer; transition: opacity 0.2s;

        }

        .gemini-dialog-button:disabled { cursor: not-allowed; opacity: 0.7; }

        .gemini-dialog-button-primary { background-color: hsl(var(--primary)); color: hsl(var(--primary-foreground)); }

        .gemini-dialog-button-secondary { background-color: hsl(var(--secondary)); color: hsl(var(--secondary-foreground)); }

        /* 加载动画和错误信息样式 */

        .gemini-loader-container { display: flex; justify-content: center; align-items: center; min-height: 48px; }

        .gemini-loader {

            display: inline-block; position: relative; width: 40px; height: 20px;

        }

        .gemini-loader::after, .gemini-loader::before {

            content: ''; position: absolute; width: 6px; height: 6px;

            border-radius: 50%; background-color: hsl(var(--muted-foreground));

            animation: gemini-loader-bounce 1.4s infinite ease-in-out both;

        }

        .gemini-loader::before { left: 8px; animation-delay: -0.32s; }

        .gemini-loader::after { left: 24px; animation-delay: -0.16s; }

        @keyframes gemini-loader-bounce {

            0%, 80%, 100% { transform: scale(0); }

            40% { transform: scale(1.0); }

        }

        .gemini-error-message {

            color: hsl(var(--destructive));

            white-space: pre-wrap;

            word-break: break-word;

        }

    `);

})();
