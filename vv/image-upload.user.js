// ==UserScript==
// @name         拍照上传照片
// @namespace    https://github.com/botaothomaszhao/pkus-xny-ultra
// @version      vv.2.7
// @license      GPL-3.0
// @description  点击上传照片按钮时弹窗选择“从相册选择”或“从相机拍照”，在网页内实现拍照功能，解决浏览器无法唤起相机的问题。
// @author       botaothomaszhao
// @match        https://bdfz.xnykcxt.com:5002/*
// @exclude      https://bdfz.xnykcxt.com:5002/exam/pdf/web/viewer.html*
// @grant        GM_addStyle
// @run-at       document-body
// ==/UserScript==

(function () {
    'use strict';

    // 配置
    const CAPTURE_WIDTH = 1920; // 请求的宽度（必填）
    const CAPTURE_HEIGHT = 1080; // 请求的高度（必填）
    const CAPTURE_FRAME_RATE = 30; // 请求的帧率（可选：若为 null 则不添加 frameRate 约束）

    GM_addStyle(`
        .iu-overlay{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:flex-end;justify-content:center;padding:10px;box-sizing:border-box;background:rgba(0,0,0,0.12)}
        .iu-panel{width:100%;max-width:720px;border-radius:12px;background:#fff;overflow:hidden}
        .iu-panel button{width:100%;padding:14px;border:none;border-top:1px solid rgba(0,0,0,0.06);background:#fff;font-size:16px;cursor:pointer}
    
        .iu-media-overlay{position:fixed;inset:0;z-index:2147483647;background:#000;display:flex;align-items:center;justify-content:center;padding:0;box-sizing:border-box}
        .iu-container{position:relative;width:100%;height:100vh;display:flex;align-items:center;justify-content:center;overflow:hidden;box-sizing:border-box}
        .iu-frame{height:100vh;width:auto;background:#000;display:flex;align-items:center;justify-content:center;position:relative}
        .iu-video,.iu-canvas{width:100%;height:100%;object-fit:cover;background:#000;display:block}
        .iu-canvas{display:none}
        .iu-rightbar{position:absolute;right:8px;top:0;bottom:0;width:96px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:18px 6px;box-sizing:border-box;pointer-events:auto}
        .iu-btn-top{position:absolute;right:12px;top:12px;width:48px;height:48px;border-radius:24px;display:flex;align-items:center;justify-content:center;border:none;background:rgba(0,0,0,0.36);color:#fff;cursor:pointer;padding:6px;box-sizing:border-box;font-size:22px}
        .iu-switch{width:52px;height:52px;border-radius:26px;display:flex;align-items:center;justify-content:center;border:2px solid rgba(255,255,255,0.9);background:rgba(0,0,0,0.28);color:#fff;cursor:pointer;padding:6px;box-sizing:border-box}
        .iu-shutter{width:56px;height:56px;border-radius:28px;background:#fff;border:4px solid rgba(255,255,255,0.85);box-shadow:0 2px 6px rgba(0,0,0,0.35);cursor:pointer;padding:0}
        .iu-bottombar{position:absolute;bottom:22px;left:50%;transform:translateX(-50%);display:flex;gap:18px;align-items:center;justify-content:center;z-index:3;pointer-events:auto}
        .iu-retake,.iu-confirm{padding:12px 80px;border-radius:8px;border:none;font-size:16px;cursor:pointer}
        .iu-retake{background:rgba(0,0,0,0.6);color:#fff}
        .iu-confirm{background:#fff;color:#000}
    `);

    // 安全移除元素并可执行自定义清理
    function removeIf(id, doCleanup) {
        const el = document.getElementById(id);
        if (!el) return;
        try {
            if (doCleanup && typeof el._cleanup === 'function') el._cleanup(true);
            el.remove();
        } catch (_) {
        }
    }

    // 将 File 注入 input 并触发 change
    function copyFilesToInput(files, input) {
        if (!input) return;
        const dt = new DataTransfer();
        files.forEach(f => dt.items.add(f));
        input.files = dt.files;
        input.dispatchEvent(new Event('change', {bubbles: true}));
    }

    // 在用户手势中唤起系统文件选择器并回填
    function openSystemFilePickerAndCopyTo(origInput) {
        if (!origInput) return;
        const accept = origInput.getAttribute('data-orig-accept') || origInput.getAttribute('accept') || '';
        const multiple = origInput.hasAttribute('multiple');
        const temp = document.createElement('input');
        temp.type = 'file';
        temp.setAttribute('script-temp-file-input', 'true'); // 给temp添加标签以在监听时区分
        if (accept) temp.setAttribute('accept', accept);
        if (multiple) temp.setAttribute('multiple', '');
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
        const onChange = () => {
            try {
                if (temp.files && temp.files.length) copyFilesToInput(Array.from(temp.files), origInput);
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
        } catch (_) {
        }
    }

    // history 管理
    let chooserHistoryPushed = false;
    let suppressNextPop = false;

    function chooserPopHandler() {
        if (suppressNextPop) {
            suppressNextPop = false;
            return;
        }
        removeIf('upload-chooser', true);
        removeIf('media-overlay', true);
        removeChooserPopHandler();
    }

    function removeChooserPopHandler() {
        window.removeEventListener('popstate', chooserPopHandler);
        chooserHistoryPushed = false;
        suppressNextPop = false;
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

    function cleanup(overlay, fromPop) {
        try {
            if (overlay && overlay._keyHandler) {
                overlay.removeEventListener('keydown', overlay._keyHandler, true);
                overlay.removeEventListener('keyup', overlay._keyHandler, true);
            }
        } catch (_) {
        }
        try {
            overlay.remove();
        } catch (_) {
        }
        if (!fromPop && chooserHistoryPushed) {
            suppressNextPop = true;
            try {
                history.back();
            } catch (_) {
            }
        }
        removeChooserPopHandler();
    }

    // 显示选择菜单
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

        const btnGallery = mkBtn('从相册选择'), btnCamera = mkBtn('从相机拍照');
        panel.appendChild(btnGallery);
        panel.appendChild(btnCamera);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        registerEsc(overlay);

        try {
            window.addEventListener('popstate', chooserPopHandler);
            history.pushState({uploadChooser: true}, '');
            chooserHistoryPushed = true;
        } catch (err) {
            chooserHistoryPushed = false;
            window.removeEventListener('popstate', chooserPopHandler);
        }

        overlay._cleanup = (fromPop) => cleanup(overlay, fromPop);

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
                openSystemFilePickerAndCopyTo(origInput);
            } catch (err) {
                console.warn('打开系统相册失败', err);
            }
        });

        btnCamera.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            overlay._cleanup(true);
            openCameraOverlay(origInput);
        });
    }

    // 相机覆盖层与拍照逻辑
    function openCameraOverlay(origInput) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert('当前浏览器不支持拍照');
            return;
        }
        if (document.getElementById('media-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'media-overlay';
        overlay.className = 'iu-media-overlay';
        const container = document.createElement('div');
        container.className = 'iu-container';
        const frame = document.createElement('div');
        frame.className = 'iu-frame';
        frame.id = 'media-frame';
        const video = document.createElement('video');
        video.id = 'media-video';
        video.autoplay = true;
        video.playsInline = true;
        video.className = 'iu-video';
        const canvas = document.createElement('canvas');
        canvas.id = 'media-canvas';
        canvas.className = 'iu-canvas';
        frame.appendChild(video);
        frame.appendChild(canvas);

        const rightBar = document.createElement('div');
        rightBar.className = 'iu-rightbar';
        rightBar.id = 'media-rightbar';
        const btnCancel = document.createElement('button');
        btnCancel.type = 'button';
        btnCancel.id = 'btn-cancel';
        btnCancel.title = '取消';
        btnCancel.className = 'iu-btn-top';
        btnCancel.textContent = '✕';
        const btnSwitch = document.createElement('button');
        btnSwitch.type = 'button';
        btnSwitch.id = 'btn-switch';
        btnSwitch.title = '切换摄像头';
        btnSwitch.className = 'iu-switch';
        btnSwitch.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24"><path fill="currentColor" d="M21.25 7.5a.75.75 0 0 1 .743.648L22 8.25v8.5a3.25 3.25 0 0 1-3.066 3.245L18.75 20H6.061l.72.72a.75.75 0 0 1 .072.976l-.073.084a.75.75 0 0 1-.976.073l-.084-.073l-2-2l-.064-.072l-.007-.01l.07.082a.75.75 0 0 1-.127-.89a.8.8 0 0 1 .128-.17l2-2a.75.75 0 0 1 1.133.976l-.073.084l-.72.72h12.69a1.75 1.75 0 0 0 1.744-1.607l.006-.143v-8.5a.75.75 0 0 1 .75-.75m-3.054-5.353l.084.073l2 2a1 1 0 0 1 .071.081l-.07-.081a.75.75 0 0 1 .004 1.056l-.005.004l-2 2a.75.75 0 0 1-1.133-.976l.073-.084l.718-.72H5.25a1.75 1.75 0 0 0-1.744 1.606L3.5 7.25v8.5a.75.75 0 0 1-1.493.102L2 15.75v-8.5a3.25 3.25 0 0 1 3.066-3.245L5.25 4h12.689l-.72-.72a.75.75 0 0 1-.072-.976l.073-.084a.75.75 0 0 1 .976-.073M12 8a4 4 0 1 1 0 8a4 4 0 0 1 0-8"></path></svg>';
        const btnShutter = document.createElement('button');
        btnShutter.type = 'button';
        btnShutter.id = 'btn-shutter';
        btnShutter.className = 'iu-shutter';
        const bottomBar = document.createElement('div');
        bottomBar.className = 'iu-bottombar';
        bottomBar.id = 'media-bottombar';
        const btnRetake = document.createElement('button');
        btnRetake.type = 'button';
        btnRetake.id = 'btn-retake';
        btnRetake.className = 'iu-retake';
        btnRetake.textContent = '重拍';
        const btnConfirm = document.createElement('button');
        btnConfirm.type = 'button';
        btnConfirm.id = 'btn-confirm';
        btnConfirm.className = 'iu-confirm';
        btnConfirm.textContent = '确定';

        // 保持按钮文字水平显示，避免在竖屏/容器布局变化时文字被旋转或换行
        const _btnTextFixStyle = {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            whiteSpace: 'nowrap', // 不换行，保证文字横向排布
        };
        Object.assign(btnRetake.style, _btnTextFixStyle);
        Object.assign(btnConfirm.style, _btnTextFixStyle);

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

        // 状态
        let stream = null;
        let facingMode = 'environment';
        let lastBlob = null;
        let isPreview = false;

        function stopStream() {
            try {
                if (stream) stream.getTracks().forEach(t => t.stop());
            } catch (_) {
            }
            stream = null;
        }

        // 根据 video 实际像素尺寸调整 frame 宽度，保证预览高度等于视口高度
        function adjustFrame() {
            try {
                const vw = video.videoWidth, vh = video.videoHeight;
                if (!vw || !vh) return;
                const scale = window.innerHeight / vh;
                frame.style.width = Math.round(vw * scale) + 'px';
                video.style.display = 'block';
                canvas.style.display = 'none';
            } catch (_) {
            }
        }

        // 启动摄像头流并在 metadata 后调整尺寸
        async function startStream() {
            stopStream();
            btnShutter.style.display = '';
            btnSwitch.style.display = 'flex';
            btnRetake.style.display = 'none';
            btnConfirm.style.display = 'none';
            const constraints = {
                video: {
                    facingMode: {ideal: facingMode}, width: {ideal: CAPTURE_WIDTH}, height: {ideal: CAPTURE_HEIGHT}
                },
                audio: false
            };
            if (CAPTURE_FRAME_RATE) constraints.frameRate = {ideal: CAPTURE_FRAME_RATE};
            try {
                stream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (err) {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {facingMode: {ideal: facingMode}}, audio: false
                });
            }
            video.srcObject = stream;
            video.style.display = 'block';
            canvas.style.display = 'none';
            await new Promise(resolve => {
                if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth && video.videoHeight) {
                    return resolve();
                }
                const onMeta = () => {
                    video.removeEventListener('loadedmetadata', onMeta);
                    resolve();
                };
                video.addEventListener('loadedmetadata', onMeta, {once: true});
                setTimeout(resolve, 600);
            });
            await video.play().catch(() => {
            });
            adjustFrame();
            isPreview = false;
        }

        registerEsc(overlay);

        try {
            window.addEventListener('popstate', chooserPopHandler);
            chooserHistoryPushed = true;
        } catch (err) {
            chooserHistoryPushed = false;
            window.removeEventListener('popstate', chooserPopHandler);
        }

        overlay._cleanup = (fromPop) => {
            stopStream();
            cleanup(overlay, fromPop);
        };

        // 捕获一帧真实像素并生成 Blob
        async function captureOnce() {
            if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return null;
            const vw = video.videoWidth, vh = video.videoHeight;
            // 若仍然没有合理尺寸，则认为无法拍摄，返回 null
            if (!vw || !vh) return null;
            canvas.width = vw;
            canvas.height = vh;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, vw, vh);
            return new Promise(resolve => canvas.toBlob(b => resolve(b), 'image/jpeg', 0.95));
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
                // 拍照后隐藏切换和快门，显示底部操作
                btnSwitch.style.display = 'none';
                btnShutter.style.display = 'none';
                btnRetake.style.display = 'inline-block';
                btnConfirm.style.display = 'inline-block';
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

        // 初始化底部按钮隐藏
        btnRetake.style.display = 'none';
        btnConfirm.style.display = 'none';

        // 快门事件
        btnShutter.addEventListener('click', async () => {
            btnShutter.disabled = true;
            try {
                const blob = await captureOnce();
                if (!blob) {
                    alert('拍照失败');
                    return;
                }
                showPreview(blob);
            } finally {
                btnShutter.disabled = false;
            }
        });

        // 重拍事件：恢复实时预览
        btnRetake.addEventListener('click', async () => {
            lastBlob = null;
            canvas.style.display = 'none';
            video.style.display = 'block';
            isPreview = false;
            btnRetake.style.display = 'none';
            btnConfirm.style.display = 'none';
            btnSwitch.style.display = 'flex';
            btnShutter.style.display = '';
            if (!stream) await startStream();
            else adjustFrame();
        });

        // 确认事件：把文件注入原 input 并关闭覆盖层
        btnConfirm.addEventListener('click', () => {
            if (!lastBlob) return;
            const file = new File([lastBlob], `photo_${Date.now()}.jpg`, {
                type: lastBlob.type || 'image/jpeg', lastModified: Date.now()
            });
            copyFilesToInput([file], origInput);
            overlay._cleanup();
        });

        // 取消按钮
        btnCancel.addEventListener('click', overlay._cleanup);

        // 切换摄像头
        btnSwitch.addEventListener('click', async () => {
            facingMode = (facingMode === 'environment') ? 'user' : 'environment';
            try {
                await startStream();
            } catch (err) {
                console.error('切换摄像头失败', err);
                alert('无法切换摄像头');
            }
        });

        // 启动摄像头流
        startStream().catch(err => {
            console.error('getUserMedia error', err);
            alert('无法访问摄像头');
            overlay._cleanup();
        });

        // 窗口尺寸变更时调整 frame
        window.addEventListener('resize', () => {
            try {
                if (video && video.videoWidth && video.videoHeight && !isPreview) adjustFrame();
            } catch (_) {
            }
        });
    }

    // 拦截 .paizhao-btn 和 追加拍照 的点击
    function findImageInput(e) {
        const el = e.target;
        if (el.matches('input[type=file]')) return el;
        const btn = el.closest('.paizhao-btn');
        if (btn) {
            return btn.querySelector('input[type=file]');
        }
        return null;
    }

    function onPaizhaoTrigger(e) {
        try {
            if (e.target.getAttribute('script-temp-file-input') === 'true') return;
            if (document.getElementById('upload-chooser')) return;
            const input = findImageInput(e);
            if (!input) return;
            try {
                e.preventDefault();
                e.stopPropagation();
            } catch (_) {
            }
            showChoiceMenu(input);
        } catch (err) {
            console.error('image-upload: onPaizhaoTrigger error', err);
        }
    }

    document.addEventListener('click', onPaizhaoTrigger, true);
})();
