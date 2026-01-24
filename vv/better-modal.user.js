// ==UserScript==
// @name         统一弹窗
// @namespace    https://github.com/botaothomaszhao/pkus-xny-ultra
// @version      vv.1.5
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
            display: flex;
            align-items: center;
        }
        .um-overlay.visible {
            opacity: 1;
            pointer-events: auto;
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
            transition: transform .25s ease;
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
        
        /* pdf预览 */
        .um-modal:not(.fullscreen) .um-content iframe {
            box-sizing: border-box;
            min-height: 500px;
        }
        .um-modal.fullscreen .um-content iframe {
            box-sizing: border-box;
            height: 99% !important;
        }
        /* 确认按钮置底 */
        .um-modal.fullscreen .um-content :is(.btn-box, .footer-box, .option-box.txt-r) {
            position: fixed;
            bottom: 20px;
            right: 24px;
        }
        /* 收藏区移除重复margin */
        .um-content .content-box :is(.add, .label-box) {
            margin-left: 0 !important;
            width: 100% !important;
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

    function cleanInnerText(el) {
        if (!el) return "";
        const clone = el.cloneNode(true);
        clone.querySelectorAll("i, svg, path").forEach(n => n.remove());
        return clone.textContent.trim().replace(/\s+/g, '');
    }

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
            this.contentEl.className = 'um-content con'; // 保留 con 类以兼容收藏弹窗样式

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

        async close() {
            if (this.overlay) {
                const oldOverlay = this.overlay;
                this.overlay = null;
                this.isFullscreen = false;
                oldOverlay.classList.remove('visible');
                await new Promise(resolve => {
                    oldOverlay.addEventListener('transitionend', resolve, {once: true});
                    setTimeout(resolve, 300); // 回退超时
                });
                await this.onClose?.();
                oldOverlay.remove();
            }
        }
    }

    let unifiedModal = null;

    function closeOnBtn(e, btnSelector) {
        const txt = cleanInnerText(e.target);
        if (e.target.tagName === 'BUTTON' && e.target.closest(btnSelector) && txt !== '清空') { //(txt === '确定' || txt === '取消' || txt === '确认')
            unifiedModal?.close();
        }
    }

    /*
     * - shouldSkip(root): [可选] 某些弹窗需要跳过时用
     * - containerSelector: 整个弹窗的主容器
     * - titleSelector: 标题元素选择器
     * - bodySelector: 内容容器选择器
     * - getBodyNodes(bodyEl): [可选] 自定义 body 内要搬运的节点（bg-box 用来排除 .title）
     * - hideOriginal(root): 打开统一弹窗时如何隐藏原弹窗
     * - extraBtn: [可选] 额外的确认、取消按钮选择器
     * - closeBtn: 关闭按钮选择器
     * - closeOriginal(root): 关闭统一弹窗时，如何触发原始关闭逻辑/恢复样式
     */
    async function catchGenericModal(rootEl, config) {
        if (!rootEl || rootEl.getAttribute(UNIFIED_ATTR) === '1' || config.shouldSkip?.(rootEl)) return;
        const container = rootEl.querySelector(config.containerSelector);
        if (!container) return;
        await unifiedModal?.close();

        const bodyEl = rootEl.querySelector(config.bodySelector);
        const title = cleanInnerText(container.querySelector(config.titleSelector));
        if (!bodyEl) return;
        const bodyNodes = config.getBodyNodes ? config.getBodyNodes(bodyEl) : bodyEl.childNodes;
        rootEl.setAttribute(UNIFIED_ATTR, '1');

        const handler = config.extraCloseBtn && container.querySelector(config.extraCloseBtn)
            ? e => closeOnBtn(e, config.extraCloseBtn) : null;
        if (handler) {
            document.addEventListener('click', handler);
        }

        unifiedModal = new UnifiedModal(title, bodyNodes, async () => {
            rootEl.setAttribute(UNIFIED_ATTR, '0');
            bodyEl.append(...unifiedModal.contentEl.childNodes);
            if (handler) {
                document.removeEventListener('click', handler);
            }

            container.querySelector(config.closeBtn).click();
            await config.closeOriginal(rootEl);
            unifiedModal = null;
        });
        config.hideOriginal(rootEl);
    }

    function scan() {
        // 答案
        document.querySelectorAll('.modal-overlay').forEach(overlay =>
            catchGenericModal(overlay, {
                containerSelector: '.modal-content',
                titleSelector: '.modal-title',
                bodySelector: '.modal-body',
                hideOriginal(root) {
                    root.style.display = 'none';
                },
                closeBtn: '.anticon-close-square',
                async closeOriginal(root) {
                    root.style.display = '';
                }
            }));
        // PDF 预览 / 解析 / 收藏页筛选
        document.querySelectorAll('.ant-modal-root').forEach(antModalRoot =>
            catchGenericModal(antModalRoot, {
                shouldSkip(root) {
                    return root.matches('.ant-modal-confirm') || root.querySelector('.ant-modal-mask').style.display === 'none';
                },
                containerSelector: '.ant-modal',
                titleSelector: '.ant-modal-title',
                bodySelector: '.ant-modal-body',
                hideOriginal(root) {
                    root.style.display = 'none';
                },
                extraCloseBtn: '.btn-box',
                closeBtn: '.ant-modal-close',
                async closeOriginal(root) {
                    root.querySelector('.ant-modal-mask').style.display = 'none';
                    await new Promise(r => setTimeout(r, 500));
                    root.style.display = '';
                }
            }));
        // 筛选 / 收藏 / 收藏标签
        document.querySelectorAll('.box:has(> .bg-box)').forEach(box =>
            catchGenericModal(box, {
                shouldSkip(root) {
                    return root.style.display === 'none';
                },
                containerSelector: '.con',
                titleSelector: '.title .left',
                bodySelector: '.con',
                getBodyNodes(bodyEl) {
                    return Array.from(bodyEl.childNodes).filter(node => !(node.matches && node.matches('.title')));
                },
                hideOriginal(root) {
                    root.style.visibility = 'hidden';
                },
                extraCloseBtn: '.footer-box, .option-box.txt-r',
                closeBtn: '.anticon-close-circle',
                async closeOriginal(root) {
                    root.style.visibility = 'visible';
                }
            }));
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
