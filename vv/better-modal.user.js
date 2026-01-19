// ==UserScript==
// @name         统一弹窗
// @namespace    https://github.com/botaothomaszhao/pkus-xny-ultra
// @version      vv.1.0
// @license      GPL-3.0
// @description  将不同类型的弹窗样式统一，提供全屏、点击旁边关闭功能。可能合并到删除无用元素脚本中。
// @author       botaothomaszhao
// @match        https://bdfz.xnykcxt.com:5002/*
// @exclude      https://bdfz.xnykcxt.com:5002/exam/pdf/web/viewer.html*
// @grant        GM_addStyle
// @run-at       document-body
// ==/UserScript==

(function () {
    'use strict';



})();

/*
modal-overlay：答案

<div data-v-14d7a1be="" data-v-3a756815="" class="modal-overlay">
<div data-v-14d7a1be="" class="modal-content">
<div data-v-14d7a1be="" class="modal-header">
<div data-v-14d7a1be="" class="modal-title">
<span data-v-14d7a1be=""> **标题** </span></div>
<div data-v-14d7a1be="" class="modal-close"><i data-v-14d7a1be="" aria-label="图标: fullscreen" tabindex="-1" class="imgicom mr-10 anticon anticon-fullscreen">
<svg viewBox="64 64 896 896" data-icon="fullscreen" ></svg></i>
<i data-v-14d7a1be="" aria-label="图标: close-square" tabindex="-1" class="anticon anticon-close-square" style="font-size: 26px;">
<svg viewBox="64 64 896 896" data-icon="close-square" class=""></svg></i></div></div>
<div data-v-14d7a1be="" class="modal-body">
**具体内容**
</div></div></div>

ant-modal-mask : pdf 解析

<div data-v-3a756815="" class="ant-modal-root">
<div class="ant-modal-mask"></div>
<div tabindex="-1" role="dialog" aria-labelledby="rcDialogTitle4" class="ant-modal-wrap ">
<div role="document" class="ant-modal" style="width: 870px; transform-origin: 406px 8px;">
<div tabindex="0" aria-hidden="true" style="width: 0px; height: 0px; overflow: hidden;"></div>
<div class="ant-modal-content">
<button type="button" aria-label="Close" class="ant-modal-close">
<span class="ant-modal-close-x"><i aria-label="图标: close" class="anticon anticon-close ant-modal-close-icon">
<svg viewBox="64 64 896 896" data-icon="close" width="1em" height="1em" fill="currentColor" aria-hidden="true" focusable="false" class="">
</svg></i></span></button>
<div class="ant-modal-header"><div id="rcDialogTitle4" class="ant-modal-title">**标题**</div></div>
<div class="ant-modal-body"> **具体内容** </div></div>
<div tabindex="0" aria-hidden="true" style="width: 0px; height: 0px; overflow: hidden;"></div></div></div></div>

bg-box box : 筛选
 */
