// Sample render function with variable height
const renderCell = (index, cellFrame) => {
  const div = document.createElement('div');
  const text = 'Item ' + index + ': ' + generateRandomText();
  div.textContent = text;
  div.style.padding = '10px';
  div.style.borderBottom = '1px solid #ddd';
  div.style.lineHeight = '1.4';
  div.style.boxSizing = 'border-box';
  cellFrame.appendChild(div);
};

// Helper to generate variable-length placeholder text
function generateRandomText() {
  const words = [
    'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
    'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
    'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam'
  ];
  const wordCount = 5 + Math.floor(Math.random() * 50);
  return Array.from({ length: wordCount }, () => words[Math.floor(Math.random() * words.length)]).join(' ');
}

// Sample reuse function
const reuseCell = (element) => {
  return element
}

// Virtual Scroller options
const options = {
  initialIndex: 100,
  height: 0,
  width: 0,
  minIndex: 0,
  maxIndex: 1000,
  renderFn: renderCell,
  reuseFn: reuseCell,
  shouldReuseFn: (prevIndex, currentIndex) => true,
  canRenderCellAtIndexFn: (index) => true,
  estimatedCellHeight: 30,
  batchSize: 2,
  bufferSize: 1
};

// Initialize the Virtual Scroller
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('scroller-container');
  const domHelper = new goog.dom.DomHelper(document);
  options.height = container.getBoundingClientRect().height - 2;
  options.width = container.getBoundingClientRect().width - 2;

  const scroller = new virtualscroller.VirtualScroller(domHelper, options);
  scroller.render(container);
});
