// ==UserScript==
// @name         删除无用元素
// @namespace    https://github.com/botaothomaszhao/pkus-xny-ultra
// @version      vv.2.2
// @license      GPL-3.0
// @description  自动删除指定的元素；对 .result2 不直接删除，而是隐藏并在检测到图片后恢复以兼容上传流程。
// @match        https://bdfz.xnykcxt.com:5002/*
// @grant        none
// @run-at       document-body
// ==/UserScript==

(function () {
    'use strict';

    const simpleSelectors = ['.tag', '.time'];
    const imgBoxSelector = '.result2:not(.pos-relative)';
    const emptyImgSelector = '.result2:not(.pos-relative):not(:has(img[src]))';

    // 注入样式，用来可控隐藏但保留 DOM
    const hideClass = 'vu-preserve-hidden';
    const hideAttr = 'data-vu-hidden';
    const style = document.createElement('style');
    style.textContent = `.${hideClass} { display: none !important; }`;
    document.head && document.head.appendChild(style);

    function hidePreserve(el) {
        if (!el || el.hasAttribute(hideAttr)) return;
        el.setAttribute(hideAttr, '1');
        el.classList.add(hideClass);
    }

    function restore(el) {
        if (!el) return false;
        el.removeAttribute(hideAttr);
        el.classList.remove(hideClass);
    }

    // 只对匹配到的 .result2 进行判断：若没有 img[src] 则隐藏，否则恢复
    function processResult2(el) {
        if (!el || el.nodeType !== 1) return;
        if (el.matches && el.matches(emptyImgSelector)) {
            hidePreserve(el);
        } else {
            restore(el);
        }
        console.log("processResult2:", el, el.hasAttribute(hideAttr) ? "hidden" : "visible");
    }

    function removeTargetElements(root = document) {
        if (root !== document && root.matches) {
            for (const sel of simpleSelectors) {
                if (root.matches(sel)) {
                    root.remove();
                    return;
                }
            }
            if (root.matches(imgBoxSelector)) {
                processResult2(root);
            }
        }

        // 删除简单选择器
        for (const sel of simpleSelectors) {
            const els = (root.querySelectorAll ? root.querySelectorAll(sel) : []);
            els.forEach(e => e.remove());
        }

        // 只查找需要处理的 .result2，processResult2 内会再判断是否隐藏/恢复
        const resultEls = (root.querySelectorAll ? root.querySelectorAll(imgBoxSelector) : []);
        resultEls.forEach(el => processResult2(el));
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => removeTargetElements());
    } else {
        removeTargetElements();
    }
    window.addEventListener('load', () => removeTargetElements());

    const observer = new MutationObserver(mutations => {
        for (const m of mutations) {
            // 处理新增节点
            if (m.addedNodes && m.addedNodes.length) {
                m.addedNodes.forEach(node => {
                    if (node.nodeType !== 1) return;
                    const r = node.closest && node.closest(imgBoxSelector);
                    if (r) {
                        processResult2(r);
                    } else {
                        removeTargetElements(node);
                    }
                });
            }

            if (m.removedNodes && m.removedNodes.length) {
                m.removedNodes.forEach(node => {
                    if (node.nodeType !== 1) return;
                    console.log("remove" + node)
                    const r = node.closest && node.closest(imgBoxSelector);
                    if (r) {
                        processResult2(r);
                    }
                });
            }

        }
    });

    observer.observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['src']});
})();
