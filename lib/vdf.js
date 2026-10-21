'use strict';
// Minimal parser for Valve's text KeyValues format (libraryfolders.vdf, appmanifest_*.acf, ...).

function parseVdf(text) {
  const src = String(text).replace(/^﻿/, '');
  let i = 0;

  function skipSpace() {
    for (;;) {
      while (i < src.length && /\s/.test(src[i])) i++;
      if (src[i] === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; } else break;
    }
  }

  function readString() {
    if (src[i] === '"') {
      i++;
      let out = '';
      while (i < src.length && src[i] !== '"') {
        if (src[i] === '\\' && i + 1 < src.length) {
          const n = src[i + 1];
          out += n === 'n' ? '\n' : n === 't' ? '\t' : n;
          i += 2;
        } else out += src[i++];
      }
      i++;
      return out;
    }
    let out = '';
    while (i < src.length && !/[\s{}"]/.test(src[i])) out += src[i++];
    return out;
  }

  function readObject() {
    const obj = {};
    for (;;) {
      skipSpace();
      if (i >= src.length) return obj;
      if (src[i] === '}') { i++; return obj; }
      const key = readString();
      skipSpace();
      if (src[i] === '{') { i++; obj[key] = readObject(); } else obj[key] = readString();
    }
  }

  return readObject();
}

module.exports = { parseVdf };
