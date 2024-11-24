goog.provide('virtualscroller.CellModel');

/**
 * @fileoverview Represents a cell in a virtual scroller.
 * Each cell maps to a piece of data and holds relevant information like its index and height.
 *
 * Example usage:
 * const cell = new CellModel(0, 50);
 * console.log(cell.dataIndex); // Output: 0
 * console.log(cell.height);    // Output: 50
 */

/**
 * @class
 * @template T
 */
virtualscroller.CellModel = class CellModel {
  /**
   * @param {number} dataIndex - The index of the data item associated with this cell.
   * @param {number} height - The height of the cell in pixels.
   * @param {T=} metadata - Optional metadata associated with the cell.
   */
  constructor(dataIndex, height, metadata = null) {
    /** @type {number} */
    this.dataIndex = dataIndex;

    /** @type {number} */
    this.height = height;

    /** @type {T|null} */
    this.metadata = metadata;
  }

  /**
   * Updates the height of the cell.
   * @param {number} newHeight - The new height for the cell.
   */
  setHeight(newHeight) {
    this.height = newHeight;
  }

  /**
   * Retrieves the cell's metadata.
   * @return {T|null} The metadata associated with the cell.
   */
  getMetadata() {
    return this.metadata;
  }
};
