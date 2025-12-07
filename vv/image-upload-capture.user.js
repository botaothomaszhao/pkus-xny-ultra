// ==UserScript==
// @name         上传照片-系统相机
// @namespace    https://github.com/botaothomaszhao/pkus-xny-ultra
// @version      v2.1
// @license      GPL-3.0
// @description  上传照片时可以从“相册上传”或“拍照上传”选择。拍照选项通过带 capture 属性的 input 唤起系统相机。
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
        .iu-overlay{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:flex-end;justify-content:center;padding:10px;box-sizing:border-box;background:rgba(0,0,0,0.12)}
        .iu-panel{width:100%;max-width:720px;border-radius:12px;background:#fff;overflow:hidden}
        .iu-panel button{width:100%;padding:14px;border:none;border-top:1px solid rgba(0,0,0,0.06);background:#fff;font-size:16px;cursor:pointer}
    `);

    // 将 File 注入 input 并触发 change
    function copyFilesToInput(files, input) {
        if (!input) return;
        const dt = new DataTransfer();
        for (const f of files) dt.items.add(f);
        input.files = dt.files;
        input.dispatchEvent(new Event('change', {bubbles: true}));
    }

    // 通用：创建临时 file input，并在选择后回填到 origInput
    function openTempFilePickerAndCopyTo(origInput, capture) {
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
                if (temp.files?.length) copyFilesToInput(temp.files, origInput);
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
        // 仅当当前 history.state 是我们之前 push 的上传选择器状态时，才回退历史记录。
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

        function mkBtn(text) {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = text;
            return b;
        }

        const btnGallery = mkBtn('相册上传'), btnCamera = mkBtn('拍照上传');
        panel.appendChild(btnGallery);
        panel.appendChild(btnCamera);
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
                openTempFilePickerAndCopyTo(origInput, null);
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
                openTempFilePickerAndCopyTo(origInput, CAPTURE_VALUE);
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
