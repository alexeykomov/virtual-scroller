goog.provide('virtualscroller.structs.Deque');

/**
 * @fileoverview A generic double-ended queue (deque) implementation backed by a simple array.
 * Provides constant-time addition and removal operations from end and O(n) addition and removal operations from start.
 *
 * Example usage:
 *
 * @type {!virtualscroller.structs.Deque<number>}
 * const numberDeque = new virtualscroller.structs.Deque();
 * numberDeque.addFront(1);
 * numberDeque.addBack(2);
 * console.log(numberDeque.removeFront()); // Output: 1
 * console.log(numberDeque.removeBack());  // Output: 2
 *
 * @type {!virtualscroller.structs.Deque<string>}
 * const stringDeque = new virtualscroller.structs.Deque();
 * stringDeque.addFront('a');
 * stringDeque.addBack('b');
 * console.log(stringDeque.peekFront()); // Output: 'a'
 * console.log(stringDeque.peekBack());  // Output: 'b'
 *
 * @template T
 * @constructor
 */
virtualscroller.structs.Deque = function () {
  /** @private {!Array<T>} Internal array storage for deque elements. */
  this.items_ = [];
};

/**
 * Adds an element to the front of the deque.
 * @param {T} item The item to add.
 */
virtualscroller.structs.Deque.prototype.addFront = function (item) {
  this.items_.unshift(item);
};

/**
 * Adds an element to the back of the deque.
 * @param {T} item The item to add.
 */
virtualscroller.structs.Deque.prototype.addBack = function (item) {
  this.items_.push(item);
};

/**
 * Removes and returns an element from the front of the deque.
 * @return {T|undefined} The removed item, or `undefined` if the deque is empty.
 */
virtualscroller.structs.Deque.prototype.removeFront = function () {
  return this.items_.shift();
};

/**
 * Removes and returns an element from the back of the deque.
 * @return {T|undefined} The removed item, or `undefined` if the deque is empty.
 */
virtualscroller.structs.Deque.prototype.removeBack = function () {
  return this.items_.pop();
};

/**
 * Checks if the deque is empty.
 * @return {boolean} True if the deque is empty, false otherwise.
 */
virtualscroller.structs.Deque.prototype.isEmpty = function () {
  return this.items_.length === 0;
};

/**
 * Gets the number of elements in the deque.
 * @return {number} The size of the deque.
 */
virtualscroller.structs.Deque.prototype.size = function () {
  return this.items_.length;
};

/**
 * Peeks at the front element without removing it.
 * @return {T|undefined} The front item, or `undefined` if the deque is empty.
 */
virtualscroller.structs.Deque.prototype.peekFront = function () {
  return this.items_[0];
};

/**
 * Peeks at the back element without removing it.
 * @return {T|undefined} The back item, or `undefined` if the deque is empty.
 */
virtualscroller.structs.Deque.prototype.peekBack = function () {
  return this.items_[this.items_.length - 1];
};

/**
 * Iterates over each element in the deque, calling a provided callback function.
 * @param {function(T, number): void | boolean} callback The function to execute for each element. If returns true, exits early
 * @param {Object=} thisArg Optional. The value to use as `this` when executing `callback`.
 * @param {boolean=} reverse Optional. Whether should go from back to front.
 */
virtualscroller.structs.Deque.prototype.forEach = function (callback, thisArg, reverse) {
  if (reverse) {
    for (let i = this.items_.length - 1; i >= 0; i--) {
      if (callback.call(thisArg, this.items_[i], i)) {
        break;
      }
    }
  }
  for (let i = 0; i < this.items_.length; i++) {
    if (callback.call(thisArg, this.items_[i], i)) {
      break;
    }
  }
};
