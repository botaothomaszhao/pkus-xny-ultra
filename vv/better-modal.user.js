// ==UserScript==
// @name         统一弹窗
// @namespace    https://github.com/botaothomaszhao/pkus-xny-ultra
// @version      vv.1.2
// @license      GPL-3.0
// @description  将不同类型的弹窗样式统一，提供全屏、点击旁边关闭功能。可能合并到删除无用元素脚本中。
// @author       botaothomaszhao
// @match        https://bdfz.xnykcxt.com:5002/*
// @exclude      https://bdfz.xnykcxt.com:5002/exam/pdf/web/viewer.html*
// @grant        GM_addStyle
// @run-at       document-body
// ==/UserScript==

(function () {
    'use strict';

    const UNIFIED_ATTR = 'modal-unified';

    GM_addStyle(`
        .um-overlay {
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            z-index: 9999;
            opacity: 0;
            transition: opacity .25s ease;
            background-color: rgba(0, 0, 0, 0.55);
        }
        .um-overlay.visible {
            opacity: 1;
            pointer-events: auto;
        }
        .um-overlay.fullscreen {
            background-color: transparent;
            padding: 0;
        }
        .um-modal {
            width: min(900px, calc(100vw - 64px));
            max-height: calc(100vh - 64px);
            margin: 32px auto;
            background: #fff;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(15, 23, 42, 0.25);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            transform: translateY(20px);
            transition: transform 0.2s ease;
        }
        .um-overlay.visible .um-modal {
            transform: translateY(0);
        }
        .um-modal.fullscreen {
            width: 100vw;
            height: 100vh;
            max-height: none;
            border-radius: 0;
            box-shadow: none;
            margin: 0;
        }
        .um-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 15px 20px;
            border-bottom: 1px solid #e5e7eb;
            background: #f8fafc;
        }
        .um-title {
            font-size: 1.1rem;
            font-weight: 600;
            color: #111827;
            margin: 0;
        }
        .um-actions {
            display: flex;
            gap: 8px;
        }
        .um-icon-btn {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border: none;
            background: transparent;
            color: #6b7280;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: background-color 0.15s ease, color 0.15s ease;
        }
        .um-icon-btn:hover {
            background: #e5e7eb;
            color: #111827;
        }
        .um-content {
            flex: 1;
            padding: 24px;
            padding-top: 10px;
            overflow: auto;
        }
        .um-modal.fullscreen .um-content {
            padding-bottom: 10px;
        }
        .um-icon-btn svg {
            width: 20px;
            height: 20px;
        }
        
        .um-modal:not(.fullscreen) .um-content iframe {
            box-sizing: border-box;
            min-height: 500px;
        }
        .um-modal.fullscreen .um-content iframe {
            box-sizing: border-box;
            height: 99% !important;
        }
    `);

    const ICONS = {
        fullscreen: `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 9 3 3 9 3"></polyline>
                <line x1="3" y1="3" x2="10" y2="10"></line>
                <polyline points="21 15 21 21 15 21"></polyline>
                <line x1="21" y1="21" x2="14" y2="14"></line>
            </svg>`,
        minimize: `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 3 9 9 3 9"></polyline>
                <line x1="3" y1="3" x2="10" y2="10"></line>
                <polyline points="15 21 15 15 21 15"></polyline>
                <line x1="21" y1="21" x2="14" y2="14"></line>
            </svg>`,
        close: `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>`
    };

    class UnifiedModal {
        constructor(title, content, onClose) {
            this.onClose = onClose;
            this.isFullscreen = false;

            this.overlay = document.createElement('div');
            this.overlay.className = 'um-overlay';
            this.overlay.addEventListener('click', (e) => {
                if (e.target === this.overlay) this.close();
            });

            this.modal = document.createElement('div');
            this.modal.className = 'um-modal';

            this.header = document.createElement('div');
            this.header.className = 'um-header';

            this.titleEl = document.createElement('h2');
            this.titleEl.className = 'um-title';
            this.titleEl.textContent = title;

            this.actions = document.createElement('div');
            this.actions.className = 'um-actions';

            this.fullscreenBtn = this.createButton('fullscreen', () => this.toggleFullscreen());
            this.closeBtn = this.createButton('close', () => this.close());
            this.actions.append(this.fullscreenBtn, this.closeBtn);

            this.header.append(this.titleEl, this.actions);

            this.contentEl = document.createElement('div');
            this.contentEl.className = 'um-content';

            this.modal.append(this.header, this.contentEl);
            this.overlay.appendChild(this.modal);

            if (content) this.setContent(content);

            document.body.appendChild(this.overlay);
            this.modal.addEventListener('keydown', (e) => this.escHandle(e), true);
            this.modal.addEventListener('keyup', (e) => this.escHandle(e), true);
            this.modal.tabIndex = -1;
            this.modal.focus();
            requestAnimationFrame(() => this.overlay.classList.add('visible'));
        }

        escHandle(e) {
            if (e.key === 'Escape' || e.key === 'Esc') {
                try {
                    e.preventDefault();
                    e.stopPropagation();
                } catch (_) {
                }
                this.close();
            }
        }

        createButton(type, handler) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'um-icon-btn';
            btn.innerHTML = ICONS[type];
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                handler();
            });
            return btn;
        }

        setContent(content) {
            this.contentEl.innerHTML = '';
            if (typeof content === 'string') {
                this.contentEl.innerHTML = content;
            } else {
                this.contentEl.append(...content);
            }
        }

        toggleFullscreen() {
            this.isFullscreen = !this.isFullscreen;
            this.overlay.classList.toggle('fullscreen', this.isFullscreen);
            this.modal.classList.toggle('fullscreen', this.isFullscreen);
            this.fullscreenBtn.innerHTML = this.isFullscreen ? ICONS.minimize : ICONS.fullscreen;
        }

        close() {
            if (this.overlay) {
                const oldOverlay = this.overlay;
                oldOverlay.classList.remove('visible');
                oldOverlay.addEventListener('transitionend', oldOverlay.remove, {once: true});
                this.overlay = null;
                this.isFullscreen = false;
                this.onClose?.();
            }
        }
    }

    let unifiedModal = null;

    function catchModalOverlay(overlay) {
        if (!overlay || overlay.getAttribute(UNIFIED_ATTR) === '1') return;
        const card = overlay.querySelector('.modal-content');
        if (!card) return;
        overlay.setAttribute(UNIFIED_ATTR, '1');
        const bodyEl = card.querySelector('.modal-body');
        const title = card.querySelector('.modal-title').textContent.trim();

        if (unifiedModal) unifiedModal.close();
        unifiedModal = new UnifiedModal(title, bodyEl.childNodes, () => {
            overlay.setAttribute(UNIFIED_ATTR, '0');
            unifiedModal = null;
        });
        overlay.querySelector('.anticon-close-square').click();
    }

    function catchAntModal(antModalRoot) {
        if (!antModalRoot || antModalRoot.getAttribute(UNIFIED_ATTR) === '1'
            || antModalRoot.querySelector('.ant-modal-mask').style.display === 'none') return;

        const modal = antModalRoot.querySelector('.ant-modal');
        if (!modal) return;
        antModalRoot.setAttribute(UNIFIED_ATTR, '1');
        const bodyEl = modal.querySelector('.ant-modal-body');
        const title = modal.querySelector('.ant-modal-title').textContent.trim();

        if (unifiedModal) unifiedModal.close();
        unifiedModal = new UnifiedModal(title, bodyEl.innerHTML, () => { // innerHTML还是childNodes？
            antModalRoot.setAttribute(UNIFIED_ATTR, '0');
            antModalRoot.style.display = '';
            antModalRoot.querySelector('.ant-modal-mask').style.display = 'none';
            unifiedModal = null;
        });
        antModalRoot.style.display = 'none';
        antModalRoot.querySelector('.ant-modal-close').click();
        setTimeout(() => antModalRoot.style.display = '', 500); // 等待动画结束后恢复
    }

    function scan() {
        document.querySelectorAll('.modal-overlay').forEach(catchModalOverlay);
        document.querySelectorAll('.ant-modal-root').forEach(catchAntModal);
    }

    let scanScheduled = false;
    const observer = new MutationObserver(() => {
        if (scanScheduled) return;
        scanScheduled = true;
        requestAnimationFrame(() => {
            scanScheduled = false;
            scan();
        });
    });
    observer.observe(document.documentElement, {childList: true, subtree: true, attributes: true});

})();

/*
modal-overlay：答案

<div data-v-14d7a1be="" data-v-3a756815="" class="modal-overlay">
<div data-v-14d7a1be="" class="modal-content">
<div data-v-14d7a1be="" class="modal-header">
<div data-v-14d7a1be="" class="modal-title">
<span data-v-14d7a1be=""> **标题** </span></div>
<div data-v-14d7a1be="" class="modal-close"><i data-v-14d7a1be="" aria-label="图标: fullscreen" tabindex="-1" class="imgicom mr-10 anticon anticon-fullscreen">
<svg viewBox="64 64 896 896" data-icon="fullscreen" ></svg></i>
<i data-v-14d7a1be="" aria-label="图标: close-square" tabindex="-1" class="anticon anticon-close-square" style="font-size: 26px;">
<svg viewBox="64 64 896 896" data-icon="close-square" class=""></svg></i></div></div>
<div data-v-14d7a1be="" class="modal-body">
**具体内容**
</div></div></div>

ant-modal-mask : pdf 解析

<div data-v-3a756815="" class="ant-modal-root">
<div class="ant-modal-mask"></div>
<div tabindex="-1" role="dialog" aria-labelledby="rcDialogTitle4" class="ant-modal-wrap ">
<div role="document" class="ant-modal" style="width: 870px; transform-origin: 406px 8px;">
<div tabindex="0" aria-hidden="true" style="width: 0px; height: 0px; overflow: hidden;"></div>
<div class="ant-modal-content">
<button type="button" aria-label="Close" class="ant-modal-close">
<span class="ant-modal-close-x"><i aria-label="图标: close" class="anticon anticon-close ant-modal-close-icon">
<svg viewBox="64 64 896 896" data-icon="close" width="1em" height="1em" fill="currentColor" aria-hidden="true" focusable="false" class="">
</svg></i></span></button>
<div class="ant-modal-header"><div id="rcDialogTitle4" class="ant-modal-title">**标题**</div></div>
<div class="ant-modal-body"> **具体内容** </div></div>
<div tabindex="0" aria-hidden="true" style="width: 0px; height: 0px; overflow: hidden;"></div></div></div></div>

bg-box box : 筛选
 */
