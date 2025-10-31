// ==UserScript==
// @name         拍照上传照片
// @namespace    https://github.com/botaothomaszhao/pkus-xny-ultra
// @version      vv.2.3
// @license      GPL-3.0
// @description  点击上传照片按钮时弹窗选择“从相册选择”或“从相机拍照”。改进相机界面：放弃强制 4:3 显示，使用摄像头原始预览尺寸按高度占满屏幕（左右留黑边），确保“所见即所得”——拍照后的图片尺寸和拍照前在屏幕上看到的一致。调整 UI：右上叉增大，拍照/切换/底部按钮的显示逻辑修复。保留文件注入逻辑。
// @match        https://bdfz.xnykcxt.com:5002/*
// @grant        none
// @run-at       document-body
// ==/UserScript==

(function () {
    'use strict';

    function setStyles(el, styles) {
        for (const k in styles) {
            try { el.style[k] = styles[k]; } catch (_) {}
        }
    }
    function removeIfExists(id) {
        const el = document.getElementById(id);
        if (el) try { el.remove(); } catch (_) {}
    }

    let chooserHistoryPushed = false;
    let suppressNextPop = false;

    function copyFilesToInput(files, input) {
        const dt = new DataTransfer();
        for (const f of files) dt.items.add(f);
        input.files = dt.files;
        input.dispatchEvent(new Event('change', {bubbles: true}));
    }

    function openSystemFilePickerAndCopyTo(origInput) {
        if (!origInput) return;
        const accept = origInput.getAttribute('data-orig-accept') || origInput.getAttribute('accept') || '';
        const multiple = origInput.hasAttribute('multiple');

        const temp = document.createElement('input');
        temp.type = 'file';
        if (accept) temp.setAttribute('accept', accept);
        if (multiple) temp.setAttribute('multiple', '');
        Object.assign(temp.style, {
            position: 'fixed', left: '-9999px', top: '0', width: '1px', height: '1px', opacity: '0', zIndex: '2147483647',
        });
        document.body.appendChild(temp);

        const onChange = () => {
            try {
                if (temp.files && temp.files.length) copyFilesToInput(Array.from(temp.files), origInput);
            } finally {
                temp.removeEventListener('change', onChange);
                setTimeout(() => { try { temp.remove(); } catch (_) {} }, 0);
            }
        };
        temp.addEventListener('change', onChange, {once: true});
        try { temp.click(); } catch (err) {}
    }

    function chooserPopHandler() {
        if (suppressNextPop) { suppressNextPop = false; return; }
        removeIfExists('upload-chooser');
        removeChooserPopHandler();
    }
    function removeChooserPopHandler() {
        window.removeEventListener('popstate', chooserPopHandler);
        chooserHistoryPushed = false;
        suppressNextPop = false;
    }

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

        try { overlay.tabIndex = -1; overlay.focus(); } catch (_) {}
        const chooserKeyHandler = (e) => {
            const isEsc = e.key === 'Escape' || e.key === 'Esc';
            if (!isEsc) return;
            try { e.preventDefault(); e.stopPropagation(); } catch (_) {}
            closeOverlayAndRestoreHistory();
        };
        overlay.addEventListener('keydown', chooserKeyHandler, true);
        overlay._keyHandler = chooserKeyHandler;

        try {
            window.addEventListener('popstate', chooserPopHandler);
            history.pushState({uploadChooser: true}, '');
            chooserHistoryPushed = true;
        } catch (err) {
            chooserHistoryPushed = false;
            window.removeEventListener('popstate', chooserPopHandler);
        }

        function closeOverlayAndRestoreHistory() {
            try { if (overlay && overlay._keyHandler) overlay.removeEventListener('keydown', overlay._keyHandler, true); } catch (_) {}
            removeIfExists('upload-chooser');
            if (chooserHistoryPushed) {
                suppressNextPop = true;
                try { history.back(); } catch (_) {}
            }
            removeChooserPopHandler();
        }

        overlay.addEventListener('click', (ev) => { if (ev.target === overlay) closeOverlayAndRestoreHistory(); });

        btnGallery.addEventListener('click', (e) => {
            e.stopPropagation(); e.preventDefault();
            closeOverlayAndRestoreHistory();
            try { openSystemFilePickerAndCopyTo(origInput); } catch (err) { console.warn('打开系统相册失败', err); }
        });

        btnCamera.addEventListener('click', (e) => {
            e.stopPropagation(); e.preventDefault();
            closeOverlayAndRestoreHistory();
            openCameraOverlay(origInput);
        });
    }

    // 关键改动说明 (故事化叙述):
    // 我放弃了之前强制把画面变为 4:3 的做法，改为使用摄像头的原始预览尺寸来渲染预览区域，
    // 并把预览区域按高度撑满屏幕（height:100vh），宽度据视频原始纵横比自动计算并居中，
    // 这样“所见即所得”：拍照时从 video 的真实像素尺寸生成图片，且图片与拍照前屏幕上看到的构图一致。
    // 为实现这一点，我在 startStream 成功后会根据 video.videoWidth/video.videoHeight 去调整 frame 的实际显示尺寸（按 height:100vh 缩放）。
    // 我还把右上叉放大了一些，确保拍照后的预览和切换摄像头按钮行为一致：拍照后隐藏切换按钮和快门；重拍时恢复。
    // 下面是具体实现（已直接写入脚本）。

    function openCameraOverlay(origInput) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert('当前浏览器不支持拍照');
            return;
        }
        if (document.getElementById('media-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'media-overlay';
        setStyles(overlay, {
            position: 'fixed', left: '0', top: '0', right: '0', bottom: '0',
            zIndex: '2147483647', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0', boxSizing: 'border-box'
        });

        const container = document.createElement('div');
        container.id = 'media-container';
        setStyles(container, {
            position: 'relative',
            width: '100%',
            height: '100vh', // fill screen height
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            boxSizing: 'border-box'
        });

        // frame: 不再强制某一比例，改为按 video 原始比例调整宽度（height 固定 100vh）
        const frame = document.createElement('div');
        frame.id = 'media-frame';
        setStyles(frame, {
            height: '100vh',
            width: 'auto', // will be computed after video metadata available
            background: '#000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
        });

        const video = document.createElement('video');
        video.id = 'media-video';
        video.autoplay = true;
        video.playsInline = true;
        setStyles(video, {width: '100%', height: '100%', objectFit: 'cover', background: '#000', display: 'block'});

        const canvas = document.createElement('canvas');
        canvas.id = 'media-canvas';
        setStyles(canvas, {display: 'none', width: '100%', height: '100%'});

        frame.appendChild(video);
        frame.appendChild(canvas);

        // 右侧控件区（覆盖黑边）
        const rightBar = document.createElement('div');
        rightBar.id = 'media-rightbar';
        setStyles(rightBar, {
            position: 'absolute',
            right: '8px',
            top: '0',
            bottom: '0',
            width: '96px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '18px',
            padding: '18px 6px',
            boxSizing: 'border-box',
            pointerEvents: 'auto'
        });

        // 右上叉（增大）
        const btnCancel = document.createElement('button');
        btnCancel.type = 'button';
        btnCancel.id = 'btn-cancel';
        btnCancel.title = '取消';
        setStyles(btnCancel, {
            position: 'absolute', right: '12px', top: '12px',
            width: '48px', height: '48px', borderRadius: '24px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', background: 'rgba(0,0,0,0.36)', color: '#fff', cursor: 'pointer', padding: '6px', boxSizing: 'border-box'
        });
        btnCancel.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

        function makeIconButtonWithSVG(svgContent, sizeW = 44, sizeH = 44, title) {
            const b = document.createElement('button');
            b.type = 'button';
            b.title = title || '';
            setStyles(b, {
                width: sizeW + 'px', height: sizeH + 'px', borderRadius: (sizeW/2) + 'px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px solid rgba(255,255,255,0.9)', background: 'rgba(0,0,0,0.28)',
                color: '#fff', cursor: 'pointer', padding: '6px', boxSizing: 'border-box'
            });
            b.innerHTML = svgContent;
            return b;
        }

        // 双半圆箭头 SVG（flip）
        const flipSvg = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M21 12a9 9 0 0 0-9-9" />' +
            '<path d="M3 12a9 9 0 0 0 9 9" />' +
            '<polyline points="16 3 21 3 21 8" />' +
            '<polyline points="8 21 3 21 3 16" />' +
            '</svg>';
        const btnSwitch = makeIconButtonWithSVG(flipSvg, 52, 52, '切换摄像头');

        // 缩小快门（保持合适尺寸）
        const btnShutter = document.createElement('button');
        btnShutter.type = 'button';
        btnShutter.id = 'btn-shutter';
        setStyles(btnShutter, {
            width: '56px', height: '56px', borderRadius: '28px',
            background: '#fff', border: '4px solid rgba(255,255,255,0.85)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.35)', cursor: 'pointer', padding: '0'
        });

        // 底部区域：重拍/确认（更宽）
        const bottomBar = document.createElement('div');
        bottomBar.id = 'media-bottombar';
        setStyles(bottomBar, {
            position: 'absolute',
            bottom: '22px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '18px',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: '3',
            pointerEvents: 'auto'
        });

        const btnRetake = document.createElement('button');
        btnRetake.type = 'button';
        btnRetake.id = 'btn-retake';
        btnRetake.textContent = '重拍';
        setStyles(btnRetake, {
            padding: '12px 40px', borderRadius: '8px', border: 'none',
            background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '16px', cursor: 'pointer'
        });

        const btnConfirm = document.createElement('button');
        btnConfirm.type = 'button';
        btnConfirm.id = 'btn-confirm';
        btnConfirm.textContent = '确定';
        setStyles(btnConfirm, {
            padding: '12px 40px', borderRadius: '8px', border: 'none',
            background: '#fff', color: '#000', fontSize: '16px', cursor: 'pointer'
        });

        rightBar.appendChild(btnSwitch);
        rightBar.appendChild(btnShutter);

        bottomBar.appendChild(btnRetake);
        bottomBar.appendChild(btnConfirm);

        container.appendChild(frame);
        container.appendChild(rightBar);
        container.appendChild(btnCancel);
        overlay.appendChild(container);
        overlay.appendChild(bottomBar);
        document.body.appendChild(overlay);

        let stream = null;
        let facingMode = 'environment';
        let lastBlob = null;
        let isPreview = false;

        function stopStreamTracks() { try { if (stream) stream.getTracks().forEach(t => t.stop()); } catch (_) {} stream = null; }

        // 调整 frame 宽度以保持 video 的原始纵横比并使高度为 100vh（所见即所得）
        function adjustFrameToVideo() {
            try {
                const vw = video.videoWidth;
                const vh = video.videoHeight;
                if (!vw || !vh) return;
                const scale = (window.innerHeight) / vh; // we set height to 100vh, so scale = height/vh
                const displayWidth = Math.round(vw * scale);
                frame.style.width = displayWidth + 'px';
                // ensure video fills frame
                setStyles(video, {width: '100%', height: '100%', objectFit: 'cover', display: 'block'});
                // hide canvas if any
                canvas.style.display = 'none';
            } catch (_) {}
        }

        // Start stream and ensure video shows immediately. After metadataloaded or playing, adjust frame.
        async function startStream() {
            stopStreamTracks();
            const constraints = {
                video: {
                    facingMode: { ideal: facingMode },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: false
            };
            try {
                stream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (err) {
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facingMode } }, audio: false });
            }
            video.srcObject = stream;
            video.style.display = 'block';
            canvas.style.display = 'none';

            // wait for metadata to know videoWidth/videoHeight
            await new Promise((resolve) => {
                if (video.readyState >= 1 && video.videoWidth && video.videoHeight) return resolve();
                const onMeta = () => { video.removeEventListener('loadedmetadata', onMeta); resolve(); };
                video.addEventListener('loadedmetadata', onMeta, {once: true});
                // fallback: if loadedmetadata doesn't fire, try play event
                setTimeout(resolve, 600);
            });

            // ensure play called
            await video.play().catch((e) => { console.warn('video.play() rejected', e); });

            // adjust frame so displayed preview matches intrinsic aspect ratio scaled to height
            adjustFrameToVideo();

            isPreview = false;
            // ensure UI state
            btnShutter.style.display = '';
            btnSwitch.style.display = '';
            btnRetake.style.display = 'none';
            btnConfirm.style.display = 'none';
        }

        function cleanup() {
            try { if (overlay && overlay._keyHandler) overlay.removeEventListener('keydown', overlay._keyHandler, true); } catch (_) {}
            stopStreamTracks();
            try { overlay.remove(); } catch (_) {}
        }

        overlay._cleanup = cleanup;

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
            // For WYSIWYG: capture the exact visible area of video as displayed.
            // video intrinsic size: video.videoWidth x video.videoHeight
            // displayed size: frame clientWidth x frame clientHeight (frame height == window.innerHeight)
            // We'll compute scale factor and draw full intrinsic video (so saved image corresponds to what was shown,
            // because displayed area is a scaled version of intrinsic)
            const vw = video.videoWidth || 1280;
            const vh = video.videoHeight || 720;
            canvas.width = vw;
            canvas.height = vh;
            const ctx = canvas.getContext('2d');
            // draw the full intrinsic image (the displayed composition is a scaled crop/cover of this),
            // because we adjusted frame to match intrinsic aspect ratio scaled to height, the full intrinsic corresponds to what's shown.
            ctx.drawImage(video, 0, 0, vw, vh);
            return new Promise((resolve) => canvas.toBlob(blob => resolve(blob), 'image/jpeg', 1));
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
                isPreview = true;
                lastBlob = blob;
                // hide switch & shutter while previewing
                btnSwitch.style.display = 'none';
                btnShutter.style.display = 'none';
                // show bottom buttons
                btnRetake.style.display = 'inline-block';
                btnConfirm.style.display = 'inline-block';
                URL.revokeObjectURL(url);
            };
            img.onerror = () => { try { URL.revokeObjectURL(url); } catch (_) {} };
            img.src = url;
        }

        // initialize visibility
        btnRetake.style.display = 'none';
        btnConfirm.style.display = 'none';

        btnShutter.addEventListener('click', async () => {
            btnShutter.disabled = true;
            try {
                const blob = await captureOnce();
                if (!blob) { alert('拍照失败'); return; }
                showPreview(blob);
            } finally {
                btnShutter.disabled = false;
            }
        });

        btnRetake.addEventListener('click', async () => {
            lastBlob = null;
            canvas.style.display = 'none';
            video.style.display = 'block';
            isPreview = false;
            btnRetake.style.display = 'none';
            btnConfirm.style.display = 'none';
            btnSwitch.style.display = '';
            btnShutter.style.display = '';
            // restart stream if stopped or re-adjust frame to current video dims
            if (!stream) {
                await startStream();
            } else {
                adjustFrameToVideo();
            }
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
            try {
                await startStream();
            } catch (err) {
                console.error('切换摄像头失败', err);
                alert('无法切换摄像头');
            }
        });

        overlay.addEventListener('click', (ev) => { if (ev.target === overlay) cleanup(); });

        // start stream initially
        startStream().catch(err => {
            console.error('getUserMedia error', err);
            alert('无法访问摄像头');
            cleanup();
        });

        // on resize, re-adjust frame width to keep video height = viewport height
        window.addEventListener('resize', () => {
            try {
                if (video && video.videoWidth && video.videoHeight && !isPreview) adjustFrameToVideo();
            } catch (_) {}
        });
    }

    // event delegation for .paizhao-btn
    function findPaizhaoContextFromEvent(e) {
        try {
            const path = (e.composedPath && e.composedPath()) || (e.path && e.path.slice());
            if (path && path.length) {
                for (const node of path) {
                    if (!node || !node.classList) continue;
                    if (node.classList.contains && node.classList.contains('paizhao-btn')) return node;
                }
            }
        } catch (err) {}
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
            try { e.preventDefault(); e.stopPropagation(); } catch (err) {}
            showChoiceMenu(input);
        } catch (err) {
            console.error('image-upload: onPaizhaoTrigger error', err);
        }
    }

    document.addEventListener('click', onPaizhaoTrigger, true);

})();
