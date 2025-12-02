// ==UserScript==

// @name         Optimized Handwriting Fix

// @namespace    http://tampermonkey.net/

// @version      4.0

// @description  Efficiently disables scrolling on multiple, dynamically-loaded handwriting canvases without affecting the rest of the page.

// @author       CJeremy

// @match        https://bdfz.xnykcxt.com:5002/*

// @grant        none

// @run-at       document-body

// ==/UserScript==

(function () {

    'use strict';

    // --- CONFIGURATION ---

    const containerSelector = 'body'; // The stable parent element to observe.

    const canvasSelector = '.board.answerCanvas'; // The target element for our fix.

    const fixedAttribute = 'data-tampermonkey-fixed'; // Attribute to mark elements we've already processed.

    /**

     * Applies the touch and scroll fixes to a single canvas element.

     * @param {HTMLElement} element The canvas container element to fix.

     */

    function applyFix(element) {

        // First, check if we have already fixed this element. If so, do nothing.

        if (element.hasAttribute(fixedAttribute)) {

            return;

        }

        console.log('Tampermonkey: Applying fix to new canvas element.', element);

        // 1. Prevent drawing from being interpreted as a scroll gesture.

        element.addEventListener('touchmove', function (event) {

            event.preventDefault();

            event.stopPropagation();

        }, {passive: false});

        // 2. Prevent pull-to-refresh when drawing on this specific element.

        element.style.overscrollBehaviorY = 'contain';

        // 3. Mark the element as fixed to prevent re-processing.

        element.setAttribute(fixedAttribute, 'true');

    }

    /**

     * Searches the page for the main container and starts observing it for changes.

     */

    function initializeObserver() {

        const container = document.querySelector(containerSelector);

        if (!container) {

            // If the container isn't on the page yet, wait a moment and try again.

            // This is a fallback for very slow-loading sites.

            setTimeout(initializeObserver, 500);

            return;

        }

        console.log('Tampermonkey: Found container. Observing for new canvases.', container);

        // Create an observer that will watch for new elements being added inside the container.

        const observer = new MutationObserver(function (mutations) {

            for (const mutation of mutations) {

                // We only care about nodes that have been added to the page.

                if (mutation.addedNodes.length > 0) {

                    // Find all unfixed canvas elements within the added nodes and apply the fix.

                    mutation.addedNodes.forEach(node => {

                        if (node.nodeType === 1) { // Ensure it's an element

                            // Check if the added node itself is a canvas we need to fix

                            if (node.matches(canvasSelector)) {

                                applyFix(node);

                            }

                            // Also check if the added node CONTAINS any canvases (more common)

                            node.querySelectorAll(canvasSelector).forEach(applyFix);

                        }

                    });

                }

            }

        });

        // Start observing the target container for child elements being added or removed.

        observer.observe(container, {

            childList: true, // Watch for direct children being added/removed.

            subtree: true    // Watch for all descendants being added/removed.

        });

        // As a final check, run the fix once on page load for any canvases that

        // might have loaded before the observer was attached.

        document.querySelectorAll(canvasSelector).forEach(applyFix);

    }

    // Start the process.

    initializeObserver();

})();
