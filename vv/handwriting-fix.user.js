// ==UserScript==
// @name         手写滑动修复
// @namespace    https://github.com/botaothomaszhao/pkus-xny-ultra
// @version      vv.5.6
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
            scrollbar-width: none;
        }
        .board.answerCanvas .canvasBox-roll .canvasBox canvas {
            z-index: 1 !important;
            background: transparent !important;
        }
        .write {
            overscroll-behavior-y: contain !important;
        }
    `);

    const containerSelector = '.board.answerCanvas'; // .write 创建时不一定有canvas
    const fixedAttribute = 'xny-handwrite-fixed';

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
            pointerId: null,

            // 手写笔出现后，触摸改为滚动题干背景
            touchScrollId: null,
            touchLastY: 0,
            touchLastTime: 0,
            touchVelocity: 0,

            // 共用滚动动画（惯性 / 按钮 / 键盘）
            scrollId: 0
        };
    }

    function getTouchById(touchList, id) {
        if (!touchList || id === null) return null;
        for (let i = 0; i < touchList.length; i++) {
            if (touchList[i].identifier === id) return touchList[i];
        }
        return null;
    }

    function getCanvasPos(canvas, evt) {
        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;

        // pointer 事件：直接使用 clientX/clientY
        if (typeof evt.clientX === 'number') {
            clientX = evt.clientX;
            clientY = evt.clientY;
        } else if (evt.touches?.length > 0) {
            clientX = evt.touches[0].clientX;
            clientY = evt.touches[0].clientY;
        } else if (evt.changedTouches?.length > 0) {
            clientX = evt.changedTouches[0].clientX;
            clientY = evt.changedTouches[0].clientY;
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

    function createArrowBtn(originBtn, startScroll, stopScroll) {
        const wrap = document.createElement('span');
        wrap.style.display = 'inline-flex';
        wrap.style.gap = '6px';
        wrap.style.marginLeft = '6px';
        wrap.style.verticalAlign = 'middle';
        wrap.style.display = 'none';

        const mkArrowBtn = (text, title) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'ant-btn ant-btn-default';
            b.title = title;
            b.textContent = text;
            b.style.padding = '0 6px';
            b.style.minWidth = '32px';
            b.style.touchAction = 'none'; // 避免触摸下的默认滚动/双击缩放/选中文本
            b.style.userSelect = 'none';
            return b;
        };

        const upBtn = mkArrowBtn('▲', '题干向上滚动');
        const downBtn = mkArrowBtn('▼', '题干向下滚动');

        const addHoldEvents = (btn, velocity) => {
            btn.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                startScroll(velocity);
            }, {capture: true, passive: false});
            btn.addEventListener('pointerup', stopScroll, {capture: true});
            btn.addEventListener('pointercancel', stopScroll, {capture: true});
            btn.addEventListener('pointerleave', stopScroll, {capture: true});
        };

        addHoldEvents(upBtn, -0.6);
        addHoldEvents(downBtn, 0.6);

        wrap.appendChild(upBtn);
        wrap.appendChild(downBtn);
        // 插到“查看题干”后面
        originBtn.insertAdjacentElement('afterend', wrap);

        const syncArrowVisibility = () => {
            const active = originBtn?.classList.contains('ant-btn-primary');
            wrap.style.display = active ? 'inline-flex' : 'none';
        };
        syncArrowVisibility();
        const btnMo = new MutationObserver(() => syncArrowVisibility());
        btnMo.observe(originBtn, {attributes: true, attributeFilter: ['class']});
        return btnMo;
    }

    // 对单个 canvas 应用修复
    function applyFix(container) {
        if (container.hasAttribute(fixedAttribute)) return;

        // 阻止绘制操作被识别为滚动手势
        container.addEventListener('touchmove', function (event) {
            event.preventDefault();
            event.stopPropagation();
        }, {passive: false});

        const canvas = container.querySelector('canvas');
        const ctx = canvas?.getContext('2d');
        if (!ctx) return;

        // 为该 canvas 维护独立状态，并安装笔/触摸控制
        const state = createState();

        // 合并后的 pointer 事件：
        //    - 维护 penEverUsed / penIsDown（给 touchGate 用）
        //    - 同时维护单击补点状态
        canvas.addEventListener('pointerdown', function (e) {
            // 更新“笔状态”（触摸屏蔽依赖）
            if (e.pointerType === 'pen') {
                state.penEverUsed = true;
                state.penIsDown = true;
            } else if (state.penEverUsed) return;

            // 更新“单击补点跟踪状态”
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
            // 更新“笔状态”（触摸屏蔽依赖）
            if (e.pointerType === 'pen') {
                state.penIsDown = false;
            } else if (state.penEverUsed) return; // 对补点也屏蔽触摸

            // 单击补点
            if (!state.pointerIsDown || e.pointerId !== state.pointerId) return;

            if (!state.pointerMoved && !canvas.classList.contains('xiangpica')) { // 为画笔而不是橡皮擦
                const pos = getCanvasPos(canvas, e);
                const colorBox = container.querySelector('.color-box');
                const slider = container.querySelector('.ant-slider-handle');
                const leftPercentStr = slider.style.left; // 获取画笔宽度百分比，2-10像素直径
                const leftPercent = leftPercentStr.endsWith('%') ? parseFloat(leftPercentStr) : 33;
                drawDot(ctx, pos.x, pos.y, colorBox.style.backgroundColor, leftPercent * 0.04 + 1);
            }

            state.pointerIsDown = false;
            state.pointerId = null;
            state.pointerMoved = false;
        };

        canvas.addEventListener('pointerup', onPointerUpLike, {capture: true, passive: true});
        canvas.addEventListener('pointercancel', onPointerUpLike, {capture: true, passive: true});

        function scrollTargetBy(top, behavior = 'smooth') {
            const target = container.querySelector('.bg-layer-fff');
            if (!target || !top) return false;
            const before = target.scrollTop;
            target.scrollBy({top: top, left: 0, behavior: behavior});
            return target.scrollTop !== before;
        }

        // 按钮/键盘持续滚动（rAF 每帧，与触摸惯性共用相同节奏）
        function stopScroll() {
            cancelAnimationFrame(state.scrollId);
            state.scrollId = 0;
        }

        function startContinuousScroll(pxPerMs) {
            stopScroll();
            let lastTs = 0;
            const step = (ts) => {
                if (!lastTs) lastTs = ts;
                const dt = Math.min(ts - lastTs, 50); // 限制最大步长，防切换后跳帧
                lastTs = ts;
                if (!scrollTargetBy(pxPerMs * dt, 'instant')) { state.scrollId = 0; return; }
                state.scrollId = requestAnimationFrame(step);
            };
            state.scrollId = requestAnimationFrame(step);
        }

        function startInertia() {
            stopScroll();
            let v = state.touchVelocity;
            if (!v) return;

            let lastTs = 0;
            const step = (ts) => {
                if (!lastTs) lastTs = ts;
                const dt = ts - lastTs;
                lastTs = ts;

                v *= 0.95;
                if (Math.abs(v) < 0.02) { state.scrollId = 0; return; }
                if (!scrollTargetBy(v * dt, 'instant')) { state.scrollId = 0; return; }
                state.scrollId = requestAnimationFrame(step);
            };

            state.scrollId = requestAnimationFrame(step);
        }

        // 触摸处理：
        // - 未见过笔：放行
        // - 见过笔且笔已抬起：屏蔽触摸落笔，并把上下滑动转成题干背景滚动
        function touchGateStart(event) {
            if (!state.penEverUsed || state.penIsDown) return;

            const touch = event.changedTouches[0] || event.touches[0];
            if (!touch) return;

            stopScroll();
            state.touchScrollId = touch.identifier;
            state.touchLastY = touch.clientY;
            state.touchLastTime = event.timeStamp;
            state.touchVelocity = 0;

            event.preventDefault();
            event.stopImmediatePropagation();
        }

        function touchGateMove(event) {
            if (!state.penEverUsed || state.penIsDown) return;
            event.preventDefault();
            event.stopImmediatePropagation();

            if (state.touchScrollId === null) return;
            const touch = getTouchById(event.touches, state.touchScrollId)
                || getTouchById(event.changedTouches, state.touchScrollId);
            if (!touch) return;

            const now = event.timeStamp;
            const delta = state.touchLastY - touch.clientY;

            if (delta) {
                scrollTargetBy(delta, 'instant');
                const v = delta / Math.max(1, now - state.touchLastTime);
                state.touchVelocity = state.touchVelocity * 0.7 + v * 0.3;
            }
            state.touchLastY = touch.clientY;
            state.touchLastTime = now;
        }

        function touchGateEnd(event) {
            if (state.touchScrollId === null) return;

            const ended = getTouchById(event.changedTouches, state.touchScrollId);
            if (!ended && event.touches.length > 0) return;

            state.touchScrollId = null;
            state.touchLastY = 0;
            state.touchLastTime = 0;
            startInertia();
        }

        canvas.addEventListener('touchstart', touchGateStart, {capture: true, passive: false});
        canvas.addEventListener('touchmove', touchGateMove, {capture: true, passive: false});
        // 手写笔的touchend在pointerup之后，屏蔽会导致抬笔后还在画，所以不能屏蔽
        canvas.addEventListener('touchend', touchGateEnd, {capture: true, passive: true});
        canvas.addEventListener('touchcancel', touchGateEnd, {capture: true, passive: true});

        // 滚动题干
        const btn = container.closest('.write').querySelector('.ml-15 .ant-btn');
        if (btn?.classList.contains('ant-btn-primary')) {
            btn.click(); // 关闭此前打开的“查看题干”
        }
        const btnMo = createArrowBtn(btn, startContinuousScroll, stopScroll);

        container.querySelector('.bg-layer')?.remove(); // 移除可能存在的卡死的“处理中”

        const ac = new AbortController();
        const {signal} = ac;
        // 监控 container 是否被移除
        const mo = new MutationObserver(() => {
            if (!container.isConnected) {
                ac.abort();   // 自动移除所有带 signal 的监听
                mo.disconnect();
                btnMo.disconnect();
            }
            if (container.querySelector('.bg-layer')) {
                const notice = document.body.querySelector('.ant-message .ant-message-notice .ant-message-notice-content .ant-message-custom-content');
                if (notice && notice.textContent.includes('没有书写笔迹')) {
                    container.querySelector('.bg-layer').remove(); // 没有书写笔迹则移除卡死的“处理中”
                }
            }
        });
        mo.observe(document.body, {childList: true, subtree: true});

        document.addEventListener('wheel', function (e) {
            if (e.ctrlKey) return; // 触控板缩放/浏览器缩放
            if (e.target.role === 'slider') return; // 画笔粗细调整

            // deltaMode: 0=像素,1=行,2=页
            let delta = e.deltaY;
            if (e.deltaMode === 1) delta *= 16;
            else if (e.deltaMode === 2) delta *= container.clientHeight - 90;

            if (scrollTargetBy(delta)) {
                e.stopPropagation();
            }
        }, {capture: true, signal});

        document.addEventListener('keydown', function (e) {
            if (e.ctrlKey || e.repeat) return;
            if (e.target.role === 'slider') return;

            let velocity = 0;
            if (e.key === 'ArrowDown') velocity = 0.6;
            else if (e.key === 'ArrowUp') velocity = -0.6;
            else return;

            if (!container.querySelector('.bg-layer-fff')) return; // 题干未显示时不消费按键
            e.preventDefault();
            e.stopPropagation();
            startContinuousScroll(velocity);
        }, {capture: true, signal});

        document.addEventListener('keyup', function (e) {
            if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
            stopScroll();
        }, {capture: true, signal});

        window.addEventListener('blur', stopScroll, {signal});
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) stopScroll();
        }, {signal});

        // 标记为已处理，避免重复处理
        container.setAttribute(fixedAttribute, 'true');
    }

    const observer = new MutationObserver(function (mutations) {
        for (const mutation of mutations) {
            if (mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) {
                        if (node.matches(containerSelector)) applyFix(node);
                        node.querySelectorAll(containerSelector).forEach(applyFix);
                    }
                });
            }
        }
    });

    observer.observe(document.body, {childList: true, subtree: true});
})();
