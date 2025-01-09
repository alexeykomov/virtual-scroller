// Sample render function
const renderCell = (index, fragment) => {
  const div = document.createElement('div');
  div.textContent = `Item ${index}`;
  div.style.padding = '10px';
  div.style.borderBottom = '1px solid #ddd';
  div.style.height = '50px';
  fragment.appendChild(div);
};

// Sample reuse function
const reuseCell = (prevIndex, currentIndex) => {
  console.log(`Reusing cell from index ${prevIndex} to ${currentIndex}`);
  return true;
};

// Virtual Scroller options
const options = {
  initialIndex: 0,
  minIndex: 0,
  maxIndex: 1000,
  renderFn: renderCell,
  reuseFn: reuseCell,
  shouldReuseFn: (prevIndex, currentIndex) => true,
  canRenderCellAtIndexFn: (index) => true,
  constantSize: true,
};

// Initialize the Virtual Scroller
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('scroller-container');
  const domHelper = new goog.dom.DomHelper(document);

  const scroller = new virtualscroller.VirtualScroller(domHelper, options);
  scroller.render(container);
});
