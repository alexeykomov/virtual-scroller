goog.provide('virtualscroller.VirtualScrollerOptions');

/**
 * @fileoverview A record type defining the configuration options for the VirtualScroller.
 *
 * @record
 */
virtualscroller.VirtualScrollerOptions = function() {};

/** @type {number|undefined} */
virtualscroller.VirtualScrollerOptions.prototype.initialIndex;

/** @type {number|undefined} */
virtualscroller.VirtualScrollerOptions.prototype.minIndex;

/** @type {number|undefined} */
virtualscroller.VirtualScrollerOptions.prototype.maxIndex;

/** @type {function():void|undefined} */
virtualscroller.VirtualScrollerOptions.prototype.renderFn;

/**
 * @type {(function(number, number): boolean)|undefined}
 */
virtualscroller.VirtualScrollerOptions.prototype.reuseFn;

/**
 * @type {(function(number, number): boolean)|undefined}
 */
virtualscroller.VirtualScrollerOptions.prototype.shouldReuseFn;

/**
 * @type {(function(number): boolean)|undefined}
 */
virtualscroller.VirtualScrollerOptions.prototype.canRenderCellAtIndexFn;
