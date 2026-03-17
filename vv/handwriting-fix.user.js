// ==UserScript==
// @name         手写滑动修复
// @namespace    https://github.com/botaothomaszhao/pkus-xny-ultra
// @version      vv.6.0
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

    /**
     * =========================
     * 可配置项（按需修改）
     * =========================
     *
     * 说明：这里的设置只影响“单击/轻触补点”的绘制。
     * 拖动书写的线条样式仍由网站原本逻辑控制。
     */
    const SETTINGS = {
        // 补点时画笔颜色：
        // - null 表示尽量沿用当前 canvas ctx 的 strokeStyle/fillStyle
        // - 或填 '#000000' / 'rgb(0,0,0)' 等
        brushColor: null,

        // 补点时画笔宽度（像素）：
        // - null 表示尽量沿用 ctx.lineWidth
        brushWidth: null,

        // 补点半径：
        // - 默认使用 brushWidth/2（若可用），否则 2
        dotRadius: null,

        // 判定“单击/轻触”的移动阈值（像素）
        moveThresholdPx: 3,

        // 是否在补点时阻止事件继续传播（一般不需要；若出现双重落点可改 true）
        stopEventPropagation: false
    };

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

    function clampNumber(v, min, max) {
        if (typeof v !== 'number' || Number.isNaN(v)) return null;
        if (v < min) return min;
        if (v > max) return max;
        return v;
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

    function drawDot(ctx, x, y) {
        ctx.save();

        // 颜色：优先 SETTINGS，否者沿用已有
        if (SETTINGS.brushColor) {
            ctx.fillStyle = SETTINGS.brushColor;
            ctx.strokeStyle = SETTINGS.brushColor;
        } else {
            // 尽量用 strokeStyle；有些站点只设置 strokeStyle
            try {
                if (!ctx.fillStyle || ctx.fillStyle === 'rgba(0, 0, 0, 0)') {
                    ctx.fillStyle = ctx.strokeStyle;
                }
            } catch (_) {
                // ignore
            }
        }

        // 宽度：优先 SETTINGS，否则沿用
        if (typeof SETTINGS.brushWidth === 'number') {
            const w = clampNumber(SETTINGS.brushWidth, 0.5, 200);
            if (w) ctx.lineWidth = w;
        }

        // 半径：优先 SETTINGS.dotRadius，否则用 lineWidth/2，否则 2
        let r = null;
        if (typeof SETTINGS.dotRadius === 'number') {
            r = clampNumber(SETTINGS.dotRadius, 0.5, 200);
        }
        if (!r) {
            const lw = (typeof ctx.lineWidth === 'number' && ctx.lineWidth > 0) ? ctx.lineWidth : 0;
            r = lw ? Math.max(1, lw / 2) : 2;
        }

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

        /**
         * 4) 单击/轻触补点：
         * 原站通常只在 pointermove/touchmove 时 stroke，所以“点击不移动”不会画。
         * 我们在抬起时，如果几乎没移动，就手动补一个点。
         *
         * 说明：
         * - 使用 capture:true 以便尽量不受站点内部 stopPropagation 影响。
         * - 不主动 preventDefault，避免影响站点原本拖动书写流程。
         */
        canvas.addEventListener('pointerdown', function (e) {
            // 仅跟踪主键/主指针，避免多指干扰
            // mouse: buttons=1 才算按下；touch/pen 由浏览器保证
            if (e.pointerType === 'mouse' && e.button !== 0) return;

            state.pointerIsDown = true;
            state.pointerId = e.pointerId;
            state.pointerMoved = false;
            const pos = getCanvasPos(canvas, e);
            state.pointerDownX = pos.x;
            state.pointerDownY = pos.y;
        }, {capture: true, passive: true});

        canvas.addEventListener('pointermove', function (e) {
            if (!state.pointerIsDown) return;
            if (state.pointerId !== null && e.pointerId !== state.pointerId) return;

            const pos = getCanvasPos(canvas, e);
            if (distance(state.pointerDownX, state.pointerDownY, pos.x, pos.y) > SETTINGS.moveThresholdPx) {
                state.pointerMoved = true;
            }
        }, {capture: true, passive: true});

        canvas.addEventListener('pointerup', function (e) {
            if (!state.pointerIsDown) return;
            if (state.pointerId !== null && e.pointerId !== state.pointerId) return;

            state.pointerIsDown = false;

            if (!state.pointerMoved) {
                const pos = getCanvasPos(canvas, e);
                drawDot(ctx, pos.x, pos.y);

                if (SETTINGS.stopEventPropagation) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }

            state.pointerId = null;
            state.pointerMoved = false;
        }, {capture: true, passive: false});

        canvas.addEventListener('pointercancel', function () {
            state.pointerIsDown = false;
            state.pointerId = null;
            state.pointerMoved = false;
        }, {capture: true, passive: true});

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
