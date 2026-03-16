// ==UserScript==
// @name         手写滑动修复
// @namespace    https://github.com/botaothomaszhao/pkus-xny-ultra
// @version      vv.5.0
// @license      GPL-3.0
// @description  修复手写输入时窗口上下滑动问题，支持显示题干同时作答，在使用手写笔后屏蔽触摸。
// @author       c-jeremy botaothomaszhao
// @match        https://bdfz.xnykcxt.com:5002/*
// @grant        GM_addStyle
// @run-at       document-body
// ==/UserScript==

(function () {
    'use strict';

    GM_addStyle(`
        .content > .top:not(.mt-10.box), .content > div > .top:not(.mt-10.box) { /* 修复课程顶部操作栏乱动，mt-10.box 是AI页的，不修改 */
            position: absolute !important;
        }

        /* 让题干显示在画布之下 */
        .write .canvasAnswer .bg-layer-fff {
            z-index: 0 !important;
            pointer-events: none !important; /* 避免盖住触摸/鼠标事件 */
        }
        .board.answerCanvas .canvasBox-roll .canvasBox canvas {
            z-index: 1 !important;
            background: transparent !important;
        }
    `);

    const canvasSelector = '.board.answerCanvas';
    const fixedAttribute = 'data-tampermonkey-fixed';

    // 每个 canvas 自己的笔/触摸状态
    function createState() {
        return {
            penEverUsed: false,
            penIsDown: false
        };
    }

    // 对单个 canvas 应用修复
    function applyFix(container) {
        if (container.hasAttribute(fixedAttribute)) return;

        // 1) 阻止绘制操作被识别为滚动手势
        container.addEventListener('touchmove', function (event) {
            event.preventDefault();
            event.stopPropagation();
        }, {passive: false});

        // 2) 禁止在该元素上触发下拉刷新
        container.style.overscrollBehaviorY = 'contain';

        const btn = container.closest('.write').querySelector('.ml-15 .ant-btn');
        if (btn.classList.contains('ant-btn-primary')) {
            btn.click(); // 关闭此前打开的“查看题干”
        }

        const canvas = container.querySelector('canvas');
        if (!canvas) return;

        // 3) 为该 canvas 维护独立状态，并安装笔/触摸控制
        const state = createState();

        // Pointer 事件用来识别“笔是否按下/松开”
        // 监听在 canvas 上，确保与该 canvas 生命周期一致；canvas 被移除后状态自然丢失，从而“重置”。
        canvas.addEventListener('pointerdown', function (e) {
            if (e.pointerType !== 'pen') return;
            state.penEverUsed = true;
            state.penIsDown = true;
        }, {capture: true, passive: true});

        const onPenUpLike = function (e) {
            if (e.pointerType !== 'pen') return;
            state.penIsDown = false;
        };

        canvas.addEventListener('pointerup', onPenUpLike, {capture: true, passive: true});
        canvas.addEventListener('pointercancel', onPenUpLike, {capture: true, passive: true});

        // 触摸屏蔽 gate：
        // - 未见过笔：放行
        // - 见过笔：
        //   - 笔按下：放行 touch（按你的新逻辑）
        //   - 笔松开：屏蔽 touch，直到下一次笔按下
        function touchGate(event) {
            if (!state.penEverUsed) return;
            if (state.penIsDown) return;

            event.preventDefault();
            event.stopImmediatePropagation();
        }

        canvas.addEventListener('touchstart', touchGate, {capture: true, passive: false});
        canvas.addEventListener('touchmove', touchGate, {capture: true, passive: false});
        canvas.addEventListener('touchend', touchGate, {capture: true, passive: false});
        canvas.addEventListener('touchcancel', touchGate, {capture: true, passive: false});

        // 4) 标记为已处理，避免重复处理
        canvas.setAttribute(fixedAttribute, 'true');
    }

    const observer = new MutationObserver(function (mutations) {
        for (const mutation of mutations) {
            if (mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) {
                        if (node.matches(canvasSelector)) applyFix(node);
                        node.querySelectorAll(canvasSelector).forEach(applyFix);
                    }
                });
            }
        }
    });

    observer.observe(document.body, {childList: true, subtree: true});
})();
