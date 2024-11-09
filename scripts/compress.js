const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const file = 'dist/VirtualScroller.min.js';
const algorithms = {
  gzip: {
    command: `gzip -f -k -9 ${file}`,
    extension: '.gz',
    name: 'Gzip',
  },
  brotli: {
    command: `brotli -k -q 11 ${file}`,
    extension: '.br',
    name: 'Brotli',
  },
  zopfli: {
    command: `zopfli --i1000 ${file}`,
    extension: '.gz',
    name: 'Zopfli',
  },
};

function getFileSize(filePath) {
  return fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function compress(algorithm) {
  const { command, extension, name } = algorithms[algorithm];
  const compressedFile = `${file}${extension}`;

  console.log(`\nCompressing with ${name}...`);
  try {
    execSync(command);
    const originalSize = getFileSize(file);
    const compressedSize = getFileSize(compressedFile);

    console.log(`Original size: ${formatBytes(originalSize)}`);
    console.log(`Compressed size: ${formatBytes(compressedSize)}`);
    console.log(`Compression ratio: ${((compressedSize / originalSize) * 100).toFixed(2)}%`);
  } catch (error) {
    console.error(`Failed to compress with ${name}:`, error.message);
  }
}

const algorithm = process.argv[2];
if (!algorithms[algorithm]) {
  console.error('Invalid algorithm. Use "gzip", "brotli", or "zopfli".');
  process.exit(1);
}

compress(algorithm);
