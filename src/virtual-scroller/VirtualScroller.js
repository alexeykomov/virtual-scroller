// Import Closure Library classes
goog.provide('virtualscroller.VirtualScroller');
goog.require('goog.dom');
goog.require('goog.dom.classlist');
goog.require('goog.ui.Component');
goog.require('goog.events.EventHandler');
goog.require('goog.events.EventType');
goog.require('virtualscroller.Direction');
goog.require('virtualscroller.VirtualScrollerOptions');
goog.require('virtualscroller.CellModel');
goog.require('virtualscroller.structs.Deque');
goog.require('virtualscroller.CellModel');

virtualscroller.VirtualScroller.OFFSET = 100;
virtualscroller.VirtualScroller.INITIAL_SENTINEL_NUM = 2;

/**
 * Virtual Scroller class for efficiently handling large lists of items.
 * @class
 */
virtualscroller.VirtualScroller = class extends goog.ui.Component {
  /**
   * Initializes the Virtual Scroller.
   * @param {goog.dom.DomHelper=} opt_domHelper Optional DOM helper.
   * @param {virtualscroller.VirtualScrollerOptions=} opt_options Optional configuration.
   */
  constructor(opt_domHelper, opt_options) {
    super(opt_domHelper);
    // Options.
    goog.asserts.assert(opt_options, 'Options must be provided.');
    goog.asserts.assert(
      typeof opt_options.renderFn === 'function',
      'renderFn is required and must be a function.'
    );
    goog.asserts.assert(
      typeof opt_options.initialIndex === 'number',
      'initialIndex is required and must be a number.'
    );
    const hasMinMaxIndex =
      typeof opt_options.minIndex === 'number' && typeof opt_options.maxIndex === 'number';
    const hasCanRenderCellFn = typeof opt_options.canRenderCellAtIndexFn === 'function';
    goog.asserts.assert(
      hasMinMaxIndex || hasCanRenderCellFn,
      'Either minIndex and maxIndex must be provided, or canRenderCellAtIndexFn must be defined.'
    );

    /** @type {number} Index of data item which will be at top position in content. */
    this.initialIndex_ = opt_options.initialIndex;
    this.minIndex_ = opt_options.minIndex;
    this.maxIndex_ = opt_options.maxIndex;
    this.renderFn_ = opt_options.renderFn || goog.abstractMethod;
    /** @type {(function(number, Element):Element) | undefined} A function that returns whether cell from prevUsedCellIndex should be reused for cell at currentCellIndex. */
    this.reuseFn_ = opt_options.reuseFn;
    /**
     * @type {(function(number, number):boolean) | undefined} A function that returns whether cell from prevUsedCellIndex should br reused for cell at currentCellIndex.
     */
    this.shouldReuseFn_ = opt_options.shouldReuseFn;
    /**
     * @type {function(number):boolean} A function that returns whether we can render cell at given data index.
     */
    this.canRenderCelAtIndexFn_ = opt_options.canRenderCellAtIndexFn || (() => true);

    /** @private @type {Element} */
    this.frameElem_ = null;
    /** @private @type {Element} */
    this.contentElem_ = null;
    /** @private @type {Element} */
    this.probe_ = null;
    /** @private @type {number} */
    this.contentPosition_ = 0;
    /** @private @type {number} */
    this.contentHeight_ = 0;
    /** @private @type {number} */
    this.prevPosition_ = 0;
    /** @private @type {virtualscroller.Direction} */
    this.direction_ = virtualscroller.Direction.UP;
    /**
     * @private @type {!virtualscroller.structs.Deque<virtualscroller.CellModel>}
     */
    this.cellsModel_ = new virtualscroller.structs.Deque();
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
    this.dom_.removeChildren(contentElem);
    goog.dom.classlist.add(elem, goog.getCssName('virtual-scroller-frame'));
    goog.dom.classlist.add(contentElem, goog.getCssName('virtual-scroller-content'));
    elem.style.overflowY = 'auto';
    elem.tabIndex = 0;

    contentElem.style.position = 'relative';
    contentElem.style.top = '0';
    contentElem.style.left = '0';
    contentElem.style.width = '100%';
    contentElem.style.minHeight = '100%';

    const probe = /** @type {Element} */ (this.dom_.createDom(goog.dom.TagName.DIV));
    probe.style.top = '-9999px';
    probe.style.left = '-9999px';
    probe.style.opacity = '0';
    probe.style.width = '100%';
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

    const frame = this.getElement();
    const content = this.contentElem_;

    const frameHeight = frame.clientHeight;
    let accumulatedHeight = 0;

    let index = this.initialIndex_;

    while (accumulatedHeight < frameHeight && this.canRender_(index)) {
      const cellDom = /** @type {Element} */ (this.getCellDom());
      const cellModel = new virtualscroller.CellModel(this.initialIndex_ + index, 0, 0);
      cellDom.id = cellModel.elementId;

      this.cellsModel_.addBack(cellModel);
      this.dom_.appendChild(content, cellDom);
      const cellHeight = this.fillCellWithContent(index, this.renderFn_, cellDom);
      cellModel.height = cellHeight;
      cellModel.top = accumulatedHeight;
      cellDom.style.height = `${cellModel.height}px`;
      cellDom.style.top = `${cellModel.top}px`;

      accumulatedHeight += cellHeight;
      index++;
    }
    accumulatedHeight = this.addBufferCells_(accumulatedHeight, frame, content, index);
    this.contentHeight_ = Math.max(frameHeight, accumulatedHeight);
    this.contentElem_.style.height = this.contentHeight_;
    const closestNonSentinel = this.getClosestSentinel(true, false);
    this.getElement().scrollTop = closestNonSentinel ? closestNonSentinel.top : 0;
  }

  addBufferCells_(accumulatedHeight, frame, content, index) {
    let bufferCellIndex = 0;
    while (
      this.canRender_(this.initialIndex_ - bufferCellIndex - 1) &&
      bufferCellIndex < virtualscroller.VirtualScroller.INITIAL_SENTINEL_NUM
    ) {
      accumulatedHeight += this.addBufferCell_(
        virtualscroller.Direction.UP,
        this.cellsModel_.peekFront().dataIndex - 1,
        frame,
        content
      );
      bufferCellIndex++;
    }
    bufferCellIndex = 0;
    while (
      this.canRender_(index + bufferCellIndex) &&
      bufferCellIndex < virtualscroller.VirtualScroller.INITIAL_SENTINEL_NUM
    ) {
      accumulatedHeight += this.addBufferCell_(
        virtualscroller.Direction.DOWN,
        this.cellsModel_.peekBack().dataIndex + 1,
        frame,
        content
      );
    }
    return accumulatedHeight;
  }

  canRender_(index) {
    if (this.canRenderCelAtIndexFn_) {
      return this.canRenderCelAtIndexFn_(index);
    }
    return this.minIndex_ <= index && index <= this.maxIndex_;
  }

  /**
   * Adds buffer cells either above or below the current frame.
   * @param {virtualscroller.Direction} direction Direction of cell addition: -1 for above, 1 for below.
   * @param {number} startIndex Starting index for cell addition.
   * @param {Element} frame The frame element.
   * @param {Element} content The content element.
   * @return {number} Height of cells
   */
  addBufferCell_(direction, startIndex, frame, content) {
    const index = startIndex;
    const cellDom = /** @type {Element} */ (this.getCellDom());
    const cellHeight = this.fillCellWithContent(index, this.renderFn_, cellDom);
    const cellModel = new virtualscroller.CellModel(index, cellHeight, 0);
    cellModel.sentinel = true;
    cellModel.height = cellHeight;

    cellDom.id = cellModel.elementId;

    if (direction === virtualscroller.Direction.UP) {
      const prevFirstCellModel = this.cellsModel_.peekFront();
      const prevFirstCellDom = this.dom_.getDocument().getElementById(prevFirstCellModel.elementId);
      this.dom_.insertSiblingBefore(prevFirstCellDom, cellDom);
      this.cellsModel_.addFront(cellModel);
      cellModel.top = prevFirstCellModel.top - cellHeight;
    } else {
      const prevFirstCellModel = this.cellsModel_.peekBack();
      this.cellsModel_.addBack(cellModel);
      this.dom_.appendChild(content, cellDom);
      cellModel.top = prevFirstCellModel.top + prevFirstCellModel.height;
    }

    cellDom.style.height = `${cellModel.height}px`;
    cellDom.style.top = `${cellModel.top}px`;

    return cellHeight;
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
    cell.style.width = '100%';
    return cell;
  }

  /**
   * Fills the given cell element with content rendered into a fragment and sets its height based on measured content.
   * @param {number} index The index of the cell to fill.
   * @param {function(number, DocumentFragment):void | null} renderFn A function that renders content into the given DocumentFragment.
   * @param {Element} cellElem The DOM element representing the cell to be filled with content.
   * @return {number} client height of cell
   */
  fillCellWithContent(index, renderFn, cellElem) {
    'use strict';
    goog.asserts.assert(this.probe_ !== null, 'Probe must be a Node.');
    const fragment = this.dom_.getDocument().createDocumentFragment();
    // Renders cell content into fragment
    renderFn(index, fragment);
    this.dom_.removeChildren(this.probe_);
    this.dom_.append(/** @type {!Node} */ (this.probe_), fragment);
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
   * Finds the closest item in the deque that matches the specified condition.
   * If `searchFromTop` is true, searches from the front; otherwise, searches from the back.
   * Can search for either sentinel or non-sentinel nodes based on the `findSentinel` parameter.
   *
   * @param {boolean} searchFromTop If true, searches from the front; if false, searches from the back.
   * @param {boolean=} findSentinel If true (default), searches for sentinel nodes; if false, searches for non-sentinel nodes.
   * @return {virtualscroller.CellModel|undefined} The closest matching item, or undefined if none exists.
   */
  getClosestSentinel(searchFromTop, findSentinel = true) {
    let result = undefined;

    const condition = (item) => (findSentinel ? item.sentinel : !item.sentinel);

    if (searchFromTop) {
      this.cellsModel_.forEach((item) => {
        if (condition(item)) {
          result = item;
          return true;
        }
      });
    } else {
      this.cellsModel_.forEach(
        (item) => {
          if (condition(item)) {
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
      prevUsedCellIndex = this.cellsModel_.peekBack().dataIndex;
      const peekFront = this.cellsModel_.peekFront();
      currentCellIndex = peekFront.dataIndex - 1;
      cellHeight = this.fillCellWithContentOptimized(
        prevUsedCellIndex,
        currentCellIndex,
        cellToRemove
      );
      modelOfCellToRemove = this.cellsModel_.removeBack();
      modelOfCellToRemove.top = peekFront.top - cellHeight;
      modelOfCellToRemove.height = cellHeight;
      modelOfCellToRemove.dataIndex = currentCellIndex;
      this.cellsModel_.addFront(modelOfCellToRemove);
      this.dom_.insertChildAt(this.contentElem_, cellToRemove, 0);
    } else {
      cellToRemove = this.dom_.getFirstElementChild(this.contentElem_);
      prevUsedCellIndex = this.cellsModel_.peekFront().dataIndex;
      const peekBack = this.cellsModel_.peekBack();
      currentCellIndex = peekBack.dataIndex + 1;
      cellHeight = this.fillCellWithContentOptimized(
        prevUsedCellIndex,
        currentCellIndex,
        cellToRemove
      );
      modelOfCellToRemove = this.cellsModel_.removeFront();
      modelOfCellToRemove.top = peekBack.top + peekBack.height;
      modelOfCellToRemove.height = cellHeight;
      modelOfCellToRemove.dataIndex = currentCellIndex;
      this.cellsModel_.addBack(modelOfCellToRemove);
      this.dom_.appendChild(this.contentElem_, cellToRemove);
    }

    modelOfCellToRemove.height = cellHeight;
    cellToRemove.style.height = `${cellHeight}px`;

    if (cellHeight + frameHeight > this.contentHeight_) {
      const contentHeight = this.contentHeight_ + cellHeight;
      this.contentElem_.style.height = contentHeight;
      this.contentHeight_ = contentHeight;

      if (direction === virtualscroller.Direction.UP) {
        this.frameElem_.scrollTop += cellHeight;
        this.cellsModel_.forEach((cell) => {
          cell.top += cellHeight;
          this.getDomHelper().getDocument().getElementById(cell.elementId).style.top =
            `${cell.top}px`;
        });
      }
    }
  }

  /***
   * Fills cell with content either by new render or by reusing old cell's frame.
   * @param prevUsedCellIndex {number}
   * @param currentCellIndex {number}
   * @param cellToRemove {Element}
   * @return {number}
   */
  fillCellWithContentOptimized(prevUsedCellIndex, currentCellIndex, cellToRemove) {
    let cellHeight = 0;
    if (this.reuseFn_ && this.shouldReuseFn_(prevUsedCellIndex, currentCellIndex)) {
      //TODO: check for potential layout blink when scrolling down and height of cell becomes larger.
      cellToRemove = this.reuseFn_(currentCellIndex, cellToRemove);
      cellHeight = cellToRemove.clientHeight;
    } else {
      cellHeight = this.fillCellWithContent(currentCellIndex, this.renderFn_, cellToRemove);
    }

    return cellHeight;
  }

  /**
   * Cleans up resources used by the Virtual Scroller.
   */
  dispose() {
    super.dispose();
    console.log('Virtual Scroller disposed');
  }
};
