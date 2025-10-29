// ==UserScript==
// @name         BDFZ: 相册/相机选择（简化）
// @namespace    https://github.com/botaothomaszhao
// @version      2.0
// @description  拦截 .paizhao-btn 的按钮点击，提供“从相册/使用相机拍照(内置)”；相册=直接点击原始 input，相机=MediaDevices 拍照并回填到该 input。
// @match        https://bdfz.xnykcxt.com:5002/*
// @grant        none
// @run-at       document-body
// ==/UserScript==

(function () {
  'use strict';

  // 把拍到的 File 塞回指定 input 并触发 change
  function copyFilesToInput(files, input) {
    const dt = new DataTransfer();
    for (const f of files) dt.items.add(f);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function makeFileFromBlob(blob, filename = `photo_${Date.now()}.jpg`) {
    return new File([blob], filename, { type: blob.type || 'image/jpeg', lastModified: Date.now() });
  }

  // 简单的选择菜单
  function showChoiceMenu(origInput) {
    if (!origInput) return;
    if (document.getElementById('bdfz-upload-chooser')) return;

    console.log("bdfz-media: showChoiceMenu", origInput);

    const overlay = document.createElement('div');
    overlay.id = 'bdfz-upload-chooser';
    Object.assign(overlay.style, {
      position: 'fixed', left: '0', top: '0', right: '0', bottom: '0',
      zIndex: 2147483646, background: 'rgba(0,0,0,0.12)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      padding: '12px', boxSizing: 'border-box'
    });

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      width: '100%', maxWidth: '720px', borderRadius: '12px', background: '#fff', overflow: 'hidden'
    });

    function makeButton(text, bg) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = text;
      Object.assign(b.style, {
        width: '100%', padding: '14px', border: 'none',
        borderTop: '1px solid rgba(0,0,0,0.06)', background: bg || '#fff',
        fontSize: '16px', cursor: 'pointer'
      });
      return b;
    }

    const btnGallery = makeButton('从相册选择');
    const btnCamera = makeButton('使用相机拍照(内置)');
    const btnCancel = makeButton('取消', '#f5f5f5');

    panel.appendChild(btnGallery);
    panel.appendChild(btnCamera);
    panel.appendChild(btnCancel);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    function closeMenu() {
      try { overlay.remove(); } catch (_) {}
    }

    btnGallery.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMenu();
      try { origInput.click(); } catch (err) { console.warn('打开系统相册失败', err); }
    });

    btnCamera.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMenu();
      openCameraOverlay(origInput);
    });

    btnCancel.addEventListener('click', (e) => { e.stopPropagation(); closeMenu(); });
    overlay.addEventListener('click', () => { closeMenu(); });
  }

  // 相机拍照覆盖层（仅一套实现）
  function openCameraOverlay(origInput) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('当前浏览器不支持拍照');
      return;
    }

    if (document.getElementById('bdfz-media-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'bdfz-media-overlay';
    Object.assign(overlay.style, {
      position: 'fixed', left: '0', top: '0', right: '0', bottom: '0',
      zIndex: 2147483647, background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: '8px', padding: '12px', boxSizing: 'border-box', color: '#fff'
    });

    overlay.innerHTML = `
      <div style="width:100%;max-width:720px;aspect-ratio:3/4;background:#000;position:relative;border-radius:12px;overflow:hidden;display:flex;align-items:center;justify-content:center">
        <video id="bdfz-media-video" autoplay playsinline style="width:100%;height:100%;object-fit:cover;background:#000"></video>
        <canvas id="bdfz-media-canvas" style="display:none"></canvas>
      </div>
    `;

    const controls = document.createElement('div');
    Object.assign(controls.style, {
      display: 'flex', width: '100%', maxWidth: '720px',
      justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginTop: '6px'
    });

    function makeBtn(text, bg) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = text;
      Object.assign(b.style, {
        flex: '1', padding: '12px', fontSize: '15px',
        borderRadius: '8px', border: 'none', cursor: 'pointer',
        background: bg, color: '#fff'
      });
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

    const video = overlay.querySelector('#bdfz-media-video');
    const canvas = overlay.querySelector('#bdfz-media-canvas');

    let stream = null;
    let facingMode = 'environment';
    let lastBlob = null;

    async function startStream() {
      if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      video.srcObject = stream;
      await video.play();
    }

    function cleanup() {
      try { if (stream) stream.getTracks().forEach(t => t.stop()); } catch (_) {}
      try { overlay.remove(); } catch (_) {}
    }

    async function captureOnce() {
      const vw = video.videoWidth || 1280;
      const vh = video.videoHeight || 720;
      canvas.width = vw; canvas.height = vh;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, vw, vh);
      return new Promise((resolve) => canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.95));
    }

    function showPreview(blob) {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const ctx = canvas.getContext('2d');
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight; ctx.drawImage(img, 0, 0);
        video.style.display = 'none'; canvas.style.display = 'block';
        controls.innerHTML = '';
        controls.appendChild(btnRetake); controls.appendChild(btnConfirm); controls.appendChild(btnCancel);
        URL.revokeObjectURL(url);
      };
      img.onerror = () => { try { URL.revokeObjectURL(url); } catch (_) {} };
      img.src = url;
    }

    btnCapture.addEventListener('click', async () => {
      btnCapture.disabled = true;
      const blob = await captureOnce();
      btnCapture.disabled = false;
      if (!blob) { alert('拍照失败'); return; }
      lastBlob = blob; showPreview(blob);
    });

    btnRetake.addEventListener('click', async () => {
      canvas.style.display = 'none'; video.style.display = 'block';
      controls.innerHTML = '';
      controls.appendChild(btnSwitch); controls.appendChild(btnCapture); controls.appendChild(btnCancel);
      if (!stream) await startStream();
    });

    btnConfirm.addEventListener('click', () => {
      if (!lastBlob) return;
      const file = makeFileFromBlob(lastBlob);
      copyFilesToInput([file], origInput);
      cleanup();
    });

    btnCancel.addEventListener('click', cleanup);
    btnSwitch.addEventListener('click', async () => { facingMode = (facingMode === 'environment') ? 'user' : 'environment'; await startStream(); });

    overlay.addEventListener('click', (ev) => { if (ev.target === overlay) cleanup(); });

    startStream().catch(err => { console.error('getUserMedia error', err); alert('无法访问摄像头'); cleanup(); });
  }

  // 事件委托：更稳健地拦截 .paizhao-btn 按钮点击（支持 shadow DOM、pointer/touch）
  function findPaizhaoContextFromEvent(e) {
    // 尝试使用 composedPath() 来支持 shadow DOM
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

    // 退回到普通的 DOM 向上查找
    let el = e.target;
    while (el) {
      if (el.classList && el.classList.contains && el.classList.contains('paizhao-btn')) return el;
      el = el.parentElement;
    }
    return null;
  }

  function onPaizhaoTrigger(e) {
    try {
      // 调试日志：记录事件类型与目标，便于定位为何未触发
      try { console.debug('bdfz-media: onPaizhaoTrigger', e.type, e.target && (e.target.tagName + (e.target.className ? ' .' + e.target.className : ''))); } catch (e_) {}

      const root = findPaizhaoContextFromEvent(e);
      if (!root) return;
      // 找到容器内的按钮（确保是点击到按钮区域）
      // 若点击在输入框本身或其它位置也处理为打开选择
      const btn = (e.target && e.target.closest && e.target.closest('.paizhao-btn button')) || root.querySelector('button');
      if (!btn) return;

      const input = root.querySelector('input[type="file"]');
      if (!input) {
        try { console.debug('bdfz-media: found paizhao root but no input', root); } catch (e_) {}
        return;
      }

      try { console.debug('bdfz-media: paizhao trigger, input found', input); } catch (e_) {}

      // 阻止默认并弹出自定义菜单
      try { e.preventDefault(); e.stopPropagation(); } catch (err) {}
      showChoiceMenu(input);
    } catch (err) {
      console.error('bdfz-media: onPaizhaoTrigger error', err);
    }
  }

  // 监听 click/pointerdown/touchend/mousedown 四类事件以覆盖不同环境
  document.addEventListener('click', onPaizhaoTrigger, true);
  document.addEventListener('pointerdown', onPaizhaoTrigger, true);
  document.addEventListener('touchend', onPaizhaoTrigger, true);
  document.addEventListener('mousedown', onPaizhaoTrigger, true);

  // 直接绑定已存在或新近添加的 .paizhao-btn（短时轮询备份，避免 MutationObserver）
  function bindPaizhaoButtonsOnce() {
    try {
      const nodes = document.querySelectorAll && document.querySelectorAll('.paizhao-btn');
      if (!nodes || !nodes.length) return;
      for (const n of nodes) {
        try {
          if (n.dataset && n.dataset.bdfz_bound === '1') continue;
          const btn = n.querySelector && n.querySelector('button');
          const input = n.querySelector && n.querySelector('input[type="file"]');
          if (btn && input) {
            const handler = (e) => {
              try { e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation(); } catch (err) {}
              showChoiceMenu(input);
            };
            // bind multiple early events to outrun page handlers
            btn.addEventListener('click', handler, true);
            btn.addEventListener('pointerdown', handler, true);
            btn.addEventListener('touchend', handler, true);
            // mark bound
            try { n.dataset.bdfz_bound = '1'; } catch (e) {}
          }
        } catch (err) {}
      }
    } catch (err) {}
  }

  // 短时轮询，确保从页面加载后能绑定动态插入的按钮（5 秒内每 200ms）
  (function quickBindLoop() {
    let attempts = 0;
    const max = 25; // ~5s
    const id = setInterval(() => {
      try { bindPaizhaoButtonsOnce(); } catch (e) {}
      attempts++;
      if (attempts >= max) clearInterval(id);
    }, 200);
  })();

})();
