// ==UserScript==
// @name         图片选择框
// @namespace    https://github.com/botaothomaszhao/pkus-xny-ultra
// @version      v2.3
// @license      GPL-3.0
// @description  上传图片时可以从“相册上传”或“拍照上传”中选择。拍照选项通过带 capture 属性的 input 唤起系统相机。
// @author       botaothomaszhao
// @match        https://bdfz.xnykcxt.com:5002/*
// @exclude      https://bdfz.xnykcxt.com:5002/exam/pdf/web/viewer.html*
// @grant        GM_addStyle
// @run-at       document-body
// ==/UserScript==

(function () {
    'use strict';

    // 配置
    const CAPTURE_VALUE = 'environment'; // 唤起相机所用 capture 值
    const ACCEPT_VALUE = 'image/*'; // 可选，覆盖原 input 的 accept 属性

    GM_addStyle(`
        .iu-overlay {
            position: fixed;
            inset: 0;
            z-index: 2147483646;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            padding: 10px;
            box-sizing: border-box;
            background: rgba(0, 0, 0, 0.12);
        }
        .iu-panel {
            width: 100%;
            max-width: 720px;
            border-radius: 12px;
            background: #fff;
            border-top: 1px solid rgba(0, 0, 0, 0.06);
            border-right: 1px solid rgba(0, 0, 0, 0.06);
            overflow: hidden;
            display: flex;
            flex-direction: row;
            align-items: stretch;
        }
        .iu-buttons-col {
            flex: 1;
            display: flex;
            flex-direction: column;
        }
        .iu-panel button {
            width: 100%;
            flex: 1;
            padding: 14px;
            border: none;
            background: #fff;
            font-size: 16px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px; /* 图标和文字间距 */
            line-height: normal; 
        }
        .iu-buttons-col button + button {
            border-top: 1px solid rgba(0, 0, 0, 0.06);
        }
        .iu-panel button svg {
            display: block;
            transform: translateY(-1px); /* 图标高度微调 */
        }
        .iu-toggle-col {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 14px 10px;
            border-left: 1px solid rgba(0, 0, 0, 0.06);
            gap: 6px;
            position: relative;
        }
        .iu-toggle-track {
            width: 44px;
            height: 24px;
            border-radius: 12px;
            background: #ccc;
            position: relative;
            transition: background 0.2s;
            flex-shrink: 0;
            cursor: pointer;
            user-select: none;
        }
        .iu-toggle-track.on {
            background: #007aff;
        }
        .iu-toggle-thumb {
            position: absolute;
            top: 2px;
            left: 2px;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #fff;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
            transition: left 0.2s;
        }
        .iu-toggle-track.on .iu-toggle-thumb {
            left: 22px;
        }
        .iu-toggle-text {
            font-size: 11px;
            color: #888;
            text-align: center;
            line-height: 1.4;
            cursor: default;
            touch-action: manipulation;
        }
        .iu-toggle-tip {
            position: absolute;
            bottom: calc(100% + 8px);
            right: 0;
            background: rgba(0, 0, 0, 0.75);
            color: #fff;
            font-size: 12px;
            padding: 6px 10px;
            border-radius: 8px;
            white-space: nowrap;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.2s;
            z-index: 1;
        }
        .iu-toggle-tip.visible {
            opacity: 1;
        }
    `);

    // 相机和相册图标
    const ICON_CAMERA = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
        </svg>`;
    const ICON_IMAGE = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
        </svg>`;

    // 一次性 XHR 拦截器：拦截下一次发往 "enchance" 端点的请求，返回 mock 响应后立即还原。
    // ATTENTION: 新能源课程系统 API 路径为 enchance（非 enhance），严禁修改拼写。
    function installOneTimeMockInterceptor() {
        const origOpen = XMLHttpRequest.prototype.open;
        const origSend = XMLHttpRequest.prototype.send;
        let fired = false;

        function restore() {
            if (XMLHttpRequest.prototype.open === wrappedOpen) {
                XMLHttpRequest.prototype.open = origOpen;
            }
            if (XMLHttpRequest.prototype.send === wrappedSend) {
                XMLHttpRequest.prototype.send = origSend;
            }
        }

        function wrappedOpen(method, url) {
            if (!fired && typeof url === 'string' && url.endsWith('enchance')) {
                this._mockOnce = true;
            }
            origOpen.apply(this, arguments);
        }

        function wrappedSend() {
            if (this._mockOnce && !fired) {
                fired = true;
                restore();
                console.log('XHR Interceptor (one-time): Mocking enchance request');
                const mockResponse = { code: 1, message: "加速上传中…", time: Date.now(), extra: "" };
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
            origSend.apply(this, arguments);
        }

        XMLHttpRequest.prototype.open = wrappedOpen;
        XMLHttpRequest.prototype.send = wrappedSend;

        // 30 秒后若未触发则自动还原，避免影响其他请求
        setTimeout(() => { if (!fired) restore(); }, 30000);
    }

    // 将 File 注入 input 并触发 change
    function copyFilesToInput(files, input) {
        if (!input) return;
        const dt = new DataTransfer();
        for (const f of files) dt.items.add(f);
        input.files = dt.files;
        input.dispatchEvent(new Event('change', {bubbles: true}));
    }

    // 通用：创建临时 file input，并在选择后回填到 origInput
    // disableEnhance：若为 true，回填前安装一次性 XHR 拦截器跳过增强请求
    function openTempFilePickerAndCopyTo(origInput, capture, disableEnhance) {
        if (!origInput) return;
        const accept = ACCEPT_VALUE || origInput.getAttribute('accept');
        const multiple = origInput.hasAttribute('multiple');
        const temp = document.createElement('input');
        temp.type = 'file';
        temp.setAttribute('script-temp-file-input', 'true');
        temp.setAttribute('accept', accept);
        if (multiple) temp.setAttribute('multiple', '');
        if (capture) temp.setAttribute('capture', capture);
        Object.assign(temp.style, {
            position: 'fixed',
            left: '-9999px',
            top: '0',
            width: '1px',
            height: '1px',
            opacity: '0',
            zIndex: '2147483647'
        });
        document.body.appendChild(temp);
        temp.addEventListener('change', () => {
            try {
                if (temp.files?.length) {
                    if (disableEnhance) installOneTimeMockInterceptor();
                    copyFilesToInput(temp.files, origInput);
                }
            } finally {
                setTimeout(() => {
                    try {
                        temp.remove();
                    } catch (_) {
                    }
                }, 0);
            }
        }, {once: true});
        try {
            temp.click();
        } catch (_) {
        }
    }

    // history 管理（用于覆盖层返回）
    function popHandler() {
        // 当 history 发生变动（例如按返回），如果覆盖层仍在页面上则清理它。
        const el = document.getElementById('upload-chooser');
        try {
            el?._cleanup();
        } catch (_) {
        }
        removePopHandler();
    }

    function removePopHandler() {
        window.removeEventListener('popstate', popHandler);
    }

    function registerEsc(overlay) {
        try {
            overlay.tabIndex = -1;
            overlay.focus();
        } catch (_) {
        }
        const keyHandler = (e) => {
            if (e.key === 'Escape' || e.key === 'Esc') {
                try {
                    e.preventDefault();
                    e.stopPropagation();
                } catch (_) {
                }
                overlay._cleanup();
            }
        };
        overlay.addEventListener('keydown', keyHandler, true);
        overlay.addEventListener('keyup', keyHandler, true);
        overlay._keyHandler = keyHandler;
    }

    function cleanup(overlay) {
        try {
            if (overlay._keyHandler) {
                overlay.removeEventListener('keydown', overlay._keyHandler, true);
                overlay.removeEventListener('keyup', overlay._keyHandler, true);
            }
        } catch (_) {
        }
        try {
            overlay.remove();
        } catch (_) {
        }
        // 仅当当前 history.state 是之前 push 的上传选择器状态时，才回退历史记录。
        if (history.state?.uploadChooser) {
            try {
                history.back(); // 注意：back()是异步的，等待完成需要监听 popstate 事件
            } catch (_) {
            }
        }
        removePopHandler();
    }

    // 显示选择菜单（相册 / 相机）
    function showChoiceMenu(origInput) {
        if (!origInput) return;
        if (document.getElementById('upload-chooser')) return;

        const overlay = document.createElement('div');
        overlay.id = 'upload-chooser';
        overlay.className = 'iu-overlay';

        const panel = document.createElement('div');
        panel.className = 'iu-panel';

        // 创建带图标的按钮
        function mkBtn(text, iconSvg) {
            const b = document.createElement('button');
            b.type = 'button';
            b.innerHTML = iconSvg;
            b.appendChild(document.createTextNode(text));
            return b;
        }

        // 创建按钮并传入对应图标
        const btnGallery = mkBtn('相册上传', ICON_IMAGE);
        const btnCamera = mkBtn('拍照上传', ICON_CAMERA);

        // 按钮列（左侧）
        const buttonsCol = document.createElement('div');
        buttonsCol.className = 'iu-buttons-col';
        buttonsCol.appendChild(btnGallery);
        buttonsCol.appendChild(btnCamera);

        // 禁用增强切换开关（右侧），每次打开弹窗默认为关闭状态
        let toggleEnabled = false;

        const toggleCol = document.createElement('div');
        toggleCol.className = 'iu-toggle-col';

        const toggleTrack = document.createElement('div');
        toggleTrack.className = 'iu-toggle-track';
        const toggleThumb = document.createElement('div');
        toggleThumb.className = 'iu-toggle-thumb';
        toggleTrack.appendChild(toggleThumb);

        const toggleText = document.createElement('div');
        toggleText.className = 'iu-toggle-text';
        toggleText.textContent = '禁用增强 ⓘ';

        // 悬停/点击提示（兼容移动端触控笔/触屏）
        const toggleTip = document.createElement('div');
        toggleTip.className = 'iu-toggle-tip';
        toggleTip.textContent = '禁用图片增强以加快上传速度';

        let tipTimer = null;
        function showTip() {
            clearTimeout(tipTimer);
            toggleTip.classList.add('visible');
        }
        function hideTipAfter(ms) {
            clearTimeout(tipTimer);
            tipTimer = setTimeout(() => toggleTip.classList.remove('visible'), ms);
        }

        toggleText.addEventListener('pointerenter', (e) => {
            if (e.pointerType === 'mouse') showTip();
        });
        toggleText.addEventListener('pointerleave', (e) => {
            if (e.pointerType === 'mouse') hideTipAfter(200);
        });
        toggleText.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'touch' || e.pointerType === 'pen') {
                e.stopPropagation();
                showTip();
                hideTipAfter(2500);
            }
        });

        toggleCol.appendChild(toggleTip);
        toggleCol.appendChild(toggleTrack);
        toggleCol.appendChild(toggleText);

        toggleTrack.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleEnabled = !toggleEnabled;
            toggleTrack.classList.toggle('on', toggleEnabled);
        });

        panel.appendChild(buttonsCol);
        panel.appendChild(toggleCol);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        registerEsc(overlay);

        try {
            // 将一个标记性的 state 推入历史栈，便于后续通过 history.state 判断是否需要回退
            history.pushState({uploadChooser: true}, '');
            window.addEventListener('popstate', popHandler);
        } catch (err) {
            removePopHandler();
        }

        overlay._cleanup = () => cleanup(overlay);

        overlay.addEventListener('click', (ev) => {
            if (ev.target === overlay) {
                overlay._cleanup();
            }
        });

        btnGallery.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            overlay._cleanup();
            try {
                // 不传 capture，即打开系统文件选择器（相册）
                openTempFilePickerAndCopyTo(origInput, null, toggleEnabled);
            } catch (err) {
                console.warn('打开系统相册失败', err);
            }
        });

        btnCamera.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();
            overlay._cleanup();
            // 确保历史记录回退完成
            await new Promise((resolve) => window.addEventListener('popstate', resolve, {once: true}));
            try {
                openTempFilePickerAndCopyTo(origInput, CAPTURE_VALUE, toggleEnabled);
            } catch (err) {
                console.warn('打开相机失败', err);
            }
        });
    }

    function onCaptureInput(e) {
        const el = e.target;
        if (el.matches('input[type=file]') && !el.getAttribute('script-temp-file-input')) {
            e.preventDefault();
            e.stopImmediatePropagation();
            showChoiceMenu(el);
        }
    }

    document.addEventListener('click', onCaptureInput, true);
})();
