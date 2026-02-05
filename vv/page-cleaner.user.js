// ==UserScript==
// @name         页面清理
// @namespace    https://github.com/botaothomaszhao/pkus-xny-ultra
// @version      vv.3.3
// @license      GPL-3.0
// @description  自动删除页面中的无用元素，并统一不同类型的弹窗样式。
// @author       c-jeremy botaothomaszhao
// @match        https://bdfz.xnykcxt.com:5002/*
// @exclude      https://bdfz.xnykcxt.com:5002/exam/pdf/web/viewer.html*
// @grant        GM_addStyle
// @run-at       document-body
// ==/UserScript==

(function () {
    'use strict';

    const UNIFIED_ATTR = 'xny-modal-unified';

    const imgBoxSelector = '.result2';
    const emptyImgSelector = '.result2:not(:has(.errorBorder)):not(:has(img[src]))';

    const textMap = [{
        selector: 'button.ant-btn', text: '扫描作答', replaceText: null
    }, {
        selector: '.right', text: '系统自动提交倒计时：', replaceText: '自动提交倒计时：' // 考试页中倒计时和文字平级
    }, {
        selector: '.tag', text: null, replaceText: null // 两个null表示删除该元素
    }, {
        selector: '.time', text: null, replaceText: null
    }];

    // 注入样式，用来可控隐藏但保留 DOM
    const hideClass = 'vu-preserve-hidden';

    GM_addStyle(`
        .${hideClass} { display: none !important; }
        /* 课程页顶部按钮栏高度限制 */
        .content > .top, .content > div > .top {
            max-height: 70px !important;
        }
        /* 课程标签栏改为可滑动 */
        .swiper-container {
            overflow-x: auto !important;
            scroll-snap-type: x mandatory;
            scroll-behavior: smooth;
        }
        .swiper-container .swiper-slide {
            scroll-snap-align: start;
        }
        .swiper_box .anticon-left:hover, .swiper_box .anticon-right:hover {
            background-color: #cfd6e8 !important;
        }
        .router-view {
            overflow-y: hidden !important;
        }
        
        .um-overlay {
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            z-index: 999;
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
            max-width: min(900px, calc(100vw - 64px));
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
            max-width: none;
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
            display: flex;
            flex-direction: column;
        }
        .um-icon-btn svg {
            width: 20px;
            height: 20px;
        }
        
        /* pdf预览 */
        .um-modal:not(.fullscreen) .um-content iframe {
            box-sizing: border-box;
            min-height: 500px;
            min-width: min(852px, calc(100vw - 102px));
        }
        .um-modal.fullscreen .um-content iframe {
            box-sizing: border-box;
            height: 99% !important;
        }
        /* 确认按钮置底 */
        .um-modal:not(.fullscreen) .um-content :is(.btn-box, .footer-box, .option-box.txt-r) {
            position: sticky;
            bottom: 0;
        }
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
        /* AI页错题来源/知识模块选择框高度 */
        .um-modal.fullscreen .um-content .box.h-380.mt-10 {
            flex: 1 1 auto;
            min-height: 0;
            overflow: auto;
        }
        .um-modal.fullscreen .um-content .s-box.pos-r {
            height: 100% !important;
        }
        /* 笔记输入框 */
        .um-modal:not(.fullscreen) .um-content .note-body {
            height: 340px;
        }
        .um-modal.fullscreen .um-content .note-body {
            height: calc(100% - 93px);
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
        constructor(title, content, onClose, closeOnOverlay = true) {
            this.onClose = onClose;
            this.isFullscreen = false;

            this.overlay = document.createElement('div');
            this.overlay.className = 'um-overlay';
            if (closeOnOverlay) {
                this.overlay.addEventListener('click', (e) => {
                    if (e.target === this.overlay) this.close();
                });
            }

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
        const btn = e.target.closest('button');
        const txt = cleanInnerText(btn);
        if (btn?.closest(btnSelector) && (txt !== '清空' && txt !== '删除笔记')) { // (txt === '确定' || txt === '取消' || txt === '确认')
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
     * - disableOverlayClose: [可选] 是否禁用点击弹窗以外直接关闭
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
        }, config.disableOverlayClose ? !config.disableOverlayClose : true);
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
        // PDF 预览 / 解析 / 收藏页筛选 / AI页筛选
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
                extraCloseBtn: '.btn-box, .flex.txt-r',
                closeBtn: '.ant-modal-close',
                async closeOriginal(root) {
                    root.querySelector('.ant-modal-mask').style.display = 'none';
                    await new Promise(r => setTimeout(r, 500));
                    root.style.display = '';
                }
            }));
        // 课程筛选 / 收藏 / 收藏标签
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
        // 笔记
        const deleteHandler = (e) => { // 响应删除笔记的确认框
            const btn = e.target.closest('button');
            const txt = cleanInnerText(btn);
            if (txt !== '确定') return;
            const messageBox = btn.closest('.ant-modal-root.ant-modal-confirm')?.querySelector('.ant-modal-body .ant-modal-confirm-content');
            if (cleanInnerText(messageBox) === '确认要删除笔记内容吗?') {
                unifiedModal?.close();
            }
        }
        document.querySelectorAll('.note').forEach(box =>
            catchGenericModal(box, {
                containerSelector: '.note-content',
                titleSelector: '.modal-title',
                bodySelector: '.note-content',
                getBodyNodes(bodyEl) {
                    return Array.from(bodyEl.childNodes).filter(node => !(node.matches && node.matches('.modal-header')));
                },
                hideOriginal(root) {
                    root.style.display = 'none';
                    document.addEventListener('click', deleteHandler);
                },
                extraCloseBtn: '.btn-box',
                closeBtn: '.anticon-close-square',
                async closeOriginal(root) {
                    root.style.display = '';
                    document.removeEventListener('click', deleteHandler);
                },
                disableOverlayClose: true
            }));
    }

    function hidePreserve(el) {
        if (!el || el.classList.contains(hideClass)) return;
        el.classList.add(hideClass);
    }

    function restore(el) {
        if (!el) return;
        el.classList.remove(hideClass);
    }

    // 只对匹配到的 .result2 进行判断：若没有 img[src] 则隐藏，否则恢复
    function processResult2(el) {
        if (!el || el.nodeType !== 1) return;
        if (el.matches(emptyImgSelector)) {
            hidePreserve(el);
        } else {
            restore(el);
        }
    }

    function elementMatch() {
        for (const {selector, text, replaceText} of textMap) {
            const nodes = document.querySelectorAll(selector);
            if (text === null && replaceText === null) {
                nodes.forEach(n => n.remove());
                continue;
            }
            for (const n of nodes) {
                const span = Array.from(n.querySelectorAll('span')).find(s => s.textContent.trim() === text);
                if (!span) continue;
                if (replaceText === null) {
                    n.remove();
                } else {
                    span.textContent = replaceText;
                }
                break;
            }
        }
    }

    function setTabBtn(node) {
        if (node.getAttribute(UNIFIED_ATTR) === '1') return;
        const container = node.parentElement.querySelector('.swiper-container');
        if (!container) return;
        node.setAttribute(UNIFIED_ATTR, '1');

        let scrolling = false;

        function doScroll(direction) {
            if (scrolling) return;
            scrolling = true;

            // 获取单个标签页宽度（snap会自动对齐）
            container.scrollBy({
                left: direction * container.querySelector('.swiper-slide').offsetWidth,
                behavior: 'smooth'
            });
            setTimeout(() => {
                scrolling = false;
            }, 250);
        }

        const rightOrLeft = node.matches('.anticon-right');
        node.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            doScroll(rightOrLeft ? 1 : -1);
        }, true);
    }

    let scanScheduled = false;
    const observer = new MutationObserver(mutations => {
        for (const m of mutations) {
            // 处理新增节点
            if (m.addedNodes?.length) {
                m.addedNodes.forEach(node => {
                    if (node.nodeType !== 1) return;
                    const r = node.closest(imgBoxSelector);
                    if (r) {
                        processResult2(r);
                    } else {
                        const resultEls = node.querySelectorAll(imgBoxSelector);
                        resultEls.forEach(el => processResult2(el));
                        if (node.matches('.swiper_box .anticon-left, .swiper_box .anticon-right')) { // swiper_box就是下划线，别问为什么
                            setTabBtn(node);
                        }
                    }
                });
            }

            if (m.removedNodes?.length) {
                m.removedNodes.forEach(node => {
                    if (node.nodeType !== 1) return;
                    const r = node.closest(imgBoxSelector);
                    if (r) {
                        processResult2(r);
                    }
                });
            }
        }
        if (scanScheduled) return;
        scanScheduled = true;
        requestAnimationFrame(() => {
            scanScheduled = false;
            scan();
            elementMatch();
        });
    });

    observer.observe(document.documentElement, {childList: true, subtree: true, attributes: true});
})();
