/* Local-only portrait conversion and guarded ROM patching. No ROM data is bundled. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.RomCustomizer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const WIDTH = 64, PIXELS = WIDTH * WIDTH, RAW_BYTES = 2048;
  const BACKGROUND = [73, 73, 136];
  const DEFAULT_USABLE_INDICES = Object.freeze([3, 4, 5, 6, 7, 11, 12, 13, 15]);

  function bytes(value, name) {
    if (!(value instanceof Uint8Array)) throw new TypeError(name + ' must be Uint8Array');
    return value;
  }
  function integer(value, name) {
    if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(name + ' must be a nonnegative safe integer');
    return value;
  }
  function range(data, offset, length, name) {
    integer(offset, name + ' offset'); integer(length, name + ' length');
    if (offset + length > data.length) throw new RangeError(name + ' exceeds input');
  }
  function read32(data, at) {
    range(data, at, 4, '32-bit word');
    return (data[at] * 0x1000000 + (data[at + 1] << 16) + (data[at + 2] << 8) + data[at + 3]) >>> 0;
  }
  function write32(data, at, value) {
    integer(value, 'pointer');
    if (value > 0xffffffff) throw new RangeError('pointer exceeds 32 bits');
    range(data, at, 4, 'pointer');
    data[at] = value >>> 24; data[at + 1] = value >>> 16 & 255;
    data[at + 2] = value >>> 8 & 255; data[at + 3] = value & 255;
  }
  function quant(v) { return Math.max(0, Math.min(7, Math.floor(v * 7 / 255 + 0.5))); }
  function rgbLevel(q) { return q * 255 / 7; }
  function cramWord(rgb) {
    return (quant(rgb[2]) * 2 << 8) | (quant(rgb[1]) * 2 << 4) | quant(rgb[0]) * 2;
  }
  function cramRgb(word) {
    return [rgbLevel((word & 14) / 2), rgbLevel((word >>> 4 & 14) / 2), rgbLevel((word >>> 8 & 14) / 2)];
  }
  function distance(a, b) {
    const r = a[0] - b[0], g = a[1] - b[1], bl = a[2] - b[2];
    return r * r + g * g + bl * bl;
  }

  // The 64x64 RGBA input is composited over the ROM's fixed blue backdrop.
  // Frequent lattice colors seed deterministic, weighted farthest-point selection.
  function validUsableIndices(value) {
    if (!Array.isArray(value) || !value.includes(3) || value.length < 2 || value.length > 13 ||
        value.some(n => !Number.isInteger(n) || n < 3 || n > 15) || new Set(value).size !== value.length)
      throw new Error('usableIndices must be distinct palette indices 3..15 and include 3');
    return value.slice();
  }
  function convertRgba64(rgba, options) {
    bytes(rgba, 'rgba');
    if (rgba.length !== PIXELS * 4) throw new RangeError('rgba must contain exactly 64x64x4 bytes');
    const usableIndices = validUsableIndices(options && options.usableIndices || DEFAULT_USABLE_INDICES);
    const colorCount = usableIndices.length;
    const pixels = new Array(PIXELS), histogram = new Uint32Array(512);
    for (let i = 0; i < PIXELS; i++) {
      const a = rgba[i * 4 + 3], p = [0, 0, 0];
      for (let c = 0; c < 3; c++) p[c] = (rgba[i * 4 + c] * a + BACKGROUND[c] * (255 - a)) / 255;
      pixels[i] = p;
      histogram[(quant(p[0]) << 6) | (quant(p[1]) << 3) | quant(p[2])]++;
    }
    const centers = [cramRgb(cramWord(BACKGROUND))];
    for (let n = 1; n < colorCount; n++) {
      let bestKey = 0, bestScore = -1;
      for (let key = 0; key < 512; key++) {
        const count = histogram[key];
        if (!count) continue;
        const color = [rgbLevel(key >>> 6), rgbLevel(key >>> 3 & 7), rgbLevel(key & 7)];
        let d = Infinity;
        for (const center of centers) d = Math.min(d, distance(color, center));
        const score = d * d * count; // same ranking as distance * sqrt(count)
        if (score > bestScore) { bestScore = score; bestKey = key; }
      }
      centers.push([rgbLevel(bestKey >>> 6), rgbLevel(bestKey >>> 3 & 7), rgbLevel(bestKey & 7)]);
    }
    const indexes = new Uint8Array(PIXELS);
    function assign() {
      for (let i = 0; i < PIXELS; i++) {
        let best = 0, d = Infinity;
        for (let j = 0; j < colorCount; j++) {
          const next = distance(pixels[i], centers[j]);
          if (next < d) { d = next; best = j; }
        }
        indexes[i] = best;
      }
    }
    for (let pass = 0; pass < 36; pass++) {
      assign();
      const sums = Array.from({ length: colorCount }, () => [0, 0, 0, 0]);
      for (let i = 0; i < PIXELS; i++) {
        const s = sums[indexes[i]], p = pixels[i];
        s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++;
      }
      let changed = false;
      for (let j = 1; j < colorCount; j++) {
        const s = sums[j];
        if (!s[3]) continue;
        const next = [rgbLevel(quant(s[0] / s[3])), rgbLevel(quant(s[1] / s[3])), rgbLevel(quant(s[2] / s[3]))];
        if (distance(next, centers[j]) !== 0) { centers[j] = next; changed = true; }
      }
      if (!changed) break;
    }
    assign();
    const paletteWords = Array(13).fill(0);
    const paletteBytes = new Uint8Array(26);
    for (let i = 0; i < colorCount; i++) {
      const slot = usableIndices[i] - 3;
      paletteWords[slot] = cramWord(centers[i]);
      paletteBytes[slot * 2] = paletteWords[slot] >>> 8;
      paletteBytes[slot * 2 + 1] = paletteWords[slot] & 255;
    }
    const indices = new Uint8Array(PIXELS), tileBytes = new Uint8Array(RAW_BYTES), previewRgba = new Uint8Array(PIXELS * 4);
    for (let i = 0; i < PIXELS; i++) {
      const paletteIndex = indexes[i];
      indices[i] = usableIndices[paletteIndex];
      const color = cramRgb(paletteWords[usableIndices[paletteIndex] - 3]);
      for (let c = 0; c < 3; c++) previewRgba[i * 4 + c] = Math.round(color[c]);
      previewRgba[i * 4 + 3] = 255;
    }
    let out = 0;
    for (let ty = 0; ty < 8; ty++) for (let tx = 0; tx < 8; tx++)
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x += 2) {
        const at = (ty * 8 + y) * WIDTH + tx * 8 + x;
        tileBytes[out++] = indices[at] << 4 | indices[at + 1];
      }
    return { paletteWords, paletteBytes, tileBytes, indices, previewRgba, usableIndices };
  }

  function encodeKosinskiLiterals(raw) {
    bytes(raw, 'raw');
    const out = [0, 0];
    let slot = 0, count = 0;
    function bit(b) {
      out[slot + (count >>> 3)] |= b << (count & 7);
      if (++count === 16) { slot = out.length; out.push(0, 0); count = 0; }
    }
    for (const value of raw) { bit(1); out.push(value); }
    bit(0); bit(1); out.push(0, 0xf8, 0);
    return Uint8Array.from(out);
  }

  function decodeKosinski(data, offset, options) {
    bytes(data, 'data'); integer(offset, 'offset');
    options = options || {};
    const maxOutput = options.maxOutput === undefined ? RAW_BYTES : integer(options.maxOutput, 'maxOutput');
    const maxInput = options.maxInput === undefined ? data.length - offset : integer(options.maxInput, 'maxInput');
    if (maxOutput > 65536 || maxInput > data.length - offset || offset > data.length) throw new RangeError('Kosinski bounds invalid');
    let pos = offset, desc = 0, left = 0;
    const end = offset + maxInput, out = [];
    function byte() { if (pos >= end) throw new Error('Truncated Kosinski stream'); return data[pos++]; }
    function refill() { desc = byte() | byte() << 8; left = 16; }
    function bit() {
      if (!left) refill();
      const result = desc & 1; desc >>>= 1; left--;
      if (!left) refill(); // original codec eagerly fetches before token payload
      return result;
    }
    while (true) {
      if (bit()) {
        if (out.length >= maxOutput) throw new Error('Kosinski output exceeds limit');
        out.push(byte()); continue;
      }
      let length, displacement;
      if (bit()) {
        const low = byte(), hi = byte();
        displacement = (((hi & 248) << 5) | low) - 8192;
        length = hi & 7;
        if (!length) {
          length = byte();
          if (!length) return { data: Uint8Array.from(out), nextOffset: pos };
          if (length === 1) continue;
          length++;
        } else length += 2;
      } else {
        length = 2 * bit() + bit() + 2;
        displacement = byte() - 256;
      }
      if (-displacement > out.length || displacement >= 0) throw new Error('Invalid Kosinski back-reference');
      if (out.length + length > maxOutput) throw new Error('Kosinski output exceeds limit');
      for (let i = 0; i < length; i++) out.push(out[out.length + displacement]);
    }
  }

  function checksumGenesis(data) {
    bytes(data, 'data');
    if (data.length < 0x200 || data.length & 1) throw new RangeError('ROM length must be even and at least 0x200');
    let sum = 0;
    for (let i = 0x200; i < data.length; i += 2) sum = (sum + (data[i] << 8 | data[i + 1])) & 0xffff;
    return sum;
  }

  // Pure JS SHA-256 keeps local file:// use working when SubtleCrypto is absent.
  function sha256(data) {
    bytes(data, 'data');
    if (data.length > 0x1fffffff) throw new RangeError('SHA-256 input too large');
    const k = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    const h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    const padded = new Uint8Array((data.length + 9 + 63) & ~63);
    padded.set(data); padded[data.length] = 0x80;
    const bitLength = data.length * 8, last = padded.length - 8;
    padded[last + 4] = bitLength / 0x1000000 & 255; padded[last + 5] = bitLength >>> 16 & 255;
    padded[last + 6] = bitLength >>> 8 & 255; padded[last + 7] = bitLength & 255;
    const w = new Uint32Array(64);
    const rr = (v, n) => v >>> n | v << (32 - n);
    for (let block = 0; block < padded.length; block += 64) {
      for (let i = 0; i < 16; i++) w[i] = read32(padded, block + i * 4);
      for (let i = 16; i < 64; i++) {
        const a = w[i - 15], b = w[i - 2];
        w[i] = (w[i - 16] + (rr(a, 7) ^ rr(a, 18) ^ a >>> 3) + w[i - 7] + (rr(b, 17) ^ rr(b, 19) ^ b >>> 10)) >>> 0;
      }
      let [a,b,c,d,e,f,g,hh] = h;
      for (let i = 0; i < 64; i++) {
        const t1 = (hh + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + (e & f ^ ~e & g) + k[i] + w[i]) >>> 0;
        const t2 = ((rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + (a & b ^ a & c ^ b & c)) >>> 0;
        hh = g; g = f; f = e; e = d + t1 >>> 0; d = c; c = b; b = a; a = t1 + t2 >>> 0;
      }
      const state = [a,b,c,d,e,f,g,hh];
      for (let i = 0; i < 8; i++) h[i] = h[i] + state[i] >>> 0;
    }
    return h.map(v => v.toString(16).padStart(8, '0')).join('');
  }

  function hexBytes(hex) {
    if (typeof hex !== 'string' || !/^(?:[0-9a-f]{2})+$/i.test(hex)) throw new Error('expectedRecordHex must be even-length hexadecimal');
    return Uint8Array.from(hex.match(/../g), x => parseInt(x, 16));
  }
  function checkSpan(span, label, rom, exactLength) {
    if (!span || typeof span !== 'object') throw new Error(label + ' span missing');
    integer(span.offset, label + '.offset'); integer(span.capacity, label + '.capacity');
    if (span.capacity < exactLength) throw new Error(label + ' capacity too small');
    range(rom, span.offset, span.capacity, label);
    if (span.mode !== 'reserved-ff' && span.mode !== 'replace') throw new Error(label + ' mode must be reserved-ff or replace');
    if (span.mode === 'reserved-ff' && rom.subarray(span.offset, span.offset + span.capacity).some(x => x !== 255))
      throw new Error(label + ' reserved range contains non-FF bytes');
  }
  function spansOverlap(a, b) { return a.start < b.end && b.start < a.end; }

  // Contract deliberately contains no default ROM hash, slot, or address.
  // spec = {verified:true, baseline:{size,sha256}, portraitPointerOffset,
  // expectedRecordHex (12 bytes), expectedPalettePointer, expectedGraphicsPointer,
  // palette:{offset,capacity,mode}, reservedBank:{start,end} when allocating,
  // graphics:{offset,capacity,mode}, allowedRanges:[{start,end},...] }.
  function buildPatch(spec, input, conversion, options) {
    bytes(input, 'input'); options = options || {};
    if (options.targetConfirmed !== true) throw new Error('targetConfirmed:true required');
    if (!spec || spec.verified !== true) throw new Error('verified ROM specification required');
    if (!spec.baseline || !Number.isSafeInteger(spec.baseline.size) || !/^[0-9a-f]{64}$/i.test(spec.baseline.sha256 || ''))
      throw new Error('exact baseline size and SHA-256 required');
    if (input.length !== spec.baseline.size || sha256(input) !== spec.baseline.sha256.toLowerCase())
      throw new Error('ROM baseline size or SHA-256 mismatch');
    if (!conversion || !(conversion.paletteBytes instanceof Uint8Array) || conversion.paletteBytes.length !== 26 ||
        !(conversion.tileBytes instanceof Uint8Array) || conversion.tileBytes.length !== RAW_BYTES)
      throw new Error('invalid portrait conversion');
    for (const word of conversion.paletteBytes) integer(word, 'palette byte');
    const usable = validUsableIndices(spec.usableIndices || DEFAULT_USABLE_INDICES);
    if (!Array.isArray(conversion.usableIndices) || conversion.usableIndices.length !== usable.length ||
        conversion.usableIndices.some((n, i) => n !== usable[i])) throw new Error('conversion palette indices do not match verified specification');
    const usableSet = new Set(usable);
    for (const byte of conversion.tileBytes)
      if (!usableSet.has(byte >>> 4) || !usableSet.has(byte & 15)) throw new Error('tile uses unsupported palette index');
    integer(spec.portraitPointerOffset, 'portraitPointerOffset');
    range(input, spec.portraitPointerOffset, 12, 'portrait record');
    const expected = hexBytes(spec.expectedRecordHex);
    if (expected.length !== 12 || expected.some((b, i) => b !== input[spec.portraitPointerOffset + i]))
      throw new Error('portrait record does not match verified specification');
    const oldPalette = read32(input, spec.portraitPointerOffset + 4);
    const oldGraphics = read32(input, spec.portraitPointerOffset + 8);
    if (spec.expectedPalettePointer !== oldPalette || spec.expectedGraphicsPointer !== oldGraphics)
      throw new Error('portrait pointers do not match verified specification');
    range(input, oldPalette, 26, 'baseline palette');
    const mergedPalette = conversion.paletteBytes.slice();
    for (let index = 3; index <= 15; index++) if (!usableSet.has(index)) {
      const pos = (index - 3) * 2;
      mergedPalette[pos] = input[oldPalette + pos];
      mergedPalette[pos + 1] = input[oldPalette + pos + 1];
    }
    const compressed = encodeKosinskiLiterals(conversion.tileBytes);
    if (spec.palette && spec.graphics) {
      checkSpan(spec.palette, 'palette', input, 26);
      checkSpan(spec.graphics, 'graphics', input, compressed.length);
    } else throw new Error('palette and graphics spans required');
    if ((spec.palette.mode === 'replace' && spec.palette.offset !== oldPalette) ||
        (spec.graphics.mode === 'replace' && spec.graphics.offset !== oldGraphics))
      throw new Error('replace span must match existing portrait pointer');
    if (spec.palette.mode === 'reserved-ff' || spec.graphics.mode === 'reserved-ff') {
      const bank = spec.reservedBank;
      if (!bank) throw new Error('explicit reservedBank required');
      integer(bank.start, 'reservedBank.start'); integer(bank.end, 'reservedBank.end');
      if (bank.end <= bank.start || bank.end > input.length) throw new Error('invalid reservedBank');
      for (const span of [spec.palette, spec.graphics]) if (span.mode === 'reserved-ff' &&
          (span.offset < bank.start || span.offset + span.capacity > bank.end))
        throw new Error('reserved allocation outside reservedBank');
      if (input.subarray(bank.start, bank.end).some(b => b !== 255))
        throw new Error('reservedBank contains non-FF bytes');
    }
    if (spansOverlap({ start: spec.palette.offset, end: spec.palette.offset + spec.palette.capacity },
                     { start: spec.graphics.offset, end: spec.graphics.offset + spec.graphics.capacity }))
      throw new Error('palette and graphics capacities overlap');
    const record = { start: spec.portraitPointerOffset + 4, end: spec.portraitPointerOffset + 12 };
    const palette = { start: spec.palette.offset, end: spec.palette.offset + 26 };
    const graphics = { start: spec.graphics.offset, end: spec.graphics.offset + compressed.length };
    const checksum = { start: 0x18e, end: 0x190 };
    const writes = [record, palette, graphics, checksum];
    for (let i = 0; i < writes.length; i++) for (let j = i + 1; j < writes.length; j++)
      if (spansOverlap(writes[i], writes[j])) throw new Error('patch ranges overlap');
    if (!Array.isArray(spec.allowedRanges) || !spec.allowedRanges.length) throw new Error('explicit allowedRanges required');
    const allowed = spec.allowedRanges.map((r, i) => {
      integer(r.start, 'allowedRanges[' + i + '].start'); integer(r.end, 'allowedRanges[' + i + '].end');
      if (r.end <= r.start || r.end > input.length) throw new Error('invalid allowed range');
      return r;
    });
    // Every byte in each proposed write must be declared. Exact diff is checked below.
    for (const w of writes) for (let i = w.start; i < w.end; i++)
      if (!allowed.some(r => r.start <= i && i < r.end)) throw new Error('write outside allowedRanges');
    const output = input.slice();
    write32(output, record.start, spec.palette.offset);
    write32(output, record.start + 4, spec.graphics.offset);
    output.set(mergedPalette, spec.palette.offset);
    output.set(compressed, spec.graphics.offset);
    const sum = checksumGenesis(output);
    output[0x18e] = sum >>> 8; output[0x18f] = sum & 255;
    const changedOffsets = [];
    for (let i = 0; i < output.length; i++) if (output[i] !== input[i]) {
      if (!writes.some(r => r.start <= i && i < r.end) || !allowed.some(r => r.start <= i && i < r.end))
        throw new Error('unexpected ROM diff at ' + i.toString(16));
      changedOffsets.push(i);
    }
    const decoded = decodeKosinski(output, spec.graphics.offset, { maxOutput: RAW_BYTES, maxInput: compressed.length });
    if (decoded.data.length !== RAW_BYTES || decoded.nextOffset !== spec.graphics.offset + compressed.length ||
        decoded.data.some((b, i) => b !== conversion.tileBytes[i])) throw new Error('encoded portrait verification failed');
    return { rom: output, checksum: sum, sha256: sha256(output), changedOffsets, compressedBytes: compressed.length, paletteBytes: mergedPalette };
  }

  return { convertRgba64, encodeKosinskiLiterals, decodeKosinski, checksumGenesis, sha256, buildPatch, cramWord, cramRgb };
});
