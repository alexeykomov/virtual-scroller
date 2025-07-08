// Import Closure Library classes
goog.provide('virtualscroller.VirtualScroller');
goog.require('goog.dom');
goog.require('goog.dom.classlist');
goog.require('goog.dom.dataset');
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
virtualscroller.VirtualScroller.BATCH_SIZE = 10;
virtualscroller.VirtualScroller.BUFFER_SIZE = 1;

/**
 * @typedef {{
 *   clientHeight: number,
 *   cellElems: !Array<!Element>,
 *   cellModels: !Array<!virtualscroller.CellModel>
 * }}
 */
virtualscroller.CellBatch;

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
    goog.asserts.assert(typeof opt_options.renderFn === 'function', 'renderFn is required and must be a function.');
    goog.asserts.assert(typeof opt_options.initialIndex === 'number', 'initialIndex is required and must be a number.');
    goog.asserts.assert(typeof opt_options.height === 'number' && opt_options.height > 0 && typeof opt_options.width === 'number' && opt_options.width > 0, 'Both height and width must be provided and greater than 0.');
    const hasMinMaxIndex = typeof opt_options.minIndex === 'number' && typeof opt_options.maxIndex === 'number';
    const hasCanRenderCellFn = typeof opt_options.canRenderCellAtIndexFn === 'function';
    goog.asserts.assert(hasMinMaxIndex || hasCanRenderCellFn, 'Either minIndex and maxIndex must be provided, or canRenderCellAtIndexFn must be defined.');

    /** @type {number} Index of data item which will be at top position in content. */
    this.initialIndex_ = opt_options.initialIndex;
    this.minIndex_ = opt_options.minIndex;
    this.maxIndex_ = opt_options.maxIndex;
    /** @type {(function(number, Element):void)} A function that renders cell content into provided cell. */
    this.renderFn_ = opt_options.renderFn;
    /** @type {(function(number, Element):Element) | undefined} A function that returns whether cell from prevUsedCellIndex should be reused for cell at currentCellIndex. */
    this.reuseFn_ = opt_options.reuseFn;
    /**
     * @type {(function(number, number):boolean) | undefined} A function that returns whether cell from prevUsedCellIndex should br reused for cell at currentCellIndex.
     */
    this.shouldReuseFn_ = opt_options.shouldReuseFn;
    /**
     * @type {function(number):boolean | undefined} A function that returns whether we can render cell at given data index.
     */
    this.canRenderCelAtIndexFn_ = opt_options.canRenderCellAtIndexFn;

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
    /** @private @type {number} */
    this.frameHeight_ = opt_options.height;
    /** @private @type {number} */
    this.frameWidth_ = opt_options.width;
    /** @private @type {number} */
    this.batchSize_ = opt_options.batchSize || virtualscroller.VirtualScroller.BATCH_SIZE;
    /** @private @type {number} */
    this.bufferSize_ = opt_options.bufferSize || virtualscroller.VirtualScroller.BUFFER_SIZE;
    /** @private @type {virtualscroller.Direction} */
    this.direction_ = virtualscroller.Direction.UP;
    /**
     * @private @type {!virtualscroller.structs.Deque<virtualscroller.CellModel>}
     */
    this.cellsModel_ = new virtualscroller.structs.Deque();
  }

  createDom() {
    'use strict';
    this.decorateInternal(this.dom_.createDom(goog.dom.TagName.DIV, null, this.dom_.createDom(goog.dom.TagName.DIV, null)));
  }

  /**
   * @param {Element} element Element to decorate.
   */
  decorateInternal(element) {
    'use strict';
    super.decorateInternal(element);
    const elem = this.getElement();
    const contentElem = this.dom_.getFirstElementChild(elem);
    this.contentElem_ = contentElem;
    goog.asserts.assert(this.contentElem_, 'Content element must be present inside the frame element.');
    this.dom_.removeChildren(contentElem);
    goog.dom.classlist.add(elem, goog.getCssName('virtual-scroller-frame'));
    goog.dom.classlist.add(contentElem, goog.getCssName('virtual-scroller-content'));
    elem.style.overflowY = 'auto';
    elem.tabIndex = 0;
    elem.style.height = `${this.frameHeight_}px`;
    elem.style.width = `${this.frameWidth_}px`;

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
    probe.style.position = 'relative';
    probe.id = 'virtual-scroller-probe';
    this.probe_ = probe;
    this.dom_.append(contentElem, probe);

    this.contentElem_ = contentElem;
    this.renderCells();
  }

  /**
   * Renders cells within the virtual scroller frame.
   */
  async renderCells() {
    'use strict';

    const content = this.contentElem_;

    const frameHeight = this.frameHeight_;

    let accumulatedHeight = 0;

    let index = this.initialIndex_;

    let batchSize = this.batchSize_;
    let canRender = true;
    let cellHeight;
    /** @type {!Array<!Element>} */
    let cellElems = [];
    /** @type {!Array<!virtualscroller.CellModel>} */
    let cellModels = [];
    while (accumulatedHeight < frameHeight || !canRender) {
      const indexes = []

      for (let i = this.initialIndex_; i < this.initialIndex_ + batchSize; i++) {
        if (!this.canRender_(i)) {
          canRender = false;
          break;
        }
        indexes.push(i);
      }

      const res = /** @type {virtualscroller.CellBatch}*/ (await this.createBatchOfCells_(indexes));
      console.log('res: ', res);

      cellHeight = res.clientHeight;
      accumulatedHeight = cellHeight;
      index++;
      batchSize *= 2;
      cellElems = res.cellElems;
      cellModels = res.cellModels;
    }

    for (const cellModel of cellModels) {
      this.cellsModel_.addBack(cellModel);
    }
    for (const cellDom of cellElems) {
      this.dom_.appendChild(content, cellDom);
    }

    this.contentHeight_ = Math.max(frameHeight, accumulatedHeight);
    this.contentElem_.style.height = `${this.contentHeight_}px`;
    await this.addBufferCells_();
  }

  /**
   * Adds buffer cells above and below the visible content area.
   * Marks sentinel cells for tracking the scroll edges.
   * @return {!Promise<void>}
   * @private
   */
  async addBufferCells_() {
    let bufferCellIndex = 0;
    const indicesTop = [];

    while (this.canRender_(this.initialIndex_ - bufferCellIndex - 1) &&
    bufferCellIndex < this.bufferSize_) {
      indicesTop.push(this.initialIndex_ - bufferCellIndex - 1);
      bufferCellIndex++;
    }
    console.log('bufferCellIndex: ', bufferCellIndex);

    const indicesBottom = [];
    let existingSentinelsCount = 0;

    this.cellsModel_.forEach((cellModel) => {
      if (cellModel.top <= this.frameHeight_) {
        existingSentinelsCount++;
        cellModel.sentinel = true
      }
    });

    const lastIndex = (/**@type {virtualscroller.CellModel}*/ (this.cellsModel_.peekBack())).dataIndex;

    if (existingSentinelsCount !== this.bufferSize_) {
      bufferCellIndex = 0;
      while (this.canRender_(lastIndex + bufferCellIndex + 1) && bufferCellIndex < this.bufferSize_) {
        indicesBottom.push(lastIndex + bufferCellIndex + 1);
        bufferCellIndex++;
      }
    }

    const batches = await Promise.all([
      this.createBatchOfCells_(indicesTop, true, true),
      this.createBatchOfCells_(indicesBottom, true, false, this.contentHeight_)
    ]);

    let accumulatedHeight = 0
    const content = this.contentElem_
    batches.forEach(({cellElems, cellModels, clientHeight}, index) => {
      accumulatedHeight += clientHeight;
      cellModels.forEach((cellModel) => {
        if (index === 0) {
          this.cellsModel_.addFront(cellModel);
          return
        }
        this.cellsModel_.addBack(cellModel);
      });

      cellElems.forEach((cellDom) => {
        if (index === 0) {
          this.dom_.insertSiblingBefore(cellDom, this.dom_.getFirstElementChild(content));
          return
        }
        this.dom_.appendChild(content, cellDom);
      });
    });

    console.log('batches: ', batches);
    this.contentHeight_ += accumulatedHeight;
    this.contentElem_.style.height = `${this.contentHeight_}px`;
    const scrollTop = batches[0].clientHeight;
    console.log('scrollTop: ', scrollTop);
    this.getElement().scrollTop = scrollTop;
    this.cellsModel_.forEach(cellModel => {
        if (!batches[0].cellModels.includes(cellModel)) {
          cellModel.top += scrollTop;
          this.dom_.getElement(cellModel.elementId).style.top = `${cellModel.top}px`;
        }
    })
  }

  canRender_(index) {
    if (this.canRenderCelAtIndexFn_) {
      return this.canRenderCelAtIndexFn_(index);
    }
    return this.minIndex_ <= index && index <= this.maxIndex_;
  }

  /**
   * Creates and returns a new cell DOM element.
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
   * Creates a batch of cells, renders them, and updates their models with real heights and top positions.
   * Also updates each cell DOM element with corresponding style.
   * @param {!Array<number>} indices The data indices for the cells to create.
   * @param {boolean=} markSentinels Whether to mark models and elements as sentinels.
   * @param {boolean=} reverse Whether to render from last to first and stack cells upward.
   * @param {number=} initialTop From which start top position to stack cells.
   * @return {!Promise<{clientHeight: number, cellElems: !Array<Element>, cellModels: !Array<!virtualscroller.CellModel>}>}
   * @private
   */
  async createBatchOfCells_(indices, markSentinels = false, reverse = false, initialTop) {
    goog.asserts.assert(this.probe_ !== null, 'Probe must be a Node.');

    const fragment = this.dom_.getDocument().createDocumentFragment();
    const cellElems = [];
    const cellModels = [];

    const orderedIndices = reverse ? [...indices].reverse() : indices;

    for (let i = 0; i < orderedIndices.length; i++) {
      const dataIndex = orderedIndices[i];
      const cellDom = /** @type {Element} */ (this.getCellDom());
      const cellModel = new virtualscroller.CellModel(dataIndex, 0, 0);
      cellDom.id = cellModel.elementId;

      cellElems.push(cellDom);
      cellModels.push(cellModel);

      this.renderFn_(dataIndex, cellDom);
      this.dom_.append(fragment, cellDom);
    }

    this.dom_.removeChildren(this.probe_);
    this.dom_.append(/** @type {!Node} */ (this.probe_), fragment);

    const clientHeight = await new Promise((resolve) => {
      requestAnimationFrame(() => {
        const heights = cellElems.map(elem => elem.clientHeight);
        const totalHeight = heights.reduce((a, b) => a + b, 0);

        let top = initialTop ? initialTop : 0;

        for (let i = 0; i < cellElems.length; i++) {
          const height = heights[i];
          const model = /**@type {virtualscroller.CellModel}*/ (cellModels[i]);
          const elem = cellElems[i];

          model.height = height;
          model.sentinel = !!markSentinels;

          if (reverse) {
            top -= height;
            model.top = top;
          } else {
            model.top = top;
            top += height;
          }

          elem.id = model.elementId;
          elem.style.height = `${height}px`;
          elem.style.top = `${model.top}px`;
          elem.style.position = 'absolute';
          goog.dom.dataset.set(elem, 'index', model.dataIndex);
          if (markSentinels) {
            goog.dom.classlist.add(elem, goog.getCssName('virtual-scroller-sentinel'))
            goog.dom.dataset.set(elem, 'sentinel', 'true');
          }
        }

        resolve(totalHeight);
      });
    });

    return {clientHeight, cellElems, cellModels};
  }

  enterDocument() {
    'use strict';
    super.enterDocument();
    this.getHandler().listen(this.getElement(), goog.events.EventType.SCROLL, this.onContentScrolled_);
  }

  onContentScrolled_(e) {
    'use strict';
    this.contentPosition_ = this.getElement().scrollTop;
    console.log('this.contentPosition_: ', this.contentPosition_);
    console.log('this.contentHeight_: ', this.contentHeight_);
    console.log('this.prevPosition_: ', this.prevPosition_);

    this.direction_ = this.prevPosition_ > this.contentPosition_ ? virtualscroller.Direction.UP : virtualscroller.Direction.DOWN;

    const speed = this.calculateSpeed_(this.contentPosition_, this.prevPosition_);

    if (this.direction_ === virtualscroller.Direction.UP) {
      const sentinel = this.getClosestSentinel(false);
      if (sentinel && sentinel.top + sentinel.height >= this.contentPosition_) {
        this.placeCells_(this.direction_, speed);
      }
    }
    if (this.direction_ === virtualscroller.Direction.DOWN) {
      const sentinel = this.getClosestSentinel(true);
      if (sentinel && sentinel.top + sentinel.height <= this.contentPosition_ + this.frameElem_.height) {
        this.placeCells_(this.direction_, speed);
      }
    }
    this.prevPosition_ = this.contentPosition_;
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
      this.cellsModel_.forEach((item) => {
        if (condition(item)) {
          result = item;
          return true;
        }
      }, this, true);
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
      cellHeight = this.fillCellWithContentOptimized(prevUsedCellIndex, currentCellIndex, cellToRemove);
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
      cellHeight = this.fillCellWithContentOptimized(prevUsedCellIndex, currentCellIndex, cellToRemove);
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
          this.getDomHelper().getDocument().getElementById(cell.elementId).style.top = `${cell.top}px`;
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
