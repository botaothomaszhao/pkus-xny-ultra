// ==UserScript==
// @name         删除无用元素
// @namespace    https://github.com/botaothomaszhao/pkus-xny-ultra
// @version      vv.3.1
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
        if (debounceTimer){
            clearTimeout(debounceTimer);
        } else {
            groupContentChildren();
            
        }
        debounceTimer = setTimeout(function () {
                groupContentChildren();
                debounceTimer = null;
            }, 300);
    }

    // 将 parent 的top以后的子元素收拢到一个 wrapper 中
    async function groupContentChildren() {
        const url = window.location.href;
            let parent;
            if (url.includes("/#/course")) {
                parent = document.querySelector('.content');
            } else if (url.includes("/#/exam")) {
                parent = document.querySelector('.content > div');
            } else return;
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

        // 要移动的节点（从第 2 个子元素开始）
    let toMove = Array.from(parent.children).slice(1);
    let wrapper;

// 找到已有 wrapper
const wrapperIndex = toMove.findIndex(n => n.classList.contains(WRAPPER_CLASS));
if (wrapperIndex === -1) {
    // 不存在 wrapper：创建并把所有 toMove 都塞进去
    wrapper = document.createElement('div');
    wrapper.classList.add(WRAPPER_CLASS);
    parent.insertBefore(wrapper, parent.children[1] || null);
} else {
    // 已存在 wrapper：利用 wrapperIndex 分段处理
    wrapper = toMove[wrapperIndex];

    const before = toMove.slice(0, wrapperIndex);       // wrapper 之前的节点
    toMove  = toMove.slice(wrapperIndex + 1);      // wrapper 之后的节点

    // 先把 before 段插到 wrapper 最前面（保持原顺序）
    if (before.length) {
        const frag = document.createDocumentFragment();
        for (const node of before) {
            frag.appendChild(node); // 按当前顺序塞进 fragment
        }
        wrapper.insertBefore(frag, wrapper.firstChild); // 一次性插到最前
    }

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
