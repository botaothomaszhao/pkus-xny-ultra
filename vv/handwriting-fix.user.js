// ==UserScript==
// @name         手写滑动修复
// @namespace    https://github.com/botaothomaszhao/pkus-xny-ultra
// @version      vv.5.1
// @license      GPL-3.0
// @description  修复手写输入时窗口上下滑动问题，支持显示题干同时作答，在使用手写笔后屏蔽触摸。额外：补全单击/轻触在画布上落点。
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
            penIsDown: false,

            // 用于“单击补点”的指针状态（鼠标/触摸/笔都可能）
            pointerIsDown: false,
            pointerDownX: 0,
            pointerDownY: 0,
            pointerMoved: false,
            pointerId: null
        };
    }

    function getCanvasPos(canvas, evt) {
        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;

        // pointer 事件：直接使用 clientX/clientY
        if (typeof evt.clientX === 'number') {
            clientX = evt.clientX;
            clientY = evt.clientY;
        } else if (evt.touches && evt.touches.length > 0) {
            clientX = evt.touches[0].clientX;
            clientY = evt.touches[0].clientY;
        } else if (evt.changedTouches && evt.changedTouches.length > 0) {
            clientX = evt.changedTouches[0].clientX;
            clientY = evt.changedTouches[0].clientY;
        } else {
            clientX = 0;
            clientY = 0;
        }

        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    function distance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function drawDot(ctx, x, y, color, r) {
        ctx.save();
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
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

        const btn = container.closest('.write')?.querySelector('.ml-15 .ant-btn');
        if (btn && btn.classList.contains('ant-btn-primary')) {
            btn.click(); // 关闭此前打开的“查看题干”
        }

        const canvas = container.querySelector('canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // 3) 为该 canvas 维护独立状态，并安装笔/触摸控制
        const state = createState();

        // 触摸屏蔽：
        // - 未见过笔：放行
        // - 见过笔：
        //   - 笔按下：放行 touch（按你的新逻辑）
        //   - 笔松开：屏蔽 touch，直到下一次笔按下
        function touchGate(event) {
            if (state.penEverUsed && !state.penIsDown) {
                event.preventDefault();
                event.stopImmediatePropagation();
            }
        }

        canvas.addEventListener('touchstart', touchGate, {capture: true, passive: false});
        canvas.addEventListener('touchmove', touchGate, {capture: true, passive: false});
        canvas.addEventListener('touchend', touchGate, {capture: true, passive: false});
        canvas.addEventListener('touchcancel', touchGate, {capture: true, passive: false});

        /**
         * 4) 合并后的 pointer 事件：
         * - 维护 penEverUsed / penIsDown（给 touchGate 用）
         * - 同时维护单击补点状态
         */
        canvas.addEventListener('pointerdown', function (e) {
            // 先更新“笔状态”（触摸屏蔽依赖）
            if (e.pointerType === 'pen') {
                state.penEverUsed = true;
                state.penIsDown = true;
            } else if (state.penEverUsed) return;

            // 再更新“单击补点跟踪状态”
            // 仅跟踪主键/主指针，避免多指干扰
            if (e.pointerType === 'mouse' && e.button !== 0) return;

            state.pointerIsDown = true;
            state.pointerId = e.pointerId;
            state.pointerMoved = false;
            const pos = getCanvasPos(canvas, e);
            state.pointerDownX = pos.x;
            state.pointerDownY = pos.y;
        }, {capture: true, passive: true});

        canvas.addEventListener('pointermove', function (e) {
            if (state.penEverUsed && !state.penIsDown) return;
            if (!state.pointerIsDown || e.pointerId !== state.pointerId) return;

            const pos = getCanvasPos(canvas, e);
            if (distance(state.pointerDownX, state.pointerDownY, pos.x, pos.y) > 5) { // 超过阈值，认为是移动了
                state.pointerMoved = true;
            }
        }, {capture: true, passive: true});

        const onPointerUpLike = function (e) {
            // 先更新“笔状态”（触摸屏蔽依赖）
            if (e.pointerType === 'pen') {
                state.penIsDown = false;
            } else if(state.penEverUsed) return; // 对补点也屏蔽触摸

            // 再处理“单击补点”的收尾
            if (!state.pointerIsDown || e.pointerId !== state.pointerId) return;

            if (!state.pointerMoved && !canvas.classList.contains('xiangpica')) { // 为画笔而不是橡皮擦
                const pos = getCanvasPos(canvas, e);
                const colorBox = container.querySelector('.color-box');
                const slider = container.querySelector('.ant-slider-handle');
                const leftPercentStr = slider.style.left; // 获取画笔宽度百分比，2-10像素直径
                const leftPercent = leftPercentStr.endsWith('%') ? parseFloat(leftPercentStr) : 33;

                drawDot(ctx, pos.x, pos.y, colorBox.style.backgroundColor, leftPercent * 0.04 + 1);
                //e.preventDefault();
                //e.stopPropagation();
            }

            state.pointerIsDown = false;
            state.pointerId = null;
            state.pointerMoved = false;
        };

        canvas.addEventListener('pointerup', onPointerUpLike, {capture: true, passive: false});
        canvas.addEventListener('pointercancel', onPointerUpLike, {capture: true, passive: true});

        // 5) 标记为已处理，避免重复处理
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
