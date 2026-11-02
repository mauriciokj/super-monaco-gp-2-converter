/* Two immutable release contracts. Composition and personalization stay local. */
(function(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.Grid2026Versions = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(root) {
  'use strict';
  const node = typeof module === 'object' && module.exports;
  const core = node ? require('./core.js') : root.RomCustomizer;
  const baseSpec = node ? require('./spec.js') : root.PORTRAIT_SPEC;
  const season = node ? require('./season-recipe.js') : root.Season2026;
  const delta = node ? require('./ptbr-delta.js') : root.Grid2026PtbrDelta;
  const DELTA_SHA = 'c5d0242e330db7e87e9afb376c01e8d710c5e63a63d102d6cb1fb278eb19e6cd';
  const PTBR_SHA = '83ff290cfca22a52f97c18134d86af012848c7e591627c6d96dba4e893aff3a9';
  function assert(value, message) { if (!value) throw new Error(message); }
  function freeze(value) {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
  }
  const ptSpec = JSON.parse(JSON.stringify(baseSpec));
  ptSpec.baseline = {label: 'Grid 2026 PT-BR · Audio 2 + Kimi', size: 2097152, sha256: PTBR_SHA, checksum: 0xf687};
  // Portrait validation uses the selected baseline; no legacy IPS is needed.
  delete ptSpec.composition;
  const catalog = freeze({
    v33: {id: 'v33', label: 'Grid 2026 v3.3', suffix: 'v3.3', spec: baseSpec,
      description: 'A edição anterior do mod, com o grid e os retratos de 2026. Textos e vozes originais do jogo.'},
    ptbr: {id: 'ptbr', label: 'Grid 2026 PT-BR · Audio 2 + Kimi', suffix: 'ptbr-audio2-kimi', spec: ptSpec,
      description: 'Menus e diálogos traduzidos, textos sem acentos, sete chamadas de voz em português e Kimi na Mercedes do topo. Sua foto entra no piloto do jogador.'}
  });
  function get(id) { assert(Object.hasOwn(catalog, id), 'Versão desconhecida.'); return catalog[id]; }
  function verify(rom, expected) {
    assert(rom instanceof Uint8Array && rom.length === expected.size, 'Tamanho de ROM incompatível.');
    const sha256 = core.sha256(rom), checksum = core.checksumGenesis(rom);
    assert(sha256 === expected.sha256, 'SHA-256 da versão não corresponde à base verificada.');
    assert(checksum === expected.checksum && (rom[398] * 256 + rom[399]) === checksum, 'Checksum da versão inválido.');
    return {sha256, checksum};
  }
  function applyDelta(source, recipe = delta) {
    verify(source, baseSpec.baseline);
    assert(recipe && core.sha256(new TextEncoder().encode(JSON.stringify(recipe))) === DELTA_SHA, 'Integridade da receita PT-BR inválida.');
    assert(recipe.version === 1 && recipe.size === source.length && recipe.sourceSha256 === baseSpec.baseline.sha256 && recipe.targetSha256 === PTBR_SHA, 'Contrato PT-BR inválido.');
    const rom = source.slice();
    let previousEnd = 0;
    for (const op of recipe.ops) {
      assert(Array.isArray(op), 'Operação inválida.');
      const [kind, offset, value, sourceOrFill] = op;
      let length;
      if (kind === 'w') {
        assert(op.length === 3 && typeof value === 'string' && /^(?:[0-9a-f]{2}){1,256}$/.test(value), 'Literal inválido.');
        length = value.length / 2;
      } else {
        assert((kind === 'c' || kind === 'f') && op.length === 4 && Number.isSafeInteger(value) && value > 0, 'Referência inválida.');
        length = value;
      }
      assert(Number.isSafeInteger(offset) && offset >= previousEnd && offset + length <= rom.length, 'Receita fora dos limites ou sobreposta.');
      assert(offset + length <= 0x115000 || offset >= 0x116000, 'Receita invadiu a reserva do jogador.');
      previousEnd = offset + length;
      if (kind === 'w') rom.set(Uint8Array.from(value.match(/../g), n => parseInt(n, 16)), offset);
      else if (kind === 'c') {
        assert(Number.isSafeInteger(sourceOrFill) && sourceOrFill >= 0 && sourceOrFill + length <= source.length, 'Cópia fora dos limites.');
        rom.set(source.subarray(sourceOrFill, sourceOrFill + length), offset);
      } else {
        assert(Number.isInteger(sourceOrFill) && sourceOrFill >= 0 && sourceOrFill <= 255, 'Preenchimento inválido.');
        rom.fill(sourceOrFill, offset, offset + length);
      }
    }
    return {rom, ...verify(rom, ptSpec.baseline), recipeSha256: DELTA_SHA};
  }
  function compose(source, id) {
    const release = get(id);
    assert(source instanceof Uint8Array && (source.length === 1048576 || source.length === 2097152), 'Tamanho incorreto. Use a ROM original americana de 1 MiB ou uma edição verificada de 2 MiB.');
    const sourceSha256 = core.sha256(source);
    let result, sourceKind, compositionReady;
    if (source.length === 1048576) {
      assert(sourceSha256 === baseSpec.composition.original.sha256, 'ROM original não reconhecida. Use a revisão americana verificada.');
      result = season.compose(source); sourceKind = 'original'; compositionReady = true;
    } else if (sourceSha256 === release.spec.baseline.sha256) {
      result = {rom: source.slice(), ...verify(source, release.spec.baseline), recipeSha256: null};
      sourceKind = 'baseline'; compositionReady = false;
    } else if (id === 'ptbr' && sourceSha256 === baseSpec.baseline.sha256) {
      result = {rom: source.slice(), ...verify(source, baseSpec.baseline)};
      sourceKind = 'v33'; compositionReady = true;
    } else throw new Error('ROM não reconhecida para esta versão. Use a original americana ou a edição verificada selecionada.');
    if (id === 'ptbr' && result.sha256 === baseSpec.baseline.sha256) result = applyDelta(result.rom);
    verify(result.rom, release.spec.baseline);
    return {...result, sourceSha256, sourceKind, compositionReady, releaseId: id};
  }
  return {catalog, get, compose, applyDelta, deltaSha256: DELTA_SHA, defaultId: 'ptbr'};
});
