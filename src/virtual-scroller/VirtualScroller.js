// Import Closure Library classes
goog.provide('virtualscroller.VirtualScroller');
goog.require('goog.dom');
goog.require('goog.dom.classlist');
goog.require('goog.ui.Component');
goog.require('goog.events.EventHandler');
goog.require('goog.events.EventType');
goog.require('virtualscroller.Direction');
goog.require('virtualscroller.CellModel');
goog.require('virtualscroller.structs.Deque');
goog.require('virtualscroller.CellModel');

virtualscroller.VirtualScroller.OFFSET = 100;

/**
 * Virtual Scroller class for efficiently handling large lists of items.
 * @class
 */
virtualscroller.VirtualScroller = class extends goog.ui.Component {
  /**
   * Initializes the Virtual Scroller.
   * @param {goog.dom.DomHelper=} opt_domHelper Optional DOM helper.
   */
  constructor(opt_domHelper) {
    super(opt_domHelper);
    /** @private @type {goog.events.EventHandler<!virtualscroller.VirtualScroller>} */
    this.frameElem_ = null;
    this.contentElem_ = null;
    this.probe_ = null;
    this.contentPosition_ = 0;
    this.prevPosition_ = 0;
    this.direction_ = virtualscroller.Direction.UP;
    /** @type {number} Index of data item which will be at top position in content. */
    this.initialIndex_ = 0;
    this.minIndex_ = 0;
    this.maxIndex_ = 0;
    this.renderFn_ = () => {};
    /** @type {(prevUsedCellIndex: number, currentCellIndex: number) => boolean | null} A function that returns whether cell from prevUsedCellIndex should br reused for cell at currentCellIndex. */
    this.reuseFn_ = () => {};
    /**
     * @type {(prevUsedCellIndex: number, currentCellIndex: number) => boolean | null} A function that returns whether cell from prevUsedCellIndex should br reused for cell at currentCellIndex.
     */
    this.shouldReuseFn_ = () => {};
    /**
     * @type {(dataIndex: number) => boolean} A function that returns whether we can render cell at given data index.
     */
    this.canRenderCelAtIndexFn_ = () => {};
    /**
     * @type {!virtualscroller.structs.Deque<virtualscroller.CellModel>}
     */
    this.model_ = new virtualscroller.structs.Deque();
  }

  createDom() {
    'use strict';
    this.decorateInternal(
      this.dom_.createDom(
        goog.dom.TagName.DIV,
        null,
        this.dom_.createDom(goog.dom.TagName.DIV, null)
      )
    );
  }

  /**
   * @param {Element} element Element to decorate.
   */
  decorateInternal(element) {
    'use strict';
    super.decorateInternal(element);
    const elem = this.getElement();
    const contentElem = this.dom_.getFirstElementChild(elem);
    goog.asserts.assert(
      this.contentElem_,
      'Content element must be present inside the frame element.'
    );

    goog.dom.classlist.add(elem, goog.getCssName('virtual-scroller-frame'));
    goog.dom.classlist.add(contentElem, goog.getCssName('virtual-scroller-content'));
    elem.style.overflowY = 'auto';
    elem.tabIndex = 0;

    contentElem.style.position = 'relative';
    contentElem.style.top = '0';
    contentElem.style.left = '0';
    contentElem.style.width = '100%';
    contentElem.style.minHeight = '100%';

    const probe = this.dom_.createDom(goog.dom.TagName.DIV);
    this.probe_ = probe;
    this.dom_.append(contentElem, probe);

    this.contentElem_ = contentElem;
    this.renderCells();
  }

  /**
   * Renders cells within the virtual scroller frame.
   */
  renderCells() {
    'use strict';

    const frame = this.getElement(); // Frame element (the main scroller)
    const content = this.dom_.getFirstElementChild(frame); // Content element inside frame

    const frameHeight = frame.clientHeight;
    let accumulatedHeight = 0;

    // Upper and lower offset (buffer area)
    const offset = 100; // You can adjust this value as needed

    // Clear current content
    this.dom_.removeChildren(content);

    // Array to store the rendered cells
    const renderedCells = [];

    let index = 0;
    // Keep adding cells until the accumulated height exceeds frame height + offset
    while (accumulatedHeight < frameHeight + offset * 2) {
      // Get a new cell element (DOM node)
      const cellDom = /** @type {Element} */ this.getCellDom();
      const cellModel = new virtualscroller.CellModel(this.initialIndex_ + index, 0, 0);
      cellDom.id = cellModel.elementId;

      this.model_.addBack(cellModel);
      this.dom_.appendChild(content, cellDom);
      const cellHeight = this.fillCellWithContent(index, this.renderFn_, null, cellDom);
      cellModel.height = cellHeight;
      cellModel.top = accumulatedHeight;
      cellDom.style.height = `${cellModel.height}px`;
      cellDom.style.top = `${cellModel.top}px`;

      accumulatedHeight += cellHeight;
      renderedCells.push(cellDom);
      index++;
    }
    this.contentHeight = Math.max(frameHeight, accumulatedHeight);
    this.contentElem_.style.height = this.contentHeight;
  }

  /**
   * Creates and returns a new cell DOM element.
   * The implementation of this method should be provided later.
   * @return {Element} A DOM element representing a cell.
   */
  getCellDom() {
    const cell = this.dom_.createDom(goog.dom.TagName.DIV);
    goog.dom.classlist.add(cell, goog.getCssName('virtual-scroller-cell'));
    cell.style.position = 'absolute';
    return cell;
  }

  /**
   * Fills the given cell element with content rendered into a fragment and sets its height based on measured content.
   * @param {number} index The index of the cell to fill.
   * @param {(index: number, fragment: DocumentFragment) => void | null} renderFn A function that renders content into the given DocumentFragment.
   * @param {(dom: Element) => void | null} reuseFn A function that uses content of previous cell to create current cell.
   * @param {Element} cellElem The DOM element representing the cell to be filled with content.
   * @return {number} client height of cell
   */
  fillCellWithContent(index, renderFn, reuseFn, cellElem) {
    'use strict';
    const fragment = this.dom_.getDocument().createDocumentFragment();
    // Renders cell content into fragment
    renderFn(index, fragment);
    this.dom_.removeChildren(this.probe_);
    this.dom_.append(this.probe_, fragment);
    const clientHeight = this.probe_.clientHeight;
    cellElem.style.height = `${clientHeight}px`;

    while (this.probe_.firstChild) {
      cellElem.appendChild(this.probe_.firstChild);
    }
    return clientHeight;
  }

  enterDocument() {
    'use strict';
    super.enterDocument();
    this.getHandler().listen(
      this.getElement(),
      goog.events.EventType.SCROLL,
      this.onContentScrolled_
    );
  }

  onContentScrolled_(e) {
    'use strict';
    this.contentPosition_ = this.getElement().scrollTop;
    if (this.prevPosition_ < this.contentPosition_) {
      this.direction_ =
        this.prevPosition_ < this.contentPosition_
          ? virtualscroller.Direction.UP
          : virtualscroller.Direction.DOWN;
    }

    const speed = this.calculateSpeed_(this.contentPosition_, this.prevPosition_);

    if (this.direction_ === virtualscroller.Direction.UP) {
      const sentinel = this.getClosestSentinel(false);
      if (sentinel && sentinel.top + sentinel.height >= this.contentPosition_) {
        this.placeCells_(this.direction_, speed);
      }
    }
    if (this.direction_ === virtualscroller.Direction.DOWN) {
      const sentinel = this.getClosestSentinel(true);
      if (
        sentinel &&
        sentinel.top + sentinel.height <= this.contentPosition_ + this.frameElem_.height
      ) {
        this.placeCells_(this.direction_, speed);
      }
    }
  }

  /**
   * Finds the closest sentinel item in the deque.
   * If moving from the top, finds the first sentinel item from the front.
   * If moving from the bottom, finds the first sentinel item from the back.
   *
   * @param {boolean} searchFromTop If true, searches from the front; if false, searches from the back.
   * @return {virtualscroller.CellModel|undefined} The closest sentinel item, or undefined if none exists.
   */
  getClosestSentinel(searchFromTop) {
    let result = undefined;

    if (searchFromTop) {
      this.model_.forEach((item) => {
        if (item.sentinel) {
          result = item;
          return true;
        }
      }, this);
    } else {
      this.model_.forEach(
        (item) => {
          if (item.sentinel) {
            result = item;
            return true;
          }
        },
        this,
        true
      );
    }

    return result;
  }

  /**
   * @param {number} contentPosition
   * @param {number} prevPosition
   */
  calculateSpeed_(contentPosition, prevPosition) {
    return 1;
  }

  /**
   * Positions the cells based on the current scroll direction and updates the content.
   * @param {virtualscroller.Direction} direction The current scroll direction (UP or DOWN).
   * @param {number} speed The speed with which user scrolls
   * TODO: speed may affect how many cells are removed/created in batch
   */
  placeCells_(direction, speed) {
    'use strict';
    const frame = this.getElement(); // Frame element (main scroller)
    const frameHeight = frame.clientHeight;

    let cellToRemove;
    let prevUsedCellIndex;
    let currentCellIndex;
    let modelOfCellToRemove;
    let cellHeight = 0;
    if (direction === virtualscroller.Direction.UP) {
      cellToRemove = this.dom_.getLastElementChild(this.contentElem_);
      prevUsedCellIndex = this.model_.peekBack().dataIndex;
      const peekFront = this.model_.peekFront();
      currentCellIndex = peekFront.dataIndex - 1;
      cellHeight = this.fillCellWithContentOptimized(
        prevUsedCellIndex,
        currentCellIndex,
        cellToRemove
      );
      modelOfCellToRemove = this.model_.removeBack();
      modelOfCellToRemove.top = peekFront.top - cellHeight;
      modelOfCellToRemove.height = cellHeight;
      modelOfCellToRemove.dataIndex = currentCellIndex;
      this.model_.addFront(modelOfCellToRemove);
      this.dom_.insertChildAt(this.contentElem_, cellToRemove, 0);
    } else {
      cellToRemove = this.dom_.getFirstElementChild(this.contentElem_);
      prevUsedCellIndex = this.model_.peekFront().dataIndex;
      const peekBack = this.model_.peekBack();
      currentCellIndex = peekBack.dataIndex + 1;
      cellHeight = this.fillCellWithContentOptimized(
        prevUsedCellIndex,
        currentCellIndex,
        cellToRemove
      );
      modelOfCellToRemove = this.model_.removeFront();
      modelOfCellToRemove.top = peekBack.top + peekBack.height;
      modelOfCellToRemove.height = cellHeight;
      modelOfCellToRemove.dataIndex = currentCellIndex;
      this.model_.addBack(modelOfCellToRemove);
      this.dom_.appendChild(this.contentElem_, cellToRemove);
    }

    modelOfCellToRemove.height = cellHeight;
    cellToRemove.style.height = `${cellHeight}px`;

    if (cellHeight + frameHeight > this.contentHeight) {
      const contentHeight = this.contentHeight + cellHeight;
      this.contentElem_.style.height = contentHeight;
      this.contentHeight = contentHeight;
      this.frameElem_.scrollTop +=
        (direction === virtualscroller.Direction.UP ? 1 : -1) * cellHeight;
    }
    if (direction === virtualscroller.Direction.UP) {
      this.model_.forEach((cell) => {
        cell.top += cellHeight;
        this.getDomHelper().getDocument().getElementById(cell.elementId).style.top =
          `${cell.top}px`;
      });
    }
  }

  /***
   * @param prevUsedCellIndex
   * @param currentCellIndex
   * @param cellToRemove
   * @return {number}
   */
  fillCellWithContentOptimized(prevUsedCellIndex, currentCellIndex, cellToRemove) {
    if (this.shouldReuseFn_(prevUsedCellIndex, currentCellIndex)) {
      return this.fillCellWithContent(currentCellIndex, null, this.reuseFn_, cellToRemove);
    } else {
      return this.fillCellWithContent(currentCellIndex, this.renderFn_, null, cellToRemove);
    }
  }

  /**
   * Cleans up resources used by the Virtual Scroller.
   */
  dispose() {
    super.dispose();
    console.log('Virtual Scroller disposed');
  }
};
