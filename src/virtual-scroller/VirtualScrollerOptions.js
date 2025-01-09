/**
 * @fileoverview A record type defining the configuration options for the VirtualScroller.
 */
goog.provide('virtualscroller.VirtualScrollerOptions');

/**
 * @typedef {{
 *   initialIndex: number,
 *   minIndex: (number|undefined),
 *   maxIndex: (number|undefined),
 *   renderFn: (function(): void),
 *   reuseFn: ((function(number, Element): Element)|undefined),
 *   shouldReuseFn: ((function(number, number): boolean)|undefined),
 *   canRenderCellAtIndexFn: (function(number): boolean|undefined),
 *   constantSize: (boolean|undefined)
 * }}
 */
virtualscroller.VirtualScrollerOptions;

