// ==UserScript==
// @name         自动收起侧边栏
// @namespace    https://github.com/botaothomaszhao/pkus-xny-ultra
// @version      vv.2
// @license      GPL-3.0
// @description  在页面首次加载和页面尺寸变化时自动收起/展开侧边栏
// @author       botaothomaszhao
// @match        https://bdfz.xnykcxt.com:5002/*
// @exclude      https://bdfz.xnykcxt.com:5002/exam/pdf/web/viewer.html*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // 配置区（根据需要修改）
    const SIDEBAR_SELECTOR = '.treeBox';

    // 侧边栏固定宽度
    const SIDEBAR_WIDTH = 200; // px
    const MIN_CONTENT_WIDTH = 600; // 收起后主内容区最小宽度要求 px

    // 防抖延迟（resize 后等待 ms）
    const DEBOUNCE_MS = 150;

    let lastDecision = null; // true=open, false=closed, null=unknown
    let debounceTimer = null;

    function isVisible(el) {
        if (!el) return false;
        const s = getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0) return false;
        if (el.offsetParent === null && s.position !== 'fixed') return false;
        const r = el.getBoundingClientRect();
        return r.width > 1 && r.height > 1;
    }

    function findToggleButton() {
        const nodes = Array.from(document.querySelectorAll(".put"));
        for (const n of nodes) if (isVisible(n)) return n;
        return nodes[0] || null;
    }

    function isSidebarOpen() {
        const sidebarEl = document.querySelector(SIDEBAR_SELECTOR);
        if (!sidebarEl) return false;
        const rect = sidebarEl.getBoundingClientRect();
        // 侧栏宽度明显大于 6px 且可见，则视为打开
        return rect.width > 6 && isVisible(sidebarEl);
    }

    async function toggleTo(targetOpen) {
        const current = isSidebarOpen();
        if (current === targetOpen) return;
        const btn = findToggleButton();
        if (!btn) {
            console.warn('Auto-collapse: 找不到 .put 切换按钮，无法自动切换。');
            return;
        }
        try {
            btn.click();
        } catch (e) {
            console.error('Auto-collapse: 切换侧边栏失败', e);
        }
    }

    function computeShouldOpen() {
        const w = document.documentElement.clientWidth || window.innerWidth;
        return w >= SIDEBAR_WIDTH + MIN_CONTENT_WIDTH;
    }

    async function decideAndApply() {
        const shouldOpen = computeShouldOpen();
        if (lastDecision === shouldOpen) return; // 决策没变则不动作（避免重复点击），且在用户操作后不会改变
        lastDecision = shouldOpen;

        const sidebar = document.querySelector(SIDEBAR_SELECTOR);
        if (!sidebar) {
            // 如果页面尚未渲染出侧栏，做一次延迟重试（但不持续观察 DOM）
            setTimeout(() => scheduleDecision(), 600);
            return;
        }
        await toggleTo(shouldOpen);
    }

    function scheduleDecision() {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            decideAndApply().catch(console.error);
        }, DEBOUNCE_MS);
    }

    // 启动逻辑：仅在首次加载和尺寸变化时响应（不使用大量 DOM 变更监听）
    if (document.readyState === 'loading') {
        window.addEventListener('load', () => {
            setTimeout(scheduleDecision, 300);
        });
    } else {
        setTimeout(scheduleDecision, 600);
    }

    // 监听 resize 与 ResizeObserver（两者兼备）
    window.addEventListener('resize', scheduleDecision, {passive: true});
    try {
        const ro = new ResizeObserver(scheduleDecision);
        ro.observe(document.documentElement);
    } catch (e) {
    }

})();
