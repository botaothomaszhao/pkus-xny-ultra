// ==UserScript==
// @name         自动收起侧边栏
// @namespace    https://github.com/botaothomaszhao/pkus-xny-ultra
// @version      vv.2.1
// @license      GPL-3.0
// @description  在屏幕宽度改变时自动收起/展开侧边栏，并可通过点击左侧导航菜单展开。
// @author       botaothomaszhao
// @match        https://bdfz.xnykcxt.com:5002/*
// @exclude      https://bdfz.xnykcxt.com:5002/exam/pdf/web/viewer.html*
// @exclude      https://bdfz.xnykcxt.com:5002/stu/#/login
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const SIDEBAR_SELECTOR = '.treeBox';

    // 侧边栏固定宽度
    const SIDEBAR_WIDTH = 260; // px
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
        for (const n of nodes) {
            if (isVisible(n)) return n;
        }
        return nodes[0] || null;
    }

    function isSidebarOpen() {
        const sidebarEl = document.querySelector(SIDEBAR_SELECTOR);
        return isVisible(sidebarEl);
    }

    function toggleTo(targetOpen) {
        lastDecision = targetOpen;
        if (isSidebarOpen() === targetOpen) return;
        const btn = findToggleButton();
        if (!btn) {
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

    function decideAndApply() {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function () {
            const shouldOpen = computeShouldOpen();
            if (lastDecision === shouldOpen) return; // 决策没变则不动作（避免重复点击），且在用户操作后不会改变
            toggleTo(shouldOpen);
        }, DEBOUNCE_MS);
    }

    // 启动逻辑：仅在首次加载和尺寸变化时响应（不使用大量 DOM 变更监听）
    if (document.readyState === 'loading') {
        window.addEventListener('load', () => {
            setTimeout(decideAndApply, 300);
        });
    } else {
        setTimeout(decideAndApply, 600);
    }

    // 监听 resize 与 ResizeObserver（两者兼备）
    window.addEventListener('resize', decideAndApply, {passive: true});
    try {
        const ro = new ResizeObserver(decideAndApply);
        ro.observe(document.documentElement);
    } catch (e) {
    }

    // 点击导航条时，如果侧边栏已收起则展开，否则根据屏幕宽度自动决定
    window.addEventListener('click', (event) => {
        if (event.target.closest('.nav .menu')) {
            if (!isSidebarOpen()) {
                toggleTo(true);
            } else if (event.target.closest('.active')) {
                decideAndApply();
            }
        }
    }, true);

})();
