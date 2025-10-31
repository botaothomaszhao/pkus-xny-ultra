// ==UserScript==
// @name         拍照上传照片
// @namespace    https://github.com/botaothomaszhao/pkus-xny-ultra
// @version      vv.2.2
// @license      GPL-3.0
// @description  点击上传照片按钮时弹窗选择“从相册选择”或“从相机拍照”，在网页内实现拍照功能，解决Via浏览器capture字段不生效问题
// @match        https://bdfz.xnykcxt.com:5002/*
// @grant        none
// @run-at       document-body
// ==/UserScript==

(function () {
    'use strict';

    // 辅助：批量应用样式
    function setStyles(el, styles) {
        for (const k in styles) {
            try { el.style[k] = styles[k]; } catch (_) {}
        }
    }

    // 辅助：安全移除指定 id 元素
    function removeIfExists(id) {
        const el = document.getElementById(id);
        if (el) {
            try { el.remove(); } catch (_) {}
        }
    }

    // 历史/popstate 管理（用于拦截返回键）
    let chooserHistoryPushed = false;
    let suppressNextPop = false;

    // 把 File 塞回指定 input 并触发 change
    function copyFilesToInput(files, input) {
        const dt = new DataTransfer();
        for (const f of files) dt.items.add(f);
        input.files = dt.files;
        input.dispatchEvent(new Event('change', {bubbles: true}));
    }

    // 在用户激活的事件处理里同步唤起系统文件选择器。
    function openSystemFilePickerAndCopyTo(origInput) {
        if (!origInput) return;
        const accept = origInput.getAttribute('data-orig-accept') || origInput.getAttribute('accept') || '';
        const multiple = origInput.hasAttribute('multiple');

        // 创建临时 input（fallback），不使用 display:none
        const temp = document.createElement('input');
        temp.type = 'file';
        if (accept) temp.setAttribute('accept', accept);
        if (multiple) temp.setAttribute('multiple', '');
        Object.assign(temp.style, {
            position: 'fixed',
            left: '-9999px',
            top: '0',
            width: '1px',
            height: '1px',
            opacity: '0',
            zIndex: '2147483647',
        });
        document.body.appendChild(temp);

        const onChange = () => {
            try {
                if (temp.files && temp.files.length) {
                    copyFilesToInput(Array.from(temp.files), origInput);
                }
            } finally {
                temp.removeEventListener('change', onChange);
                setTimeout(() => {
                    try {
                        temp.remove();
                    } catch (_) {
                    }
                }, 0);
            }
        };
        temp.addEventListener('change', onChange, {once: true});

        try {
            temp.click();
        } catch (err) {
        }
    }
    function chooserPopHandler() {
                // If we are programmatically suppressing this pop (caused by our own history.back()), ignore
                if (suppressNextPop) {
                    suppressNextPop = false;
                    return;
                }

                // If overlay still exists, close it (user pressed back)
                removeIfExists('upload-chooser');
                // cleanup listener because menu is closed
                removeChooserPopHandler();
            };

    // 清理 popstate 监听
    function removeChooserPopHandler() {
        window.removeEventListener('popstate', chooserPopHandler);
        chooserHistoryPushed = false;
        suppressNextPop = false;
    }

    // 简单的选择菜单：保持非常轻量，点击从相册时立即移除菜单并同步打开文件选择器
    function showChoiceMenu(origInput) {
        if (!origInput) return;
        if (document.getElementById('upload-chooser')) return;

        const overlay = document.createElement('div');
        overlay.id = 'upload-chooser';
        setStyles(overlay, {
            position: 'fixed', left: '0', top: '0', right: '0', bottom: '0',
            zIndex: '2147483646', background: 'rgba(0,0,0,0.12)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            padding: '10px', boxSizing: 'border-box'
        });

        const panel = document.createElement('div');
        setStyles(panel, {width: '100%', maxWidth: '720px', borderRadius: '12px', background: '#fff', overflow: 'hidden'});

        function makeButton(text, bg) {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = text;
            setStyles(b, {width: '100%', padding: '14px', border: 'none', borderTop: '1px solid rgba(0,0,0,0.06)', background: bg || '#fff', fontSize: '16px', cursor: 'pointer'});
            return b;
        }

        const btnGallery = makeButton('从相册选择');
        const btnCamera = makeButton('从相机拍照');

        panel.appendChild(btnGallery);
        panel.appendChild(btnCamera);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        // 使 overlay 可聚焦以捕获键盘事件，并注册 Esc 键处理器到该弹窗
        try {
            overlay.tabIndex = -1;
            overlay.focus();
        } catch (_) {}
        const chooserKeyHandler = (e) => {
            const isEsc = e.key === 'Escape' || e.key === 'Esc';
            if (!isEsc) return;
            try { e.preventDefault(); e.stopPropagation(); } catch (_) {}
            closeOverlayAndRestoreHistory();
        };
        overlay.addEventListener('keydown', chooserKeyHandler, true);
        overlay._keyHandler = chooserKeyHandler;

        // push history state so that back button will close menu (we will later remove this pushed state)
        try {
            window.addEventListener('popstate', chooserPopHandler);
            history.pushState({uploadChooser: true}, '');
            chooserHistoryPushed = true;
        } catch (err) {
            // pushState might fail in some environments; that's okay — we'll still try to behave normally
            chooserHistoryPushed = false;
            window.removeEventListener('popstate', chooserPopHandler);
        }

        // helper to close overlay and restore history (if we pushed one)
        function closeOverlayAndRestoreHistory() {
            // 移除注册的键盘处理器
            try { if (overlay && overlay._keyHandler) overlay.removeEventListener('keydown', overlay._keyHandler, true); } catch (_) {}
            removeIfExists('upload-chooser');
            if (chooserHistoryPushed) {
                // prevent our popstate handler from reacting to the history.back() we'll call now
                suppressNextPop = true;
                try {
                    history.back();
                } catch (_) { /* ignore */ }
            }
            removeChooserPopHandler();
        }

        // 点击背景区域关闭菜单
        overlay.addEventListener('click', (ev) => {
            if (ev.target === overlay) {
                closeOverlayAndRestoreHistory();
            }
        });

        // 从相册：立即移除菜单（同步），然后在同一用户事件处理链里唤起文件选择器，避免闪烁或菜单残留
        btnGallery.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            closeOverlayAndRestoreHistory();
            try {
                openSystemFilePickerAndCopyTo(origInput);
            } catch (err) {
                console.warn('打开系统相册失败', err);
            }
        });

        // 相机：立即移除菜单并打开内置相机覆盖层
        btnCamera.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            closeOverlayAndRestoreHistory();
            openCameraOverlay(origInput);
        });
    }

    // 相机拍照覆盖层（保持原有实现）
    function openCameraOverlay(origInput) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert('当前浏览器不支持拍照');
            return;
        }

        if (document.getElementById('media-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'media-overlay';
        setStyles(overlay, {position: 'fixed', left: '0', top: '0', right: '0', bottom: '0', zIndex: '2147483647', background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px', padding: '12px', boxSizing: 'border-box', color: '#fff'});

        overlay.innerHTML = `
      <div style="width:100%;max-width:720px;aspect-ratio:3/4;background:#000;position:relative;border-radius:12px;overflow:hidden;display:flex;align-items:center;justify-content:center">
        <video id="media-video" autoplay playsinline style="width:100%;height:100%;object-fit:cover;background:#000"></video>
        <canvas id="media-canvas" style="display:none"></canvas>
      </div>
    `;

        const controls = document.createElement('div');
        setStyles(controls, {display: 'flex', width: '100%', maxWidth: '720px', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginTop: '6px'});

        function makeBtn(text, bg) {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = text;
            setStyles(b, {flex: '1', padding: '12px', fontSize: '15px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: bg, color: '#fff'});
            return b;
        }

        const btnSwitch = makeBtn('切换摄像头', '#2d9c59');
        const btnCapture = makeBtn('拍照', '#1f8ef1');
        const btnRetake = makeBtn('重拍', '#666');
        const btnConfirm = makeBtn('确定', '#f39c12');
        const btnCancel = makeBtn('取消', '#e74c3c');

        controls.appendChild(btnSwitch);
        controls.appendChild(btnCapture);
        controls.appendChild(btnCancel);

        overlay.appendChild(controls);
        document.body.appendChild(overlay);

        const video = overlay.querySelector('#media-video');
        const canvas = overlay.querySelector('#media-canvas');

        let stream = null;
        let facingMode = 'environment';
        let lastBlob = null;

        async function startStream() {
            if (stream) {
                stream.getTracks().forEach(t => t.stop());
                stream = null;
            }
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: {ideal: facingMode},
                    width: {ideal: 1280},
                    height: {ideal: 720}
                }, audio: false
            });
            video.srcObject = stream;
            await video.play();
        }

        function cleanup() {
            try { if (overlay && overlay._keyHandler) overlay.removeEventListener('keydown', overlay._keyHandler, true); } catch (_) {}
            try { if (stream) stream.getTracks().forEach(t => t.stop()); } catch (_) {}
            try { overlay.remove(); } catch (_) {}
        }

        // expose cleanup so overlay 内部或外部能关闭 media overlay
        overlay._cleanup = cleanup;

        // 使 overlay 可聚焦以捕获键盘事件，并注册 Esc 键处理器到该弹窗
        try { overlay.tabIndex = -1; overlay.focus(); } catch (_) {}
        const mediaKeyHandler = (e) => {
            const isEsc = e.key === 'Escape' || e.key === 'Esc';
            if (!isEsc) return;
            try { e.preventDefault(); e.stopPropagation(); } catch (_) {}
            cleanup();
        };
        overlay.addEventListener('keydown', mediaKeyHandler, true);
        overlay._keyHandler = mediaKeyHandler;

        async function captureOnce() {
            const vw = video.videoWidth || 1280;
            const vh = video.videoHeight || 720;
            canvas.width = vw;
            canvas.height = vh;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, vw, vh);
            return new Promise((resolve) => canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.95));
        }

        function showPreview(blob) {
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
                const ctx = canvas.getContext('2d');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                ctx.drawImage(img, 0, 0);
                video.style.display = 'none';
                canvas.style.display = 'block';
                controls.innerHTML = '';
                controls.appendChild(btnRetake);
                controls.appendChild(btnConfirm);
                controls.appendChild(btnCancel);
                URL.revokeObjectURL(url);
            };
            img.onerror = () => {
                try {
                    URL.revokeObjectURL(url);
                } catch (_) {
                }
            };
            img.src = url;
        }

        btnCapture.addEventListener('click', async () => {
            btnCapture.disabled = true;
            const blob = await captureOnce();
            btnCapture.disabled = false;
            if (!blob) {
                alert('拍照失败');
                return;
            }
            lastBlob = blob;
            showPreview(blob);
        });

        btnRetake.addEventListener('click', async () => {
            canvas.style.display = 'none';
            video.style.display = 'block';
            controls.innerHTML = '';
            controls.appendChild(btnSwitch);
            controls.appendChild(btnCapture);
            controls.appendChild(btnCancel);
            if (!stream) await startStream();
        });

        btnConfirm.addEventListener('click', () => {
            if (!lastBlob) return;
            const file = new File([lastBlob], `photo_${Date.now()}.jpg`, {
                type: lastBlob.type || 'image/jpeg',
                lastModified: Date.now()
            });
            copyFilesToInput([file], origInput);
            cleanup();
        });

        btnCancel.addEventListener('click', cleanup);
        btnSwitch.addEventListener('click', async () => {
            facingMode = (facingMode === 'environment') ? 'user' : 'environment';
            await startStream();
        });
        overlay.addEventListener('click', (ev) => { if (ev.target === overlay) cleanup(); });

        startStream().catch(err => {
            console.error('getUserMedia error', err);
            alert('无法访问摄像头');
            cleanup();
        });
    }

    // 事件委托：拦截 .paizhao-btn 的点击（支持 shadow DOM）
    function findPaizhaoContextFromEvent(e) {
        try {
            const path = (e.composedPath && e.composedPath()) || (e.path && e.path.slice());
            if (path && path.length) {
                for (const node of path) {
                    if (!node || !node.classList) continue;
                    if (node.classList && node.classList.contains && node.classList.contains('paizhao-btn')) {
                        return node;
                    }
                }
            }
        } catch (err) {
            // ignore
        }

        let el = e.target;
        while (el) {
            if (el.classList && el.classList.contains && el.classList.contains('paizhao-btn')) return el;
            el = el.parentElement;
        }
        return null;
    }

    function onPaizhaoTrigger(e) {
        try {
            const root = findPaizhaoContextFromEvent(e);
            if (!root) return;
            const btn = (e.target && e.target.closest && e.target.closest('.paizhao-btn button')) || root.querySelector('button');
            if (!btn) return;

            const input = root.querySelector('input[type="file"]');
            if (!input) return;

            try {
                e.preventDefault();
                e.stopPropagation();
            } catch (err) {
            }
            showChoiceMenu(input);
        } catch (err) {
            console.error('image-upload: onPaizhaoTrigger error', err);
        }
    }

    // 监听 click/pointerdown/mousedown 三类事件以覆盖不同环境
    document.addEventListener('click', onPaizhaoTrigger, true);
})();
