/* Pure, bounded IPS conversion from a verified original ROM to Grid 2026 v3.3. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.Grid2026Pipeline = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const MAX_ROM_SIZE = 2 * 1024 * 1024;
  const MAX_PATCH_SIZE = 2 * 1024 * 1024;

  function core() {
    const api = typeof module === 'object' && module.exports ? require('./core.js') : root.RomCustomizer;
    if (!api || typeof api.sha256 !== 'function' || typeof api.checksumGenesis !== 'function')
      throw new Error('RomCustomizer core.js is required');
    return api;
  }

  function bytes(value, name, limit) {
    if (!(value instanceof Uint8Array)) throw new TypeError(name + ' must be Uint8Array');
    if (value.length > limit) throw new RangeError(name + ' exceeds 2 MiB limit');
    return value;
  }

  function size(value, name, limit) {
    if (!Number.isSafeInteger(value) || value < 0 || value > limit)
      throw new RangeError(name + ' must be an integer within the 2 MiB limit');
    return value;
  }

  function hash(value, name) {
    if (typeof value !== 'string' || !/^[0-9a-f]{64}$/i.test(value))
      throw new Error(name + ' must be a SHA-256 hex digest');
    return value.toLowerCase();
  }

  function checksum(value, name) {
    if (!Number.isInteger(value) || value < 0 || value > 0xffff)
      throw new RangeError(name + ' must be a 16-bit checksum');
    return value;
  }

  function parseIps(patch) {
    bytes(patch, 'patch', MAX_PATCH_SIZE);
    if (patch.length < 8 || patch[0] !== 80 || patch[1] !== 65 || patch[2] !== 84 ||
        patch[3] !== 67 || patch[4] !== 72) throw new Error('Invalid IPS PATCH header');
    const records = [];
    let pos = 5, highestEnd = 0, finalSize = null;
    function available(n) {
      if (pos + n > patch.length) throw new Error('Truncated IPS patch');
    }
    function read24() {
      available(3);
      const value = patch[pos] * 65536 + patch[pos + 1] * 256 + patch[pos + 2];
      pos += 3;
      return value;
    }
    function read16() {
      available(2);
      const value = patch[pos] * 256 + patch[pos + 1];
      pos += 2;
      return value;
    }
    while (true) {
      available(3);
      if (patch[pos] === 69 && patch[pos + 1] === 79 && patch[pos + 2] === 70) {
        pos += 3;
        if (patch.length - pos === 3) finalSize = read24();
        else if (pos !== patch.length) throw new Error('Malformed IPS trailing bytes');
        if (finalSize !== null) {
          size(finalSize, 'IPS final size', MAX_ROM_SIZE);
          if (highestEnd > finalSize) throw new RangeError('IPS record exceeds final size');
        }
        return { records, finalSize };
      }
      const offset = read24();
      const literalLength = read16();
      let record;
      if (literalLength) {
        available(literalLength);
        record = { offset, data: patch.slice(pos, pos + literalLength) };
        pos += literalLength;
      } else {
        const length = read16();
        if (!length) throw new Error('IPS RLE length must be nonzero');
        available(1);
        record = { offset, length, value: patch[pos++] };
      }
      const end = offset + (record.data ? record.data.length : record.length);
      if (end > MAX_ROM_SIZE) throw new RangeError('IPS record exceeds 2 MiB ROM limit');
      highestEnd = Math.max(highestEnd, end);
      records.push(record);
    }
  }

  function applyParsed(original, parsed) {
    let length = original.length;
    for (const record of parsed.records)
      length = Math.max(length, record.offset + (record.data ? record.data.length : record.length));
    if (parsed.finalSize !== null) length = parsed.finalSize;
    size(length, 'IPS output size', MAX_ROM_SIZE);
    const rom = new Uint8Array(length);
    rom.set(original.subarray(0, length));
    for (const record of parsed.records) {
      if (record.data) rom.set(record.data, record.offset);
      else rom.fill(record.value, record.offset, record.offset + record.length);
    }
    return rom;
  }

  function applyIps(original, patch) {
    bytes(original, 'original', MAX_ROM_SIZE);
    return applyParsed(original, parseIps(patch));
  }

  function validateContract(contract) {
    if (!contract || contract.verified !== true) throw new Error('Verified target contract required');
    for (const label of ['original', 'baseline']) {
      const item = contract[label];
      if (!item || typeof item !== 'object') throw new Error(label + ' contract required');
      size(item.size, label + '.size', MAX_ROM_SIZE);
      hash(item.sha256, label + '.sha256');
      checksum(item.checksum, label + '.checksum');
      if (item.size < 0x200 || item.size & 1) throw new RangeError(label + ' ROM size must be even and at least 0x200');
    }
    if (!contract.patch || typeof contract.patch !== 'object') throw new Error('patch contract required');
    size(contract.patch.size, 'patch.size', MAX_PATCH_SIZE);
    hash(contract.patch.sha256, 'patch.sha256');
  }

  function inspectRom(input, expected, label) {
    bytes(input, label, MAX_ROM_SIZE);
    if (input.length !== expected.size) throw new Error(label + ' size mismatch');
    const api = core();
    const digest = api.sha256(input);
    if (digest !== expected.sha256.toLowerCase()) throw new Error(label + ' SHA-256 mismatch');
    const sum = api.checksumGenesis(input);
    const header = input[0x18e] * 256 + input[0x18f];
    if (sum !== expected.checksum || header !== expected.checksum)
      throw new Error(label + ' Genesis checksum mismatch');
    return { sha256: digest, checksum: sum };
  }

  function validateBaseline(input, contract) {
    validateContract(contract);
    const inspected = inspectRom(input, contract.baseline, 'baseline');
    return { rom: input.slice(), sha256: inspected.sha256, checksum: inspected.checksum };
  }

  function compose2026(original, patch, contract) {
    validateContract(contract);
    bytes(original, 'original', MAX_ROM_SIZE);
    bytes(patch, 'patch', MAX_PATCH_SIZE);
    const source = inspectRom(original, contract.original, 'original');
    if (patch.length !== contract.patch.size) throw new Error('patch size mismatch');
    const patchSha256 = core().sha256(patch);
    if (patchSha256 !== contract.patch.sha256.toLowerCase()) throw new Error('patch SHA-256 mismatch');
    const rom = applyParsed(original, parseIps(patch));
    const baseline = inspectRom(rom, contract.baseline, 'baseline');
    return { rom, sha256: baseline.sha256, checksum: baseline.checksum,
      sourceSha256: source.sha256, patchSha256 };
  }

  return { MAX_ROM_SIZE, MAX_PATCH_SIZE, parseIps, applyIps, validateBaseline, compose2026 };
});
