// Import Closure Library classes
goog.provide('virtualscroller.VirtualScroller');
goog.require('goog.dom');
goog.require('goog.dom.classlist');
goog.require('goog.ui.Component');
goog.require('goog.events.EventHandler');
goog.require('goog.events.EventType');

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
    this.renderFn_ = () => {}
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

    this.dom_.append(this.frameElem_, ...renderedCells);
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
   * @param {(index: number, fragment: DocumentFragment) => void} renderFn A function that renders content into the given DocumentFragment.
   * @param {Element} cellElem The DOM element representing the cell to be filled with content.
   * @return {number} client height of cell
   */
  fillCellWithContent(index, renderFn, cellElem) {
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
  }

  /**
   * Cleans up resources used by the Virtual Scroller.
   */
  dispose() {
    super.dispose();
    console.log('Virtual Scroller disposed');
  }
};
