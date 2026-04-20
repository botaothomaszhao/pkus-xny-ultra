// ==UserScript==
// @name         页面清理
// @namespace    https://github.com/botaothomaszhao/pkus-xny-ultra
// @version      vv.4.2
// @license      GPL-3.0
// @description  自动删除页面中的无用元素。
// @author       c-jeremy botaothomaszhao
// @match        https://bdfz.xnykcxt.com:5002/*
// @exclude      https://bdfz.xnykcxt.com:5002/exam/pdf/web/viewer.html*
// @grant        GM_addStyle
// @run-at       document-body
// ==/UserScript==

(function () {
    'use strict';

    const UNIFIED_ATTR = 'xny-modal-unified';

    const imgBoxSelector = '.result2';
    const emptyImgSelector = '.result2:not(:has(.errorBorder)):not(:has(img[src]))';

    const textMap = [{
        selector: 'button.ant-btn', text: '扫描作答', replaceText: null // 替换为null表示隐藏该元素
    }, {
        selector: '.right', text: '系统自动提交倒计时：', replaceText: '自动提交倒计时：' // 考试页中倒计时和文字平级
    }, {
        selector: '.tag', text: null, replaceText: null
    }, {
        selector: '.time', text: null, replaceText: null
    }];

    // 注入样式，用来可控隐藏但保留 DOM
    const hideClass = 'vu-preserve-hidden';

    GM_addStyle(`
        .${hideClass} { 
            display: none !important;
        }
        /* 课程页顶部按钮栏高度限制 */
        .content > .top, .content > div > .top {
            max-height: 70px !important;
        }
        /* 课程标签栏改为可滑动 */
        .swiper-container {
            overflow-x: auto !important;
            scroll-snap-type: x mandatory;
            scroll-behavior: smooth;
        }
        .swiper-container .swiper-slide {
            scroll-snap-align: start;
        }
        .swiper_box .anticon-left:hover, .swiper_box .anticon-right:hover {
            background-color: #cfd6e8 !important;
        }
        .router-view {
            overflow-y: hidden !important;
        }
    `);

    function cleanInnerText(el) {
        if (!el) return "";
        const clone = el.cloneNode(true);
        clone.querySelectorAll("i, svg, path").forEach(n => n.remove());
        return clone.textContent.trim().replace(/\s+/g, '');
    }

    function hidePreserve(el) {
        if (!el || el.classList.contains(hideClass)) return;
        el.classList.add(hideClass);
    }

    function restore(el) {
        if (!el) return;
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
                    n.style.display = 'none';
                } else {
                    span.textContent = replaceText;
                }
                break;
            }
        }
    }

    function setTabBtn(node) {
        if (node.getAttribute(UNIFIED_ATTR) === '1') return;
        const container = node.parentElement.querySelector('.swiper-container');
        if (!container) return;
        node.setAttribute(UNIFIED_ATTR, '1');

        let scrolling = false;

        function doScroll(direction) {
            if (scrolling) return;
            scrolling = true;

            // 获取单个标签页宽度（snap会自动对齐）
            container.scrollBy({
                left: direction * container.querySelector('.swiper-slide').offsetWidth,
                behavior: 'smooth'
            });
            setTimeout(() => {
                scrolling = false;
            }, 250);
        }

        const rightOrLeft = node.matches('.anticon-right');
        node.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            doScroll(rightOrLeft ? 1 : -1);
        }, true);
    }

    let scanScheduled = false;
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
                        if (node.matches('.swiper_box .anticon-left, .swiper_box .anticon-right')) { // swiper_box就是下划线，别问为什么
                            setTabBtn(node);
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
        if (scanScheduled) return;
        scanScheduled = true;
        requestAnimationFrame(() => {
            scanScheduled = false;
            elementMatch();
        });
    });

    observer.observe(document.documentElement, {childList: true, subtree: true, attributes: true});

    // 监听提交按钮点击，自动恢复答题区按钮
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const btnText = cleanInnerText(btn);
        if (btnText !== '手动提交' && btnText !== '手动补交') return;

        const answerAreaBtn = Array.from(document.querySelectorAll('button.ant-btn')).find(
            btn => btn.innerText.trim().endsWith('答题区')
        );

        // 如果答题区按钮处于展开状态，监听其变化并恢复
        if (answerAreaBtn?.classList.contains('ant-btn-primary')) {
            const observer = new MutationObserver(() => {
                if (!answerAreaBtn.classList.contains('ant-btn-primary')) {
                    answerAreaBtn.click();
                    observer.disconnect();
                }
            });
            observer.observe(answerAreaBtn, {attributes: true, attributeFilter: ['class']});
        }
    }, true);

    let contentScrollId = 0;
    let activeScrollKey = ''; // 'ArrowUp' | 'ArrowDown' | ''
    const scrollVelocity = 0.8; // px/ms，按键触发时的滚动速度

    function stopContentScroll() {
        cancelAnimationFrame(contentScrollId);
        contentScrollId = 0;
        activeScrollKey = '';
    }

    function startContentScroll(pxPerMs) {
        const content = document.querySelector('.um-content, .bg-layer-fff') // 支持弹窗和手写背景
            || document.querySelector('.content .question-body, .content .content-box') // 收藏、AI页
            || document.querySelector('.content');
        if (!content || !pxPerMs) return;
        
        cancelAnimationFrame(contentScrollId);
        let lastTs = 0;
        const step = (ts) => {
            if (!lastTs) lastTs = ts;
            const dt = Math.min(ts - lastTs, 50);
            lastTs = ts;
            content.scrollBy({top: pxPerMs * dt, left: 0, behavior: 'instant'});
            contentScrollId = requestAnimationFrame(step);
        };
        contentScrollId = requestAnimationFrame(step);
    }

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;

        const active = document.activeElement;
        const tag = active?.tagName;
        if (active && (active.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') || e.target.role === 'slider') return;
        if (active && active !== document.body && !active.closest('.content, .um-overlay, .write')) return;

        const direction = e.key === 'ArrowUp' ? -1 : 1;

        // 只在第一次按下某方向时启动；若按住上又按下，则立即切换为最新方向
        if (activeScrollKey !== e.key) {
            activeScrollKey = e.key;
            startContentScroll(direction * scrollVelocity);
        }
        e.preventDefault();
        e.stopPropagation();
    }, true);

    document.addEventListener('keyup', (e) => {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        
        // 只在释放当前激活方向时停止；避免“按住上+点按下”时松开下导致停掉上
        if (e.key !== activeScrollKey) return;
        stopContentScroll();
    }, true);

    window.addEventListener('blur', stopContentScroll);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) stopContentScroll();
    });
    
})();
