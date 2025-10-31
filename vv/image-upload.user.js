// ==UserScript==
// @name         拍照上传照片
// @namespace    https://github.com/botaothomaszhao/pkus-xny-ultra
// @version      vv.2.4
// @license      GPL-3.0
// @description  点击上传照片按钮时弹窗选择“从相册选择”或“从相机拍照”，在网页内实现拍照功能，解决浏览器 capture 字段不生效问题。按要求：移除 overlay 的背景点击关闭、增宽重拍/确认按钮、右上叉放大、保留其它功能不变、注释均为中文且保留必要的原注释说明。
// @match        https://bdfz.xnykcxt.com:5002/*
// @grant        none
// @run-at       document-body
// ==/UserScript==

(function () {
    'use strict';

    // 辅助：批量应用样式（给元素设置多条样式）
    function setStyles(el, styles) {
        for (const k in styles) {
            try {
                el.style[k] = styles[k];
            } catch (_) {
            }
        }
    }

    // 辅助：安全移除指定 id 元素（存在则移除）
    function removeIfExists(id, doCleanup = false) {
        const el = document.getElementById(id);
        if (el) {
            try {
                if (doCleanup && typeof el._cleanup === 'function') {
                    el._cleanup(true);
                }
                el.remove();
            } catch (_) {
            }
        }
    }

    // 历史/popstate 管理（用于拦截返回键）
    let chooserHistoryPushed = false;
    let suppressNextPop = false;

    // 把 File 塞回指定 input 并触发 change（把拍到的照片注入原始文件 input）
    function copyFilesToInput(files, input) {
        const dt = new DataTransfer();
        for (const f of files) dt.items.add(f);
        input.files = dt.files;
        input.dispatchEvent(new Event('change', {bubbles: true}));
    }

    // 在用户激活的事件处理里同步唤起系统文件选择器（作为从相册选择的 fallback）
    function openSystemFilePickerAndCopyTo(origInput) {
        if (!origInput) return;
        const accept = origInput.getAttribute('data-orig-accept') || origInput.getAttribute('accept') || '';
        const multiple = origInput.hasAttribute('multiple');

        // 创建临时 input（fallback），不使用 display:none（在某些环境下 display:none 会阻止打开文件选择器）
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

    // 当用户按浏览器后退关闭菜单时处理（用于选择菜单）
    function chooserPopHandler() {
        // 如果我们在程序上 suppress 了下一次 pop（由我们自己 history.back() 引起的），忽略
        if (suppressNextPop) {
            suppressNextPop = false;
            return;
        }
        chooserHistoryPushed = false;
        removeIfExists('upload-chooser', true);
        removeIfExists('media-overlay', true);
        removeChooserPopHandler();
    }

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
        setStyles(panel, {
            width: '100%',
            maxWidth: '720px',
            borderRadius: '12px',
            background: '#fff',
            overflow: 'hidden'
        });

        // 辅助：创建菜单按钮
        function makeButton(text, bg) {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = text;
            setStyles(b, {
                width: '100%',
                padding: '14px',
                border: 'none',
                borderTop: '1px solid rgba(0,0,0,0.06)',
                background: bg || '#fff',
                fontSize: '16px',
                cursor: 'pointer'
            });
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
        } catch (_) {
        }
        const chooserKeyHandler = (e) => {
            const isEsc = e.key === 'Escape' || e.key === 'Esc';
            if (!isEsc) return;
            try {
                e.preventDefault();
                e.stopPropagation();
            } catch (_) {
            }
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
            chooserHistoryPushed = false;
            window.removeEventListener('popstate', chooserPopHandler);
        }

        // helper to 关闭 overlay 并恢复 history（如果我们 push 了一个 state）
        function closeOverlayAndRestoreHistory(fromPop = false) {
            // 移除注册的键盘处理器
            try {
                if (overlay && overlay._keyHandler) overlay.removeEventListener('keydown', overlay._keyHandler, true);
            } catch (_) {
            }
            removeIfExists('upload-chooser');
            if (!fromPop && chooserHistoryPushed) {
                // 防止我们的 popstate 处理器响应我们即将调用的 history.back()
                suppressNextPop = true;
                try {
                    history.back();
                } catch (_) {
                }
            }
            removeChooserPopHandler();
        }

        overlay._cleanup = closeOverlayAndRestoreHistory;

        // 点击背景区域关闭菜单（仅关闭当目标正是 overlay 时）
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
            closeOverlayAndRestoreHistory(true);
            openCameraOverlay(origInput);
        });
    }

    // 相机拍照覆盖层（主要逻辑保持不变）
    // 在 startStream 成功后根据 video.videoWidth/video.videoHeight 调整 frame 宽度使得预览高度等于视口高度，
    // 拍照时用 video 的真实像素生成图片，从而保证预览与最终图片的一致性。
    function openCameraOverlay(origInput) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert('当前浏览器不支持拍照');
            return;
        }

        if (document.getElementById('media-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'media-overlay';
        setStyles(overlay, {
            position: 'fixed',
            left: '0',
            top: '0',
            right: '0',
            bottom: '0',
            zIndex: '2147483647',
            background: '#000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0',
            boxSizing: 'border-box'
        });

        // container 占满屏幕高度
        const container = document.createElement('div');
        container.id = 'media-container';
        setStyles(container, {
            position: 'relative',
            width: '100%',
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            boxSizing: 'border-box'
        });

        // frame：按摄像头原始纵横比调整宽度（高度固定 100vh），实现所见即所得
        const frame = document.createElement('div');
        frame.id = 'media-frame';
        setStyles(frame, {
            height: '100vh',
            width: 'auto',
            background: '#000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative'
        });

        // video：用作实时预览
        const video = document.createElement('video');
        video.id = 'media-video';
        video.autoplay = true;
        video.playsInline = true;
        setStyles(video, {width: '100%', height: '100%', objectFit: 'cover', background: '#000', display: 'block'});

        // canvas：用于生成图片（拍照后展示）
        const canvas = document.createElement('canvas');
        canvas.id = 'media-canvas';
        setStyles(canvas, {
            display: 'none',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            background: '#000',
        });

        frame.appendChild(video);
        frame.appendChild(canvas);

        // 右侧控件区（覆盖两侧黑边区域）
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

        // 右上叉（放大一些以便点击）
        const btnCancel = document.createElement('button');
        btnCancel.type = 'button';
        btnCancel.id = 'btn-cancel';
        btnCancel.title = '取消';
        setStyles(btnCancel, {
            position: 'absolute',
            right: '12px',
            top: '12px',
            width: '48px',
            height: '48px',
            borderRadius: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            background: 'rgba(0,0,0,0.36)',
            color: '#fff',
            cursor: 'pointer',
            padding: '6px',
            boxSizing: 'border-box'
        });
        btnCancel.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

        const btnSwitch = document.createElement('button');
        btnSwitch.type = 'button';
        btnSwitch.id = 'btn-switch';
        btnSwitch.title = '切换摄像头';
        setStyles(btnSwitch, {
            width: '52px',
            height: '52px',
            borderRadius: '26px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid rgba(255,255,255,0.9)',
            background: 'rgba(0,0,0,0.28)',
            color: '#fff',
            cursor: 'pointer',
            padding: '6px',
            boxSizing: 'border-box'
        });
        btnSwitch.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24"><path fill="currentColor" d="M21.25 7.5a.75.75 0 0 1 .743.648L22 8.25v8.5a3.25 3.25 0 0 1-3.066 3.245L18.75 20H6.061l.72.72a.75.75 0 0 1 .072.976l-.073.084a.75.75 0 0 1-.976.073l-.084-.073l-2-2l-.064-.072l-.007-.01l.07.082a.75.75 0 0 1-.127-.89a.8.8 0 0 1 .128-.17l2-2a.75.75 0 0 1 1.133.976l-.073.084l-.72.72h12.69a1.75 1.75 0 0 0 1.744-1.607l.006-.143v-8.5a.75.75 0 0 1 .75-.75m-3.054-5.353l.084.073l2 2a1 1 0 0 1 .071.081l-.07-.081a.75.75 0 0 1 .004 1.056l-.005.004l-2 2a.75.75 0 0 1-1.133-.976l.073-.084l.718-.72H5.25a1.75 1.75 0 0 0-1.744 1.606L3.5 7.25v8.5a.75.75 0 0 1-1.493.102L2 15.75v-8.5a3.25 3.25 0 0 1 3.066-3.245L5.25 4h12.689l-.72-.72a.75.75 0 0 1-.072-.976l.073-.084a.75.75 0 0 1 .976-.073M12 8a4 4 0 1 1 0 8a4 4 0 0 1 0-8"></path></svg>';

        // 快门按钮（缩小为常见尺寸）
        const btnShutter = document.createElement('button');
        btnShutter.type = 'button';
        btnShutter.id = 'btn-shutter';
        setStyles(btnShutter, {
            width: '56px',
            height: '56px',
            borderRadius: '28px',
            background: '#fff',
            border: '4px solid rgba(255,255,255,0.85)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
            cursor: 'pointer',
            padding: '0'
        });

        // 底部区域：重拍/确认（按要求增宽一倍）
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

        // 重拍按钮（增宽：原来 12px 40px -> 12px 80px）
        const btnRetake = document.createElement('button');
        btnRetake.type = 'button';
        btnRetake.id = 'btn-retake';
        btnRetake.textContent = '重拍';
        setStyles(btnRetake, {
            padding: '12px 80px',
            borderRadius: '8px',
            border: 'none',
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            fontSize: '16px',
            cursor: 'pointer'
        });

        // 确认按钮（增宽：原来 12px 40px -> 12px 80px）
        const btnConfirm = document.createElement('button');
        btnConfirm.type = 'button';
        btnConfirm.id = 'btn-confirm';
        btnConfirm.textContent = '确定';
        setStyles(btnConfirm, {
            padding: '12px 80px',
            borderRadius: '8px',
            border: 'none',
            background: '#fff',
            color: '#000',
            fontSize: '16px',
            cursor: 'pointer'
        });

        // 将控件加入 DOM
        rightBar.appendChild(btnSwitch);
        rightBar.appendChild(btnShutter);

        bottomBar.appendChild(btnRetake);
        bottomBar.appendChild(btnConfirm);

        container.appendChild(frame);
        container.appendChild(rightBar);
        // 右上叉直接放在 container（覆盖 frame 右上角）
        container.appendChild(btnCancel);
        overlay.appendChild(container);
        overlay.appendChild(bottomBar);
        document.body.appendChild(overlay);

        // 状态变量
        let stream = null;
        let facingMode = 'environment';
        let lastBlob = null;
        let isPreview = false;

        // 安全停止流
        function stopStreamTracks() {
            try {
                if (stream) stream.getTracks().forEach(t => t.stop());
            } catch (_) {
            }
            stream = null;
        }

        // 根据 video 内部真实尺寸调整 frame 宽度，使预览高度等于视口高度（所见即所得）
        function adjustFrameToVideo() {
            try {
                const vw = video.videoWidth;
                const vh = video.videoHeight;
                if (!vw || !vh) return;
                const scale = (window.innerHeight) / vh; // 高度缩放比例（因为 frame.height=100vh）
                const displayWidth = Math.round(vw * scale);
                frame.style.width = displayWidth + 'px';
                // 确保 video 充满 frame
                setStyles(video, {width: '100%', height: '100%', objectFit: 'cover', display: 'block'});
                // 隐藏 canvas（如果此前在预览）
                canvas.style.display = 'none';
            } catch (_) {
            }
        }

        // 启动摄像头流：停止旧流、请求新流、设置到 video 并 play，然后根据 metadata 调整 frame
        async function startStream() {
            stopStreamTracks();
            // UI 状态复位：显示快门与切换，隐藏底部按钮
            btnShutter.style.display = '';
            btnSwitch.style.display = 'flex';
            btnRetake.style.display = 'none';
            btnConfirm.style.display = 'none';
            const constraints = {
                video: {
                    facingMode: {ideal: facingMode},
                    width: {ideal: 1920},
                    height: {ideal: 1080}
                },
                audio: false
            };
            try {
                stream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (err) {
                // 如果严格约束失败，尝试更宽松的约束
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {facingMode: {ideal: facingMode}},
                    audio: false
                });
            }
            video.srcObject = stream;
            video.style.display = 'block';
            canvas.style.display = 'none';

            // 等待 metadata 以获取 videoWidth/videoHeight
            await new Promise((resolve) => {
                if (video.readyState >= 1 && video.videoWidth && video.videoHeight) return resolve();
                const onMeta = () => {
                    video.removeEventListener('loadedmetadata', onMeta);
                    resolve();
                };
                video.addEventListener('loadedmetadata', onMeta, {once: true});
                // fallback：若加载元数据超时，短暂等待仍继续
                setTimeout(resolve, 600);
            });

            // 尝试播放（某些浏览器 play() 可能 rejected）
            await video.play().catch((e) => {
                console.warn('video.play() rejected', e);
            });

            // 根据实际 video 尺寸调整 frame（保证预览与捕获一致）
            adjustFrameToVideo();

            isPreview = false;

        }

        // 使 overlay 可聚焦以捕获键盘事件，并注册 Esc 键处理器到该弹窗（便于用户按 Esc 关闭）
        try {
            overlay.tabIndex = -1;
            overlay.focus();
        } catch (_) {
        }
        const mediaKeyHandler = (e) => {
            const isEsc = e.key === 'Escape' || e.key === 'Esc';
            if (!isEsc) return;
            try {
                e.preventDefault();
                e.stopPropagation();
            } catch (_) {
            }
            cleanup();
        };
        overlay.addEventListener('keydown', mediaKeyHandler, true);
        overlay._keyHandler = mediaKeyHandler;

        // push history state so that back button will close menu (we will later remove this pushed state)
        try {
            window.addEventListener('popstate', chooserPopHandler);
            //history.pushState({camera: true}, '');
            chooserHistoryPushed = true;
        } catch (err) {
            chooserHistoryPushed = false;
            window.removeEventListener('popstate', chooserPopHandler);
        }

        // 清理资源并移除覆盖层
        function cleanup(fromPop = false) {
            try {
                if (overlay && overlay._keyHandler) overlay.removeEventListener('keydown', overlay._keyHandler, true);
            } catch (_) {
            }
            stopStreamTracks();
            try {
                overlay.remove();
            } catch (_) {
            }
            if (!fromPop && chooserHistoryPushed) {
                // 防止我们的 popstate 处理器响应我们即将调用的 history.back()
                suppressNextPop = true;
                try {
                    history.back();
                } catch (_) {
                }
            }
            removeChooserPopHandler();
        }

        // 暴露 cleanup 以便外部调用
        overlay._cleanup = cleanup;

        // 拍照：用 video 的真实像素生成图片（保持所见即所得）
        async function captureOnce() {
            const vw = video.videoWidth || 1280;
            const vh = video.videoHeight || 720;
            canvas.width = vw;
            canvas.height = vh;
            const ctx = canvas.getContext('2d');
            // 直接绘制整个视频的真实像素（我们已经把 frame 按比例调整为 height=viewportHeight）
            ctx.drawImage(video, 0, 0, vw, vh);
            return new Promise((resolve) => canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.95));
        }

        // 显示拍照预览（将生成的 blob 渲染到 canvas 上并切换可见性）
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

        // 初始状态：隐藏底部按钮（重拍/确认）
        btnRetake.style.display = 'none';
        btnConfirm.style.display = 'none';

        // 快门事件：拍照并显示预览
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

        // 重拍事件：恢复实时预览（并重新调整 frame）
        btnRetake.addEventListener('click', async () => {
            lastBlob = null;
            canvas.style.display = 'none';
            video.style.display = 'block';
            isPreview = false;
            btnRetake.style.display = 'none';
            btnConfirm.style.display = 'none';
            btnSwitch.style.display = 'flex';
            btnShutter.style.display = '';
            // 若流已停止则重新 startStream，否则仅重新调整 frame
            if (!stream) {
                await startStream();
            } else {
                adjustFrameToVideo();
            }
        });

        // 确认事件：把文件注入原 input 并关闭覆盖层
        btnConfirm.addEventListener('click', () => {
            if (!lastBlob) return;
            const file = new File([lastBlob], `photo_${Date.now()}.jpg`, {
                type: lastBlob.type || 'image/jpeg',
                lastModified: Date.now()
            });
            copyFilesToInput([file], origInput);
            cleanup();
        });

        // 取消按钮：直接清理并关闭 overlay
        btnCancel.addEventListener('click', cleanup);

        // 切换摄像头：切换 facingMode 并重启流（确保预览在切换后立即可见）
        btnSwitch.addEventListener('click', async () => {
            facingMode = (facingMode === 'environment') ? 'user' : 'environment';
            try {
                await startStream();
            } catch (err) {
                console.error('切换摄像头失败', err);
                alert('无法切换摄像头');
            }
        });

        // 启动摄像头流（初次打开）
        startStream().catch(err => {
            console.error('getUserMedia error', err);
            alert('无法访问摄像头');
            cleanup();
        });

        // 在窗口尺寸变化时重新调整 frame，以保持预览高度等于视口高度
        window.addEventListener('resize', () => {
            try {
                if (video && video.videoWidth && video.videoHeight && !isPreview) adjustFrameToVideo();
            } catch (_) {
            }
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
            // 忽略异常
        }

        let el = e.target;
        while (el) {
            if (el.classList && el.classList.contains && el.classList.contains('paizhao-btn')) return el;
            el = el.parentElement;
        }
        return null;
    }

    // 点击触发处理：找到对应的 file input 并打开选择菜单
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

    // 监听 click
    document.addEventListener('click', onPaizhaoTrigger, true);
})();
