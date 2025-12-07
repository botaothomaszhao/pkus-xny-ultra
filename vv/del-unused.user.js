// ==UserScript==
// @name         删除无用元素
// @namespace    https://github.com/botaothomaszhao/pkus-xny-ultra
// @version      vv.3.0
// @license      GPL-3.0
// @description  自动删除无用页面元素，包括头部“学科素养”、“考试用时”和未提交时的空图片框，并修复顶部操作栏遮挡、滚动问题。
// @author       c-jeremy botaothomaszhao
// @match        https://bdfz.xnykcxt.com:5002/*
// @exclude      https://bdfz.xnykcxt.com:5002/exam/pdf/web/viewer.html*
// @grant        GM_addStyle
// @run-at       document-body
// ==/UserScript==

(function () {
    'use strict';

    const simpleSelectors = ['.tag', '.time'];
    const antBtnText = '扫一扫传答案';
    const imgBoxSelector = '.result2';
    const emptyImgSelector = '.result2:not(:has(.errorBorder)):not(:has(img[src]))';

    GM_addStyle(`
        .content {
            overflow-y: hidden !important;
        }
        .content > .top, .content > div > .top {
            position: static !important;
            max-height: 52px !important; // todo: 用flex解决top过高问题
        }
        .vu-grouped-children {
            max-height: calc(100vh - 108px);
            overflow-y: auto;
        }
    `);

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
        // 找到特定文字内容的按钮
        const btn = Array.from(root.querySelectorAll('button.ant-btn'))
            .find(b => b.querySelector('span')?.textContent.trim() === antBtnText);
        if (btn) {
            btn.remove();
        }

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

    const WRAPPER_CLASS = 'vu-grouped-children';
    let debounceTimer = null;

    function debounceGroup() {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function () {
            const url = window.location.href;
            let parent;
            if (url.includes("/#/course")) {
                parent = document.querySelector('.content');
            } else if (url.includes("/#/exam")) {
                parent = document.querySelector('.content > div');
            } else return;
            groupChildrenAfter(parent);
        }, 300);
    }

    // 将 parent 的top以后的子元素收拢到一个 wrapper 中
    async function groupChildrenAfter(parent) {
        if (!parent || parent.nodeType !== 1 || parent.children.length < 2) return;
        if (!parent.children[0].matches('.top')) return;
        console.log("Tampermonkey: 收拢多余子元素。", parent);

        if (!parent.classList.contains("whitespace-cleared")) {
            // 元素有 style height: 60px
            if (parent.children[1].classList.length === 0 && parent.children[1].style.height === "60px") {
                parent.classList.add("whitespace-cleared");
                await parent.children[1].remove();
            }
        }
        if (parent.children.length === 2) {
            parent.children[1].classList.add(WRAPPER_CLASS);
            return;
        }

        // 要移动的节点（从 startIndex 开始）
        const toMove = Array.from(parent.children).slice(1);
        let wrapper;

        // 如果已经存在 wrapper，则复用它
        const wrapperIndex = toMove.findIndex(n => n.classList.contains(WRAPPER_CLASS));
        if (wrapperIndex !== -1) {
            wrapper = toMove[wrapperIndex];
            toMove.splice(wrapperIndex, 1); // 从待移动列表中移除 wrapper 本身
        } else {
            wrapper = document.createElement('div');
            wrapper.classList.add(WRAPPER_CLASS);
            // 把 wrapper 插到第 startIndex 个位置（或末尾）
            parent.insertBefore(wrapper, parent.children[1] || null);
        }

        // 将剩下的节点移动进 wrapper
        for (const node of toMove) {
            wrapper.appendChild(node);
        }
    }

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
                        if (node.closest('.content')) {
                            debounceGroup();
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
    });

    observer.observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['src']});

    debounceGroup();
})();
