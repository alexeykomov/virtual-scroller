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
    this.minIndex_ = 0;
    this.maxIndex_ = 0;
    this.renderFn_ = () => {};
    this.reuseFn_ = () => {};
    /**
     * @type {!virtualscroller.structs.Deque<virtualscroller.CellModel>}
     */
    this.model = new virtualscroller.structs.Deque();
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

    contentElem.style.position = 'absolute';
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
    const content = this.dom_.getElementByClass('virtual-scroller-content', frame); // Content element inside frame

    // Measure the height of the frame and content
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
      const cellDom = this.getCellDom();

      // Measure the height of the cell
      if (!cellDom) {
        // Stop if getCellDom returns null or undefined
        break;
      }

      this.dom_.appendChild(content, cellDom);
      const cellHeight = this.fillCellWithContent(index, this.renderFn_, cellDom);

      // If cell height is zero or invalid, skip it
      if (cellHeight <= 0) {
        continue;
      }

      accumulatedHeight += cellHeight;
      renderedCells.push(cellDom);
      index++;
    }
    this.contentHeight = Math.max(frameHeight, accumulatedHeight);
    this.contentElem_.style.height = this.contentHeight;

    this.dom_.append(this.contentElem_, ...renderedCells);
  }

  /**
   * Creates and returns a new cell DOM element.
   * The implementation of this method should be provided later.
   * @return {Element} A DOM element representing a cell.
   */
  getCellDom() {
    // TODO: Implement this method
    return null;
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
    if (this.frameElem_.scrollTop < offset) {
      this.placeCells_(virtualscroller.Direction.UP, speed);
    }
  }

  /**
   * @param {number} contentPosition
   * @param {number} prevPosition
   */
  calculateSpeed_(contentPosition, prevPosition) {
    return 1;
  }

  /**
   * @param {number} prevUsedCellIndex
   * @param {number} currentCellIndex
   * @return {boolean} Whether cell from prevUsedCellIndex should br reused for cell at currentCellIndex
   */
  shouldReuse(prevUsedCellIndex, currentCellIndex) {
    return false;
  }

  /**
   * Positions the cells based on the current scroll direction and updates the content.
   * @param {virtualscroller.Direction} direction The current scroll direction (UP or DOWN).
   * @param {number} speed The spee with which user scrolls
   */
  placeCells_(direction, speed) {
    'use strict';

    const frame = this.getElement(); // Frame element (main scroller)

    const frameHeight = frame.clientHeight;
    const offset = 100; // Buffer offset for pre-rendering
    const start = this.contentPosition_ - offset;
    const end = this.contentPosition_ + frameHeight + offset;

    let cellToRemove;
    let prevUsedCellIndex;
    let currentCellIndex;
    if (direction === virtualscroller.Direction.UP) {
      cellToRemove = this.dom_.getLastElementChild(this.contentElem_);
      this.dom_.insertChildAt(this.contentElem_, cellToRemove, 0);
      prevUsedCellIndex = this.model.peekBack().dataIndex;
      currentCellIndex = this.model.peekFront().dataIndex + 1;
      const modelOfCellToRemove = this.model.removeBack();
      modelOfCellToRemove.dataIndex = currentCellIndex;
      this.model.addFront(modelOfCellToRemove);
    } else {
      cellToRemove = this.dom_.getFirstElementChild(this.contentElem_);
      this.dom_.appendChild(this.contentElem_, cellToRemove);
      prevUsedCellIndex = this.model.peekFront().dataIndex;
      currentCellIndex = this.model.peekBack().dataIndex - 1;
      const modelOfCellToRemove = this.model.removeFront();
      modelOfCellToRemove.dataIndex = currentCellIndex;
      this.model.addBack(modelOfCellToRemove);
    }

    let cellHeight = 0;
    if (this.shouldReuse(prevUsedCellIndex, currentCellIndex)) {
      cellHeight = this.fillCellWithContent(currentCellIndex, null, this.reuseFn_, cellToRemove);
    } else {
      cellHeight = this.fillCellWithContent(currentCellIndex, this.renderFn_, null, cellToRemove);
    }
    cellToRemove.style.height = cellHeight;

    if (cellHeight + frameHeight > this.contentHeight) {
      const contentHeight = this.contentHeight + cellHeight;
      this.contentElem_.style.height = contentHeight;
      this.contentHeight = contentHeight;
      this.frameElem_.scrollTop +=
        (direction === virtualscroller.Direction.UP ? 1 : -1) * cellHeight;
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
