// ==UserScript==
// @name         手写滑动修复
// @namespace    https://github.com/botaothomaszhao/pkus-xny-ultra
// @version      v4.3
// @license      GPL-3.0
// @description  禁用动态加载的多个手写画板的滚动行为，避免影响绘制。
// @author       c-jeremy botaothomaszhao
// @match        https://bdfz.xnykcxt.com:5002/*
// @grant        GM_addStyle
// @run-at       document-body
// ==/UserScript==

(function () {
    'use strict';

    GM_addStyle(`
        .content > .top:not(.mt-10.box), .content > div > .top:not(.mt-10.box) {
            position: absolute !important;
        }
    `); // mt-10.box 是AI页的，不修改

    const containerSelector = 'body'; // 观察的稳定父容器选择器
    const canvasSelector = '.board.answerCanvas'; // 目标画板元素的选择器
    const fixedAttribute = 'data-tampermonkey-fixed'; // 用于标记已处理元素的属性

    // 对单个画板元素应用触摸/滚动修复
    function applyFix(element) {
        if (element.hasAttribute(fixedAttribute)) return;

        console.log('Tampermonkey: 对新画板应用修复。', element);

        // 1. 阻止绘制操作被识别为滚动手势
        element.addEventListener('touchmove', function (event) {
            event.preventDefault();
            event.stopPropagation();
        }, {passive: false});

        // 2. 禁止在该元素上触发下拉刷新
        element.style.overscrollBehaviorY = 'contain';

        // 3. 标记为已处理，避免重复处理
        element.setAttribute(fixedAttribute, 'true');
    }

    // 查找页面上的容器并开始观察其子元素变化
    function initializeObserver() {
        const container = document.querySelector(containerSelector);

        if (!container) {
            // 容器尚未加载时稍后重试（用于加载较慢的页面）
            setTimeout(initializeObserver, 500);
            return;
        }

        console.log('Tampermonkey: 找到容器，开始观察新画板。', container);

        // 创建 MutationObserver 以监听容器内部新增元素
        const observer = new MutationObserver(function (mutations) {
            for (const mutation of mutations) {
                // 仅关心被添加到页面的节点
                if (mutation.addedNodes.length > 0) {
                    // 在新增节点中查找未处理的画板并应用修复
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1) {
                            if (node.matches(canvasSelector)) applyFix(node);
                            node.querySelectorAll(canvasSelector).forEach(applyFix);
                        }
                    });
                }
            }
        });

        observer.observe(container, {childList: true, subtree: true});

        // 页面加载时再跑一次以处理在观察器附加前已存在的画板
        document.querySelectorAll(canvasSelector).forEach(applyFix);
    }

    initializeObserver();
})();
