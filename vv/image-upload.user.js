// ==UserScript==
// @name         BDFZ: 相册/相机选择 + MediaDevices 拍照（Via 特化）
// @namespace    https://github.com/botaothomaszhao
// @version      1.0
// @description  在站点 https://bdfz.xnykcxt.com:5002/ 上拦截文件上传，弹出“从相册/使用相机拍照(内置)”选择。若选相机则使用 MediaDevices(getUserMedia) 手动拍照并把图片回填到原始 input（兼容在 Via 等不支持系统 chooser 的浏览器）。在 document-start 注入以拦截 programmatic click。适用于 Tampermonkey/Violentmonkey。作者: botaothomaszhao
// @match        https://bdfz.xnykcxt.com:5002/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    // 防止重复注入
// javascript
// ---- 页面世界补丁注入 + 事件桥接 ----
    (function setupPageBridge() {
        // 监听页面世界发来的事件，定位原始 input 并调用 showChoiceMenu
        window.addEventListener('bdfz:open-chooser', function (ev) {
            try {
                const tid = ev && ev.detail && ev.detail.tid;
                const sel = ev && ev.detail && ev.detail.sel;
                let input = null;
                if (tid) input = document.querySelector('input[type="file"][data-bdfz_tid="' + tid + '"]');
                if (!input && sel) input = document.querySelector(sel);
                if (input) {
                    showChoiceMenu(input);
                }
            } catch (e) {
                console.error('bdfz-media: bridge handler error', e);
            }
        }, false);

        // 将补丁脚本注入到“页面世界”
        const js = `
  ;(function(){
    try{
      if (window.__bdfz_media_page_patch__) return;
      window.__bdfz_media_page_patch__ = true;

      function isFileInput(el){ return el && el.tagName === 'INPUT' && el.type === 'file'; }

      function markInput(el){
        if (!el.dataset.bdfz_tid) el.dataset.bdfz_tid = 'bdfz_' + Math.random().toString(36).slice(2);
        return el.dataset.bdfz_tid;
      }

      function notifyOpenChooser(input){
        try{
          const tid = markInput(input);
          window.dispatchEvent(new CustomEvent('bdfz:open-chooser', { detail: { tid: tid } }));
        }catch(e){}
      }

      // 在捕获阶段拦截 input/label 的原生点击
      function findAssociatedFileInput(target){
        if (!target || !target.closest) return null;
        if (isFileInput(target)) return target;
        const label = target.closest('label');
        if (label){
          const forId = label.getAttribute('for');
          if (forId){
            const el = document.getElementById(forId);
            if (isFileInput(el)) return el;
          }
          const nested = label.querySelector('input[type="file"]');
          if (nested) return nested;
        }
        return null;
      }

      function captureHandler(ev){
        const inp = findAssociatedFileInput(ev.target);
        if (inp){
          ev.preventDefault();
          ev.stopImmediatePropagation();
          ev.stopPropagation();
          notifyOpenChooser(inp);
        }
      }

      document.addEventListener('click', captureHandler, true);
      document.addEventListener('touchend', captureHandler, true);
      document.addEventListener('pointerdown', captureHandler, true);

      // 覆写页面世界的原生 click/showPicker（阻止程序化打开）
      var origClick = HTMLInputElement.prototype.click;
      HTMLInputElement.prototype.click = function(){
        if (isFileInput(this) && !(this.dataset && this.dataset.bdfz_injected === '1')){
          notifyOpenChooser(this);
          return;
        }
        return origClick.apply(this, arguments);
      };

      var origPicker = HTMLInputElement.prototype.showPicker;
      if (typeof origPicker === 'function'){
        HTMLInputElement.prototype.showPicker = function(){
          if (isFileInput(this) && !(this.dataset && this.dataset.bdfz_injected === '1')){
            notifyOpenChooser(this);
            return;
          }
          return origPicker.apply(this, arguments);
        };
      }
      // console.log('bdfz-media(page): patch installed');
    }catch(e){
      // console.error('bdfz-media(page): inject failed', e);
    }
  })();`;

        try{
            const s = document.createElement('script');
            s.textContent = js;
            (document.documentElement || document.head || document.body).appendChild(s);
            // s.remove(); // 可选
        }catch(e){
            console.error('bdfz-media: inject page patch failed', e);
        }
    })();

// ---- 修复：启用“相机”按钮打开覆盖层 ----
// 在现有 showChoiceMenu 内，将 btnCamera 的点击处理改为调用 openCameraOverlay
// 原来： //openCameraOverlay(origInput);
    (function enableCameraBtn() {
        const _origShowChoiceMenu = showChoiceMenu;
        showChoiceMenu = function(origInput){
            _origShowChoiceMenu.call(this, origInput);
            // 给刚插入的面板重绑一次相机按钮（防重复打开）
            const overlay = document.getElementById('bdfz-upload-chooser');
            if (!overlay) return;
            const btn = overlay.querySelector('button.bdfz-choose-camera');
            if (btn && !btn.dataset.bdfz_bound){
                btn.dataset.bdfz_bound = '1';
                btn.addEventListener('click', function(ev){
                    ev.stopPropagation();
                    try { overlay.remove(); } catch(_){}
                    openCameraOverlay(origInput);
                }, { once: true });
            }
        };
    })();

    if (window.__bdfz_media_userscript_installed) return;
    window.__bdfz_media_userscript_installed = true;

    // ---------- 辅助函数 ----------
    function isFileInput(el) {
        return el && el.tagName === 'INPUT' && el.type === 'file';
    }

    function copyFilesToInput(files, origInput) {
        try {
            const dt = new DataTransfer();
            for (const f of files) dt.items.add(f);
            origInput.files = dt.files;
            origInput.dispatchEvent(new Event('change', {bubbles: true}));
            return true;
        } catch (err) {
            console.warn('bdfz-media: DataTransfer failed', err);
        }
        // fallback: replace input
        try {
            const clone = document.createElement('input');
            clone.type = 'file';
            clone.multiple = origInput.multiple;
            if (origInput.name) clone.name = origInput.name;
            if (origInput.id) clone.id = origInput.id;
            if (origInput.required) clone.required = true;
            // Attempt to set files by cloning tmp is not possible here; but we can use a hidden form submit flow
            // Simpler fallback: append a hidden input with same name and a base64 file is not supported for form files.
            // So just replace node with a clone and hope site reads the File from change event above (rare).
            origInput.parentNode.replaceChild(clone, origInput);
            clone.dispatchEvent(new Event('change', {bubbles: true}));
            return false;
        } catch (err2) {
            console.error('bdfz-media: fallback replace failed', err2);
            return false;
        }
    }

    function makeFileFromBlob(blob, filename = 'photo.jpg') {
        try {
            return new File([blob], filename, {type: blob.type || 'image/jpeg', lastModified: Date.now()});
        } catch (e) {
            // Some older browsers may not support File constructor
            blob.name = filename;
            return blob;
        }
    }

    // ---------- Camera overlay (MediaDevices) ----------
    function openCameraOverlay(origInput) {
        // Create overlay UI
        if (document.getElementById('bdfz-media-overlay')) return; // already open
        const overlay = document.createElement('div');
        overlay.id = 'bdfz-media-overlay';
        overlay.style.position = 'fixed';
        overlay.style.left = '0';
        overlay.style.top = '0';
        overlay.style.right = '0';
        overlay.style.bottom = '0';
        overlay.style.zIndex = 2147483647;
        overlay.style.background = 'rgba(0,0,0,0.85)';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.flexDirection = 'column';
        overlay.style.gap = '8px';
        overlay.style.padding = '12px';
        overlay.style.boxSizing = 'border-box';
        overlay.style.color = '#fff';
        overlay.innerHTML = `
      <div id="bdfz-media-stage" style="width:100%;max-width:720px;aspect-ratio:3/4;background:#000;position:relative;border-radius:12px;overflow:hidden;display:flex;align-items:center;justify-content:center">
        <video id="bdfz-media-video" autoplay playsinline style="width:100%;height:100%;object-fit:cover;background:#000"></video>
        <canvas id="bdfz-media-canvas" style="display:none"></canvas>
      </div>
    `;

        const controls = document.createElement('div');
        controls.style.display = 'flex';
        controls.style.width = '100%';
        controls.style.maxWidth = '720px';
        controls.style.justifyContent = 'space-between';
        controls.style.alignItems = 'center';
        controls.style.gap = '8px';
        controls.style.marginTop = '6px';

        function makeButton(text, id, extraStyle) {
            const b = document.createElement('button');
            b.id = id;
            b.type = 'button';
            b.textContent = text;
            b.style.flex = '1';
            b.style.padding = '12px';
            b.style.fontSize = '15px';
            b.style.borderRadius = '8px';
            b.style.border = 'none';
            b.style.cursor = 'pointer';
            b.style.background = '#1f8ef1';
            b.style.color = '#fff';
            if (extraStyle) Object.assign(b.style, extraStyle);
            return b;
        }

        const btnCapture = makeButton('拍照', 'bdfz-media-capture');
        const btnSwitch = makeButton('切换摄像头', 'bdfz-media-switch', {background: '#2d9c59'});
        const btnRetake = makeButton('重拍', 'bdfz-media-retake', {background: '#666'});
        const btnConfirm = makeButton('确定', 'bdfz-media-confirm', {background: '#f39c12'});
        const btnCancel = makeButton('取消', 'bdfz-media-cancel', {background: '#e74c3c'});

        // Initial controls: capture, switch, cancel
        controls.appendChild(btnSwitch);
        controls.appendChild(btnCapture);
        controls.appendChild(btnCancel);

        // Append controls and confirm/retake hidden area
        overlay.appendChild(controls);
        document.body.appendChild(overlay);

        const video = document.getElementById('bdfz-media-video');
        const canvas = document.getElementById('bdfz-media-canvas');

        let stream = null;
        let usingFacingMode = 'environment'; // prefer back camera
        let lastBlob = null;

        async function startStream() {
            try {
                if (stream) {
                    // stop existing
                    stream.getTracks().forEach(t => t.stop());
                    stream = null;
                }
                const constraints = {
                    video: {
                        facingMode: {ideal: usingFacingMode},
                        width: {ideal: 1280},
                        height: {ideal: 720}
                    }, audio: false
                };
                stream = await navigator.mediaDevices.getUserMedia(constraints);
                video.srcObject = stream;
                await video.play();
            } catch (err) {
                console.error('bdfz-media: getUserMedia error', err);
                alert('无法访问摄像头：' + (err && err.message ? err.message : err));
                cleanup();
            }
        }

        async function captureOnce() {
            try {
                // set canvas size to video's displayed resolution (use videoWidth/videoHeight)
                const vw = video.videoWidth || 1280;
                const vh = video.videoHeight || 720;
                canvas.width = vw;
                canvas.height = vh;
                const ctx = canvas.getContext('2d');
                // Mirror correction? we keep natural orientation (no mirror)
                ctx.drawImage(video, 0, 0, vw, vh);
                return new Promise((resolve) => {
                    canvas.toBlob((blob) => {
                        resolve(blob);
                    }, 'image/jpeg', 0.95);
                });
            } catch (err) {
                console.error('bdfz-media: capture error', err);
                return null;
            }
        }

        function showPreviewMode(blob) {
            // hide video, show canvas preview
            const ctx = canvas.getContext('2d');
            // draw blob to canvas via Image
            const img = new Image();
            img.onload = function () {
                // resize canvas to image natural size
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                ctx.drawImage(img, 0, 0);
                video.style.display = 'none';
                canvas.style.display = 'block';
                // replace controls: retake, confirm, cancel
                controls.innerHTML = '';
                controls.appendChild(btnRetake);
                controls.appendChild(btnConfirm);
                controls.appendChild(btnCancel);
            };
            img.onerror = function () {
                console.error('bdfz-media: preview image load failed');
            };
            img.src = URL.createObjectURL(blob);
        }

        async function onCapture() {
            btnCapture.disabled = true;
            const blob = await captureOnce();
            btnCapture.disabled = false;
            if (!blob) {
                alert('拍照失败');
                return;
            }
            lastBlob = blob;
            showPreviewMode(blob);
        }

        async function onRetake() {
            // clear preview and resume video
            canvas.style.display = 'none';
            video.style.display = 'block';
            // reset controls
            controls.innerHTML = '';
            controls.appendChild(btnSwitch);
            controls.appendChild(btnCapture);
            controls.appendChild(btnCancel);
            // resume stream if needed
            if (!stream) await startStream();
        }

        async function onConfirm() {
            if (!lastBlob) return;
            // Create File and copy to input
            const file = makeFileFromBlob(lastBlob, `photo_${Date.now()}.jpg`);
            const ok = copyFilesToInput([file], origInput);
            // close overlay
            cleanup();
            if (!ok) {
                alert('无法直接回填文件（浏览器限制），请尝试从相册选择或使用支持的浏览器。');
            }
        }

        function cleanup() {
            try {
                if (stream) {
                    stream.getTracks().forEach(t => t.stop());
                    stream = null;
                }
            } catch (e) {
            }
            try {
                overlay.remove();
            } catch (e) {
            }
        }

        // Switch camera: toggle facingMode
        async function onSwitch() {
            usingFacingMode = (usingFacingMode === 'environment') ? 'user' : 'environment';
            await startStream();
        }

        // Bind events
        btnCapture.addEventListener('click', onCapture);
        btnRetake.addEventListener('click', onRetake);
        btnConfirm.addEventListener('click', onConfirm);
        btnCancel.addEventListener('click', cleanup);
        btnSwitch.addEventListener('click', onSwitch);

        // If user taps outside overlay stage, cancel
        overlay.addEventListener('click', (ev) => {
            if (ev.target === overlay) cleanup();
        });

        // Start camera
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert('当前浏览器不支持 MediaDevices.getUserMedia，无法使用内置相机拍照。请从相册选择或换用支持的浏览器。');
            cleanup();
            return;
        }
        startStream();
    }

    // ---------- Temporary input trigger ----------
    function triggerTemporaryGallery(origInput) {
        // create temporary input and click to open system/gallery chooser
        const tmp = document.createElement('input');
        tmp.type = 'file';
        tmp.accept = 'image/*';
        if (origInput.multiple) tmp.multiple = true;
        tmp.style.position = 'fixed';
        tmp.style.left = '-9999px';
        tmp.dataset.bdfz_injected = '1';
        document.body.appendChild(tmp);
        tmp.addEventListener('change', function () {
            try {
                copyFilesToInput(tmp.files ? Array.from(tmp.files) : [], origInput);
            } finally {
                try {
                    tmp.remove();
                } catch (e) {
                }
            }
        }, {once: true});
        // user gesture required: this function will be called from a user click on menu
        try {
            tmp.click();
        } catch (e) {
            console.warn('bdfz-media: tmp.click failed', e);
        }
    }

    // ---------- Choice menu ----------
    function showChoiceMenu(origInput) {
        // If overlay already exists, do nothing
        if (document.getElementById('bdfz-upload-chooser')) return;

        console.log("bdfz-media: showing choice menu");

        const overlay = document.createElement('div');
        overlay.id = 'bdfz-upload-chooser';
        overlay.style.position = 'fixed';
        overlay.style.left = '0';
        overlay.style.top = '0';
        overlay.style.right = '0';
        overlay.style.bottom = '0';
        overlay.style.zIndex = 2147483646;
        overlay.style.background = 'rgba(0,0,0,0.12)';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'flex-end';
        overlay.style.justifyContent = 'center';
        overlay.style.padding = '12px';
        overlay.style.boxSizing = 'border-box';

        const panel = document.createElement('div');
        panel.style.width = '100%';
        panel.style.maxWidth = '720px';
        panel.style.borderRadius = '12px';
        panel.style.background = '#fff';
        panel.style.overflow = 'hidden';

        function makeButton(text, cls, bg) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = cls;
            b.textContent = text;
            b.style.width = '100%';
            b.style.padding = '14px';
            b.style.border = 'none';
            b.style.borderTop = '1px solid rgba(0,0,0,0.06)';
            b.style.background = bg || '#fff';
            b.style.fontSize = '16px';
            b.style.cursor = 'pointer';
            return b;
        }

        const btnGallery = makeButton('从相册选择', 'bdfz-choose-gallery');
        const btnCamera = makeButton('使用相机拍照(内置)', 'bdfz-choose-camera');
        const btnCancel = makeButton('取消', 'bdfz-choose-cancel', '#f5f5f5');

        panel.appendChild(btnGallery);
        panel.appendChild(btnCamera);
        panel.appendChild(btnCancel);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        btnGallery.addEventListener('click', (ev) => {
            ev.stopPropagation();
            try {
                overlay.remove();
            } catch (e) {
            }
            triggerTemporaryGallery(origInput);
        });

        btnCamera.addEventListener('click', (ev) => {
            ev.stopPropagation();
            try {
                overlay.remove();
            } catch (e) {
            }
            console.log("bdfz-media: user chose camera");
            //openCameraOverlay(origInput);
        });

        btnCancel.addEventListener('click', (ev) => {
            ev.stopPropagation();
            try {
                overlay.remove();
            } catch (e) {
            }
        });

        overlay.addEventListener('click', () => {
            try {
                overlay.remove();
            } catch (e) {
            }
        });
    }

    // ---------- Patch prototype click & showPicker ----------
    function patchInputClick() {
        try {
            const origClick = HTMLInputElement.prototype.click;
            const origShowPicker = HTMLInputElement.prototype.showPicker;

            HTMLInputElement.prototype.click = function (...args) {
                try {
                    if (isFileInput(this)) {
                        // allow our injected temp input
                        if (this.dataset && this.dataset.bdfz_injected === '1') return origClick.apply(this, args);

                        // widen accept to image/* so gallery options appear more likely
                        try {
                            if (!this.dataset.bdfz_modified_accept) {
                                this.dataset.bdfz_modified_accept = '1';
                                this.dataset.bdfz_orig_accept = this.getAttribute('accept') || '';
                                try {
                                    this.setAttribute('accept', 'image/*');
                                } catch (e) {
                                }
                            }
                        } catch (e) {
                        }

                        // Show chooser menu; the menu's buttons are user gestures that will trigger tmp input or camera overlay.
                        showChoiceMenu(this);
                        return;
                    }
                } catch (e) {
                    console.error('bdfz-media: patched click error', e);
                }
                return origClick.apply(this, args);
            };

            if (typeof origShowPicker === 'function') {
                HTMLInputElement.prototype.showPicker = function (...args) {
                    try {
                        if (isFileInput(this)) {
                            if (this.dataset && this.dataset.bdfz_injected === '1') return origShowPicker.apply(this, args);

                            try {
                                if (!this.dataset.bdfz_modified_accept) {
                                    this.dataset.bdfz_modified_accept = '1';
                                    this.dataset.bdfz_orig_accept = this.getAttribute('accept') || '';
                                    try {
                                        this.setAttribute('accept', 'image/*');
                                    } catch (e) {
                                    }
                                }
                            } catch (e) {
                            }

                            showChoiceMenu(this);
                            return;
                        }
                    } catch (e) {
                        console.error('bdfz-media: patched showPicker error', e);
                    }
                    return origShowPicker.apply(this, args);
                };
            }
        } catch (e) {
            console.error('bdfz-media: patching failed', e);
        }
    }

    // Observe dynamically added inputs and normalize accept
    function observeInputs() {
        const mo = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.addedNodes && m.addedNodes.length) {
                    for (const n of m.addedNodes) {
                        if (!n) continue;
                        if (n.nodeType === Node.ELEMENT_NODE) {
                            const el = n;
                            if (isFileInput(el)) {
                                try {
                                    if (!el.dataset.bdfz_modified_accept) {
                                        el.dataset.bdfz_modified_accept = '1';
                                        el.dataset.bdfz_orig_accept = el.getAttribute('accept') || '';
                                        el.setAttribute('accept', 'image/*');
                                    }
                                } catch (_) {
                                }
                            } else {
                                try {
                                    const files = el.querySelectorAll && el.querySelectorAll('input[type="file"]');
                                    if (files && files.length) {
                                        for (const f of files) {
                                            try {
                                                if (!f.dataset.bdfz_modified_accept) {
                                                    f.dataset.bdfz_modified_accept = '1';
                                                    f.dataset.bdfz_orig_accept = f.getAttribute('accept') || '';
                                                    f.setAttribute('accept', 'image/*');
                                                }
                                            } catch (_) {
                                            }
                                        }
                                    }
                                } catch (e) {
                                }
                            }
                        }
                    }
                }
                if (m.type === 'attributes' && isFileInput(m.target)) {
                    try {
                        if (!m.target.dataset.bdfz_modified_accept) {
                            m.target.dataset.bdfz_modified_accept = '1';
                            m.target.dataset.bdfz_orig_accept = m.target.getAttribute('accept') || '';
                            m.target.setAttribute('accept', 'image/*');
                        }
                    } catch (_) {
                    }
                }
            }
        });

        try {
            mo.observe(document.documentElement || document, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['accept', 'type']
            });
        } catch (e) {
            document.addEventListener('DOMContentLoaded', () => {
                try {
                    mo.observe(document.body, {
                        childList: true,
                        subtree: true,
                        attributes: true,
                        attributeFilter: ['accept', 'type']
                    });
                } catch (e2) {
                }
            });
        }
    }

    // initial scan
    function initialScan() {
        try {
            const inputs = document.querySelectorAll('input[type="file"]');
            for (const inp of inputs) {
                try {
                    if (!inp.dataset.bdfz_modified_accept) {
                        inp.dataset.bdfz_modified_accept = '1';
                        inp.dataset.bdfz_orig_accept = inp.getAttribute('accept') || '';
                        inp.setAttribute('accept', 'image/*');
                    }
                } catch (e) {
                }
            }
        } catch (e) {
        }
    }

    // Start
    patchInputClick();
    observeInputs();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialScan);
    } else {
        initialScan();
    }

})();
