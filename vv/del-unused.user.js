// ==UserScript==
// @name         删除无用元素
// @namespace    https://github.com/botaothomaszhao/pkus-xny-ultra
// @version      vv.2.1
// @license      GPL-3.0
// @description  自动删除指定的元素；对 .result2 不直接删除，而是隐藏并在检测到图片后恢复以兼容上传流程。
// @match        https://bdfz.xnykcxt.com:5002/*
// @grant        none
// @run-at       document-body
// ==/UserScript==

(function () {
    'use strict';

    // '.result2:not(.pos-relative):not(:has(img[src]))'
    const simpleSelectors = ['.tag', '.time'];
    const hideClass = 'vu-preserve-hidden';
    const hideAttr = 'data-vu-hidden';

    // 注入样式，用来可控隐藏但保留 DOM（可根据需要调整）
    const style = document.createElement('style');
    style.textContent = `.${hideClass} { display: none !important; }`;
    document.head && document.head.appendChild(style);

    function hasValidImage(el) {
        if (!el) return false;
        const img = el.querySelector('img');
        if (!img) return false;
        const src = (img.getAttribute('src') || '').trim();
        return src !== '';
    }

    function hidePreserve(el) {
        if (!el || el.dataset[hideAttr]) return;
        el.setAttribute(hideAttr, '1');
        el.classList.add(hideClass);
    }

    function restoreIfHasImage(el) {
        if (!el) return false;
        if (hasValidImage(el)) {
            el.removeAttribute(hideAttr);
            el.classList.remove(hideClass);
            return true;
        }
        return false;
    }

    function processResult2(el) {
        if (!el || el.nodeType !== 1) return;
        if (hasValidImage(el)) return; // 已有图片，保留
        hidePreserve(el);
    }

    function removeTargetElements(root = document) {
        // 如果 root 本身是需要处理的单个节点
        if (root !== document && root.matches) {
            for (const sel of simpleSelectors) {
                if (root.matches(sel)) {
                    root.remove();
                    return;
                }
            }
            if (root.matches('.result2:not(.pos-relative)')) {
                processResult2(root);
            }
        }

        // 立即删除简单选择器
        for (const sel of simpleSelectors) {
            const els = (root.querySelectorAll ? root.querySelectorAll(sel) : []);
            els.forEach(e => e.remove());
        }

        // 对 .result2:not(.pos-relative) 使用隐藏保留策略
        const resultEls = (root.querySelectorAll ? root.querySelectorAll('.result2:not(.pos-relative)') : []);
        resultEls.forEach(el => processResult2(el));
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => removeTargetElements());
    } else {
        removeTargetElements();
    }
    window.addEventListener('load', () => removeTargetElements());

    // 观察新增节点与 img[src] 变化：若隐藏容器里出现有效 img，则恢复显示
    const observer = new MutationObserver(mutations => {
        for (const m of mutations) {
            // 处理新增节点：如果新增节点或其后代包含有效 img，则恢复对应容器
            if (m.addedNodes && m.addedNodes.length) {
                m.addedNodes.forEach(node => {
                    if (node.nodeType !== 1) return;
                    // 若新增的是 img 且带 src，找到最近的 .result2 并恢复
                    if (node.nodeName === 'IMG') {
                        const img = /** @type {HTMLElement} */ (node);
                        const src = (img.getAttribute && (img.getAttribute('src') || '').trim()) || '';
                        if (src) {
                            const r = img.closest && img.closest('.result2[data-vu-hidden="1"]');
                            if (r)console.log("node added img");
                            if (r) restoreIfHasImage(r);
                        }
                        return;
                    }
                    // 若新增节点包含 img[src]，恢复对应容器
                    const imgs = node.querySelectorAll ? node.querySelectorAll('img[src]') : [];
                    if (imgs && imgs.length) {
                        imgs.forEach(i => {
                            const r = i.closest && i.closest('.result2[data-vu-hidden="1"]');
                            if (r)console.log("node added img in subtree");
                            if (r) restoreIfHasImage(r);
                        });
                    }
                    // 其它情况：检查新增节点本身是否是 .result2 需隐藏/保留
                    if (node.matches && node.matches('.result2:not(.pos-relative)')) {
                        processResult2(node);
                    } else {
                        // 新增节点内部可能包含 .result2、.tag、.time
                        removeTargetElements(node);
                    }
                });
            }

            // 处理属性变化（关注 img 的 src）
            if (m.target/* && m.target.nodeName === 'IMG' && m.attributeName === 'src'*/) {
                const img = m.target;
                //const src = (img.getAttribute && (img.getAttribute('src') || '').trim()) || '';
                //if (src) {
                    const r = img.closest && img.closest('.result2[data-vu-hidden="1"]');
                    if (r) restoreIfHasImage(r);
                    const r2= img.closest && img.closest('.result2:not(.pos-relative)');
                    processResult2(r2)
                //}
            }
        }
    });

    // 观察子树变化并监听属性变化（img src）
    observer.observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['src']});
})();
