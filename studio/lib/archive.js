'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

function tarHeader(name, size, mtimeSeconds) {
  const header = Buffer.alloc(512);
  header.write(name.slice(0, 100), 0, 100, 'utf8');
  header.write('0000644\0', 100, 8, 'ascii');
  header.write('0000000\0', 108, 8, 'ascii');
  header.write('0000000\0', 116, 8, 'ascii');
  header.write(size.toString(8).padStart(11, '0') + '\0', 124, 12, 'ascii');
  header.write(mtimeSeconds.toString(8).padStart(11, '0') + '\0', 136, 12, 'ascii');
  header.write('        ', 148, 8, 'ascii');
  header.write('0', 156, 1, 'ascii');
  header.write('ustar', 257, 6, 'ascii');
  header.write('00', 263, 2, 'ascii');
  let checksum = 0;
  for (const byte of header) checksum += byte;
  header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');
  return header;
}

function listFiles(root, relative = '') {
  const entries = [];
  const dir = relative ? path.join(root, relative) : root;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const child = relative ? relative + '/' + entry.name : entry.name;
    if (entry.isDirectory()) entries.push(...listFiles(root, child));
    else entries.push(child);
  }
  return entries;
}

function createTarGz(rootDir) {
  const files = listFiles(rootDir);
  const chunks = [];
  for (const relative of files) {
    const full = path.join(rootDir, relative);
    const data = fs.readFileSync(full);
    const mtimeSeconds = Math.max(0, Math.floor(fs.statSync(full).mtimeMs / 1000));
    chunks.push(tarHeader(relative, data.length, mtimeSeconds));
    chunks.push(data);
    const padding = (512 - (data.length % 512)) % 512;
    if (padding > 0) chunks.push(Buffer.alloc(padding));
  }
  chunks.push(Buffer.alloc(1024));
  return zlib.gzipSync(Buffer.concat(chunks), { level: 9 });
}

module.exports = { createTarGz, tarHeader, listFiles };
