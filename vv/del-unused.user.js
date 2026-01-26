// ==UserScript==
// @name         删除无用元素
// @namespace    https://github.com/botaothomaszhao/pkus-xny-ultra
// @version      vv.2.5
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

    function debounceMatch() {
        if (!debounceTimer) {
            elementMatch();
            debounceTimer = setTimeout(() => debounceTimer = null, 200);
        } else {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(elementMatch, 200);
        }
    } // todo: 优化

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
            debounceMatch();
        }
    });

    observer.observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['src']});

    debounceMatch();
})();
