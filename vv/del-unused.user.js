// ==UserScript==
// @name         删除无用元素
// @namespace    https://github.com/botaothomaszhao/pkus-xny-ultra
// @version      vv.2.4
// @license      GPL-3.0
// @description  自动删除无用页面元素，包括头部“学科素养”、“考试用时”和未提交时的空图片框。
// @author       c-jeremy botaothomaszhao
// @match        https://bdfz.xnykcxt.com:5002/*
// @exclude      https://bdfz.xnykcxt.com:5002/exam/pdf/web/viewer.html*
// @grant        GM_addStyle
// @run-at       document-body
// ==/UserScript==

(function () {
    'use strict';

    GM_addStyle(`
        .content > .top, .content > div > .top {
            max-height: 70px !important;
        }
    `);

    const simpleSelectors = ['.tag', '.time'];
    const imgBoxSelector = '.result2';
    const emptyImgSelector = '.result2:not(:has(.errorBorder)):not(:has(img[src]))';

    const textMap = [{
        selector: 'button.ant-btn', text: '扫一扫传答案', replaceText: null
    }, {
        selector: 'button.ant-btn', text: '补交答题区', replaceText: '答题区'
    }, {
        selector: '.right', text: '系统自动提交倒计时：', replaceText: '自动提交倒计时：' // 考试页中倒计时和文字平级
    }]

    // 注入样式，用来可控隐藏但保留 DOM
    const hideClass = 'vu-preserve-hidden';
    const hideAttr = 'data-vu-hidden';
    const style = document.createElement('style');
    style.textContent = `.${hideClass} { display: none !important; }`;
    document.head.appendChild(style);

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
        if (el.matches(emptyImgSelector)) {
            hidePreserve(el);
        } else {
            restore(el);
        }
    }

    let debounceTimer = null;

    function debounceTextMatch() {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            for (const {selector, text, replaceText} of textMap) {
                const nodes = document.querySelectorAll(selector);
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
        }, 200);
    }

    function removeTargetElements(root = document) {
        if (root !== document && root.matches) {
            for (const sel of simpleSelectors) {
                if (root.matches(sel)) {
                    root.remove();
                    return;
                }
            }
            if (root.matches(imgBoxSelector)) processResult2(root);
        }

        // 删除简单选择器
        for (const sel of simpleSelectors) {
            const els = root.querySelectorAll(sel);
            els.forEach(e => e.remove());
        }

        debounceTextMatch();

        // 只查找需要处理的 .result2，processResult2 内会再判断是否隐藏/恢复
        const resultEls = root.querySelectorAll(imgBoxSelector);
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
            if (m.addedNodes?.length) {
                m.addedNodes.forEach(node => {
                    if (node.nodeType !== 1) return;
                    const r = node.closest(imgBoxSelector);
                    if (r) {
                        processResult2(r);
                    } else {
                        removeTargetElements(node);
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
    });

    observer.observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['src']});
})();
