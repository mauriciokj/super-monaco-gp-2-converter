(function () {
  'use strict';

  const core = window.RomCustomizer;
  const spec = window.PORTRAIT_SPEC;
  const pipeline = window.Grid2026Pipeline;
  const season = window.Season2026;
  const $ = id => document.getElementById(id);
  const el = {
    romFile: $('romFile'), romDropzone: $('romDropzone'), romStatus: $('romStatus'), romBadge: $('romBadge'),
    photoFile: $('photoFile'), photoStatus: $('photoStatus'), photoBadge: $('photoBadge'), demoButton: $('demoButton'),
    cropCanvas: $('cropCanvas'), cropPlaceholder: $('cropPlaceholder'), zoom: $('zoom'), zoomValue: $('zoomValue'),
    positionX: $('positionX'), xValue: $('xValue'), positionY: $('positionY'), yValue: $('yValue'), resetButton: $('resetButton'),
    previewCanvas: $('previewCanvas'), previewPlaceholder: $('previewPlaceholder'), previewStatus: $('previewStatus'),
    paletteSwatches: $('paletteSwatches'), colorCount: $('colorCount'), baselineCanvas: $('baselineCanvas'),
    baselinePlaceholder: $('baselinePlaceholder'), targetSlot: $('targetSlot'), targetLabel: $('targetLabel'),
    targetStatus: $('targetStatus'), confirmTarget: $('confirmTarget'), candidateDetails: $('candidateDetails'),
    candidateGrid: $('candidateGrid'), buildButton: $('buildButton'), buildStatus: $('buildStatus'),
    downloadArea: $('downloadArea'), downloadRom: $('downloadRom'), downloadReport: $('downloadReport')
  };
  const state = {
    rom: null, romName: '', romHash: '', romFailure: '', sourceRom: null, sourceKind: null, sourceSha256: '',
    compositionReady: false, recipeSha256: null, image: null, imageName: '', conversion: null,
    baselineVisible: false, building: false, romToken: 0, imageToken: 0, conversionToken: 0, buildToken: 0,
    outputUrls: [], conversionTimer: null, lastCompletedRevision: null
  };
  const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
  const MAX_PIXELS = 32 * 1000 * 1000;
  const ORIGINAL_SHA = 'c02206602e00dd8e9b6c38943b8a3be41e37d2d21c1768cf342900bce11ab4f0';
  const BASELINE_SHA = 'b840fcaa0851daf548c9c4c4dadf18d3cb78ebf9683fde897bb677b44a3ea872';
  const DEFAULT_SHARED = [0x448, 0x000, 0xeee];

  function setStatus(node, message, kind) {
    node.textContent = message;
    node.className = 'field-status' + (kind ? ' ' + kind : '');
  }
  function setBadge(node, message, kind) {
    node.textContent = message;
    node.className = 'status-badge' + (kind ? ' ' + kind : '');
  }
  function revokeUrls() {
    for (const url of state.outputUrls) URL.revokeObjectURL(url);
    state.outputUrls.length = 0;
  }
  function clearOutput() {
    state.buildToken++;
    state.building = false;
    revokeUrls();
    el.downloadArea.hidden = true;
    el.downloadRom.removeAttribute('href');
    el.downloadReport.removeAttribute('href');
  }
  function invalidateConversion() {
    state.conversionToken++;
    if (state.conversionTimer) clearTimeout(state.conversionTimer);
    state.conversionTimer = null;
    state.conversion = null;
    clearOutput();
  }
  function canBuild() {
    return Boolean(core && spec && spec.verified === true && spec.targetConfirmed === true &&
      state.rom && state.image && state.conversion && state.baselineVisible && el.confirmTarget.checked && !state.building);
  }
  function renderCustomizerState() {
    const hasImage = Boolean(state.image);
    for (const control of [el.zoom, el.positionX, el.positionY, el.resetButton]) control.disabled = !hasImage;
    el.confirmTarget.disabled = !state.baselineVisible;
    el.buildButton.disabled = !canBuild();
    el.zoomValue.textContent = Number(el.zoom.value).toFixed(2).replace('.', ',') + '×';
    el.xValue.textContent = el.positionX.value + '%';
    el.yValue.textContent = el.positionY.value + '%';
    if (!spec || !spec.targetConfirmed) {
      setStatus(el.buildStatus, 'Confirme primeiro qual retrato deve ser substituído', 'error');
    } else if (!state.rom) {
      setStatus(el.buildStatus, state.romFailure || 'Carregue a ROM original verificada para preparar a edição 2026.', state.romFailure ? 'error' : '');
    } else if (!state.image || !state.conversion) {
      setStatus(el.buildStatus, 'Adicione uma foto e confira a prévia.');
    } else if (!state.baselineVisible) {
      setStatus(el.buildStatus, 'Não foi possível conferir a miniatura do retrato original.', 'error');
    } else if (!el.confirmTarget.checked) {
      setStatus(el.buildStatus, 'Confirme visualmente o retrato original acima.');
    } else if (state.building) {
      setStatus(el.buildStatus, 'Validando alterações e criando a ROM…');
    } else if (el.downloadArea.hidden) {
      setStatus(el.buildStatus, 'Tudo pronto para validar a cópia personalizada.', 'success');
    }
    return {
      romReady: Boolean(state.rom), imageReady: hasImage, previewReady: Boolean(state.conversion),
      sourceKind: state.sourceKind, sourceSha256: state.sourceSha256,
      compositionMethod: state.compositionReady ? 'automatic-reduced-recipe' : null,
      baselineSha256: state.romHash, compositionReady: state.compositionReady,
      baselineVisible: state.baselineVisible, targetConfirmedInSpec: Boolean(spec && spec.targetConfirmed),
      targetConfirmedByUser: el.confirmTarget.checked, canBuild: canBuild(), building: state.building,
      downloadReady: !el.downloadArea.hidden
    };
  }
  window.renderCustomizerState = renderCustomizerState;

  function clearCanvas(canvas) { canvas.getContext('2d').clearRect(0, 0, 64, 64); }
  function drawRgba(canvas, rgba) {
    const ctx = canvas.getContext('2d');
    ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), 64, 64), 0, 0);
  }
  function read32(rom, offset) {
    if (!Number.isSafeInteger(offset) || offset < 0 || offset + 4 > rom.length) throw new Error('Ponteiro fora da ROM.');
    return (rom[offset] * 0x1000000 + (rom[offset + 1] << 16) + (rom[offset + 2] << 8) + rom[offset + 3]) >>> 0;
  }
  function portraitRgba(rom, paletteOffset, graphicsOffset, playerColors) {
    if (!Number.isSafeInteger(paletteOffset) || paletteOffset < 0 || paletteOffset + 26 > rom.length)
      throw new Error('Paleta original fora da ROM.');
    if (!Number.isSafeInteger(graphicsOffset) || graphicsOffset < 0 || graphicsOffset >= rom.length)
      throw new Error('Gráficos originais fora da ROM.');
    const decoded = core.decodeKosinski(rom, graphicsOffset, { maxOutput: 2048, maxInput: Math.min(8192, rom.length - graphicsOffset) });
    if (!decoded || decoded.data.length !== 2048) throw new Error('Retrato original incompleto.');
    const palette = new Array(16);
    const shared = Array.isArray(spec.sharedPaletteWords) && spec.sharedPaletteWords.length >= 3 ? spec.sharedPaletteWords : DEFAULT_SHARED;
    for (let i = 0; i < 3; i++) palette[i] = core.cramRgb(shared[i]);
    for (let i = 3; i < 16; i++) palette[i] = core.cramRgb(rom[paletteOffset + (i - 3) * 2] << 8 | rom[paletteOffset + (i - 3) * 2 + 1]);
    if (playerColors) {
      const overrideOffset = Number.isSafeInteger(spec.playerPaletteOverrideOffset) ? spec.playerPaletteOverrideOffset : 0x4e08;
      if (overrideOffset < 0 || overrideOffset + 8 > rom.length) throw new Error('Cores iniciais do jogador fora da ROM.');
      [8, 9, 10, 14].forEach((index, i) => {
        palette[index] = core.cramRgb(rom[overrideOffset + i * 2] << 8 | rom[overrideOffset + i * 2 + 1]);
      });
    }
    const rgba = new Uint8Array(64 * 64 * 4);
    let at = 0;
    for (let ty = 0; ty < 8; ty++) for (let tx = 0; tx < 8; tx++)
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x += 2) {
        const packed = decoded.data[at++];
        for (let half = 0; half < 2; half++) {
          const color = palette[half ? packed & 15 : packed >>> 4];
          const dest = ((ty * 8 + y) * 64 + tx * 8 + x + half) * 4;
          rgba[dest] = Math.round(color[0]); rgba[dest + 1] = Math.round(color[1]);
          rgba[dest + 2] = Math.round(color[2]); rgba[dest + 3] = 255;
        }
      }
    return rgba;
  }
  function displayBaseline(rom) {
    state.baselineVisible = false;
    el.confirmTarget.checked = false;
    clearCanvas(el.baselineCanvas);
    el.baselinePlaceholder.hidden = false;
    el.candidateDetails.hidden = true;
    el.candidateGrid.replaceChildren();
    if (!spec || !spec.target || !Number.isInteger(spec.target.slot)) {
      setStatus(el.targetStatus, 'Confirme primeiro qual retrato deve ser substituído', 'error');
      return;
    }
    const record = spec.portraitPointerOffset;
    const paletteOffset = spec.expectedPalettePointer;
    const graphicsOffset = spec.expectedGraphicsPointer;
    if (read32(rom, record + 4) !== paletteOffset || read32(rom, record + 8) !== graphicsOffset)
      throw new Error('Ponteiros do retrato não correspondem à versão verificada.');
    drawRgba(el.baselineCanvas, portraitRgba(rom, paletteOffset, graphicsOffset, spec.target.slot === 11));
    el.baselinePlaceholder.hidden = true;
    state.baselineVisible = true;
    setStatus(el.targetStatus, spec.target.confirmation || 'Compare a miniatura antes de confirmar.', 'success');
    // Additional verified candidates are decoded from this selected ROM only.
    if (Array.isArray(spec.candidates) && spec.candidates.length > 1) {
      for (const candidate of spec.candidates) {
        try {
          const card = document.createElement('div'); card.className = 'candidate-card' + (candidate.slot === spec.target.slot ? ' selected' : '');
          const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
          const label = document.createElement('span'); label.textContent = candidate.label || 'Slot ' + candidate.slot;
          const po = candidate.paletteOffset ?? read32(rom, candidate.recordOffset + 4);
          const go = candidate.graphicsOffset ?? read32(rom, candidate.recordOffset + 8);
          drawRgba(canvas, portraitRgba(rom, po, go, candidate.slot === 11)); card.append(canvas, label); el.candidateGrid.append(card);
        } catch (_) { /* A malformed optional candidate never authorizes a patch. */ }
      }
      el.candidateDetails.hidden = !el.candidateGrid.children.length;
    }
  }

  async function loadRom(file) {
    const token = ++state.romToken;
    state.rom = null; state.romName = ''; state.romHash = ''; state.romFailure = '';
    state.sourceRom = null; state.sourceKind = null; state.sourceSha256 = '';
    state.compositionReady = false; state.recipeSha256 = null;
    state.baselineVisible = false; el.confirmTarget.checked = false;
    clearOutput(); clearCanvas(el.baselineCanvas); el.baselinePlaceholder.hidden = false;
    el.candidateDetails.hidden = true; el.candidateGrid.replaceChildren();
    setStatus(el.targetStatus, 'Verificando a ROM antes de mostrar o retrato…');
    setBadge(el.romBadge, 'Verificando…');
    setStatus(el.romStatus, 'Lendo e verificando SHA-256 localmente…');
    renderCustomizerState();
    if (!file) {
      setBadge(el.romBadge, 'Aguardando arquivo');
      setStatus(el.romStatus, 'Nenhuma ROM selecionada.');
      setStatus(el.targetStatus, 'Carregue a ROM para conferir o retrato.');
      return;
    }
    try {
      if (!/\.(md|bin|gen)$/i.test(file.name || '')) throw new Error('Formato recusado. Selecione .md, .bin ou .gen; arquivos .smd e .zip não são aceitos.');
      if (!spec || !spec.baseline || !core) throw new Error('Os dados de validação ainda não estão disponíveis.');
      if (file.size !== 1048576 && file.size !== 2097152)
        throw new Error('Tamanho incorreto. Use a ROM original americana de 1 MiB ou a Grid2026 v3.3 de 2 MiB.');
      const data = new Uint8Array(await file.arrayBuffer());
      if (token !== state.romToken) return;
      await new Promise(resolve => setTimeout(resolve, 0));
      if (token !== state.romToken) return;
      const hash = String(await Promise.resolve(core.sha256(data))).toLowerCase();
      if (token !== state.romToken) return;
      let baseline, baselineHash, recipeHash = null, sourceKind, compositionReady = false;
      if (data.length === 1048576) {
        if (hash !== ORIGINAL_SHA)
          throw new Error('ROM original não reconhecida. Esta ferramenta aceita apenas a revisão americana verificada de 1 MiB; outras revisões não são compatíveis.');
        if (!season || typeof season.compose !== 'function')
          throw new Error('A receita da temporada está indisponível. Reabra a versão completa do personalizador.');
        setStatus(el.romStatus, 'Original reconhecida. Preparando localmente a edição Grid2026 v3.3…');
        await new Promise(resolve => setTimeout(resolve, 0));
        if (token !== state.romToken) return;
        const composed = await Promise.resolve(season.compose(data));
        if (token !== state.romToken) return;
        baseline = composed.rom; baselineHash = composed.sha256; recipeHash = composed.recipeSha256;
        sourceKind = 'original'; compositionReady = true;
      } else {
        if (hash !== BASELINE_SHA || hash !== String(spec.baseline.sha256).toLowerCase())
          throw new Error('Grid2026 v3.3 não reconhecida. Use a cópia verificada de 2 MiB ou a ROM original americana de 1 MiB.');
        if (pipeline && spec.composition && spec.composition.verified === true) {
          const checked = await Promise.resolve(pipeline.validateBaseline(data, spec.composition));
          baseline = checked.rom; baselineHash = checked.sha256;
        } else {
          const checksum = core.checksumGenesis(data);
          if (checksum !== spec.baseline.checksum || (data[0x18e] << 8 | data[0x18f]) !== checksum)
            throw new Error('Checksum da Grid2026 v3.3 não corresponde à versão verificada.');
          baseline = data; baselineHash = hash;
        }
        sourceKind = 'baseline';
      }
      if (baseline.length !== 2097152 || baselineHash !== BASELINE_SHA)
        throw new Error('A edição 2026 resultante não corresponde à base verificada.');
      displayBaseline(baseline);
      if (token !== state.romToken) return;
      state.rom = baseline; state.romHash = baselineHash; state.romName = file.name;
      state.sourceRom = data; state.sourceKind = sourceKind; state.sourceSha256 = hash;
      state.compositionReady = compositionReady; state.recipeSha256 = recipeHash;
      state.romFailure = '';
      setBadge(el.romBadge, sourceKind === 'original' ? 'Edição 2026 pronta' : 'ROM validada', 'ok');
      setStatus(el.romStatus, sourceKind === 'original'
        ? 'Original reconhecida · edição 2026 preparada. SHA-256 da base confirmado.'
        : 'Grid2026 v3.3 reconhecida · SHA-256 confirmado.', 'success');
    } catch (error) {
      if (token !== state.romToken) return;
      state.rom = null; state.baselineVisible = false;
      el.confirmTarget.checked = false; el.baselinePlaceholder.hidden = false;
      state.romFailure = error.message || 'Não foi possível ler a ROM.';
      setBadge(el.romBadge, 'ROM recusada', 'bad');
      setStatus(el.romStatus, state.romFailure, 'error');
      setStatus(el.targetStatus, 'Carregue a ROM verificada para ver o retrato.', 'error');
    }
    renderCustomizerState();
  }

  function imageMime(bytes) {
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
    if (String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
    return null;
  }
  async function loadPhoto(file) {
    const token = ++state.imageToken;
    state.image = null; state.imageName = '';
    invalidateConversion(); clearCanvas(el.cropCanvas); clearCanvas(el.previewCanvas);
    el.paletteSwatches.replaceChildren(); el.colorCount.textContent = '— CORES';
    el.cropPlaceholder.hidden = false; el.previewPlaceholder.hidden = false;
    setBadge(el.photoBadge, 'Lendo imagem…'); setStatus(el.photoStatus, 'Abrindo a foto localmente…');
    setStatus(el.previewStatus, 'Preparando prévia…'); renderCustomizerState();
    if (!file) {
      setBadge(el.photoBadge, 'Aguardando imagem');
      setStatus(el.photoStatus, 'Nenhuma imagem selecionada.');
      setStatus(el.previewStatus, 'Adicione uma imagem para criar a prévia.');
      return;
    }
    let url = null;
    try {
      if (!/\.(png|jpe?g|webp)$/i.test(file.name || '')) throw new Error('Selecione um PNG, JPEG ou WebP.');
      if (file.size > MAX_IMAGE_BYTES) throw new Error('A imagem excede o limite de 20 MB.');
      const buffer = await file.arrayBuffer();
      if (token !== state.imageToken) return;
      const mime = imageMime(new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 12)));
      if (!mime) throw new Error('O conteúdo não é PNG, JPEG ou WebP válido.');
      url = URL.createObjectURL(new Blob([buffer], { type: mime }));
      const image = new Image();
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('Não foi possível decodificar a imagem.')); image.src = url; });
      if (token !== state.imageToken) return;
      const width = image.naturalWidth, height = image.naturalHeight;
      if (!width || !height || width * height > MAX_PIXELS) throw new Error('A imagem excede o limite de 32 megapixels.');
      const source = document.createElement('canvas'); source.width = width; source.height = height;
      const sourceContext = source.getContext('2d', { willReadFrequently: true });
      sourceContext.drawImage(image, 0, 0);
      state.image = { width, height, pixels: sourceContext.getImageData(0, 0, width, height).data };
      state.imageName = file.name;
      resetCrop(false);
      setBadge(el.photoBadge, 'Imagem pronta', 'ok');
      setStatus(el.photoStatus, file.name + ' · ' + width + ' × ' + height + ' px.', 'success');
      scheduleConversion();
    } catch (error) {
      if (token !== state.imageToken) return;
      setBadge(el.photoBadge, 'Imagem recusada', 'bad');
      setStatus(el.photoStatus, error.message || 'Não foi possível abrir a imagem.', 'error');
      setStatus(el.previewStatus, 'Adicione uma imagem válida para criar a prévia.', 'error');
    } finally {
      if (url) URL.revokeObjectURL(url);
      renderCustomizerState();
    }
  }
  function makeDemo() {
    ++state.imageToken;
    invalidateConversion();
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 512, 512);
    gradient.addColorStop(0, '#153a52'); gradient.addColorStop(1, '#89afa1');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = '#e0efbd'; ctx.beginPath(); ctx.arc(256, 265, 175, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#253e44'; ctx.fillRect(110, 245, 292, 75);
    ctx.fillStyle = '#ed754d'; ctx.fillRect(110, 312, 292, 37);
    ctx.fillStyle = '#b8dee0'; ctx.fillRect(132, 256, 248, 38);
    ctx.fillStyle = '#f9d36f'; ctx.fillRect(220, 80, 72, 74);
    state.image = { width: 512, height: 512, pixels: ctx.getImageData(0, 0, 512, 512).data };
    state.imageName = 'arte-de-exemplo';
    resetCrop(false);
    setBadge(el.photoBadge, 'Exemplo pronto', 'ok');
    setStatus(el.photoStatus, 'Arte geométrica gerada neste navegador; escolha uma foto para personalizar.', 'success');
    scheduleConversion(); renderCustomizerState();
  }
  function resetCrop(schedule = true) {
    el.zoom.value = '1'; el.positionX.value = '50'; el.positionY.value = '50';
    if (schedule) scheduleConversion();
    renderCustomizerState();
  }
  function renderCrop() {
    if (!state.image) return null;
    const image = state.image, zoom = Number(el.zoom.value), side = Math.min(image.width, image.height) / zoom;
    const sx = (image.width - side) * Number(el.positionX.value) / 100;
    const sy = (image.height - side) * Number(el.positionY.value) / 100;
    const out = new Uint8Array(64 * 64 * 4);
    const sampleX = Array.from({ length: 64 }, (_, x) =>
      Array.from({ length: 4 }, (_, subX) => Math.max(0, Math.min(image.width - 1,
        Math.floor(sx + (x + (subX + 0.5) / 4) * side / 64)))));
    const sampleY = Array.from({ length: 64 }, (_, y) =>
      Array.from({ length: 4 }, (_, subY) => Math.max(0, Math.min(image.height - 1,
        Math.floor(sy + (y + (subY + 0.5) / 4) * side / 64)))));
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const sum = [0, 0, 0, 0];
      for (const py of sampleY[y]) for (const px of sampleX[x]) {
        const at = (py * image.width + px) * 4;
        for (let channel = 0; channel < 4; channel++) sum[channel] += image.pixels[at + channel];
      }
      const dest = (y * 64 + x) * 4;
      for (let channel = 0; channel < 4; channel++) out[dest + channel] = Math.round(sum[channel] / 16);
    }
    drawRgba(el.cropCanvas, out);
    el.cropPlaceholder.hidden = true;
    return out;
  }
  function renderPalette(conversion) {
    el.paletteSwatches.replaceChildren();
    const usable = conversion.usableIndices || spec.usableIndices || [3, 4, 5, 6, 7, 11, 12, 13, 15];
    for (const index of usable) {
      const rgb = core.cramRgb(conversion.paletteWords[index - 3]);
      const swatch = document.createElement('span'); swatch.className = 'swatch';
      swatch.style.backgroundColor = 'rgb(' + rgb.map(Math.round).join(',') + ')';
      swatch.title = 'Cor ' + index;
      el.paletteSwatches.append(swatch);
    }
    el.colorCount.textContent = usable.length + ' CORES';
  }
  function scheduleConversion() {
    invalidateConversion();
    if (!state.image) { renderCustomizerState(); return; }
    const rgba = renderCrop(), token = state.conversionToken;
    setStatus(el.previewStatus, 'Convertendo para a paleta do jogo…');
    state.conversionTimer = setTimeout(() => {
      if (token !== state.conversionToken) return;
      try {
        if (!core || !spec) throw new Error('Conversor indisponível.');
        const conversion = core.convertRgba64(rgba, { usableIndices: spec.usableIndices });
        if (token !== state.conversionToken) return;
        state.conversion = conversion;
        drawRgba(el.previewCanvas, conversion.previewRgba);
        el.previewPlaceholder.hidden = true;
        renderPalette(conversion);
        setStatus(el.previewStatus, 'Prévia pronta. As cores seguem a paleta segura do retrato.', 'success');
      } catch (error) {
        state.conversion = null; el.previewPlaceholder.hidden = false;
        setStatus(el.previewStatus, error.message || 'Não foi possível criar a prévia.', 'error');
      }
      renderCustomizerState();
    }, 70);
    renderCustomizerState();
  }
  function safeDownloadName(name) {
    return (name || 'grid2026').replace(/\.(md|bin|gen)$/i, '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'grid2026';
  }
  function diffFromOriginal(original, output) {
    if (!(original instanceof Uint8Array)) return null;
    const sharedLength = Math.min(original.length, output.length);
    let changedByteCountWithinOriginal = 0;
    for (let i = 0; i < sharedLength; i++) if (original[i] !== output[i]) changedByteCountWithinOriginal++;
    const appendedByteCount = Math.max(0, output.length - original.length);
    return {
      changedByteCountWithinOriginal, appendedByteCount,
      totalDifferentOrAppendedBytes: changedByteCountWithinOriginal + appendedByteCount
    };
  }
  async function build() {
    if (!canBuild()) { renderCustomizerState(); return; }
    clearOutput();
    const token = state.buildToken;
    state.building = true; renderCustomizerState();
    try {
      await new Promise(resolve => setTimeout(resolve, 0));
      if (token !== state.buildToken) return;
      if (!spec.targetConfirmed || !el.confirmTarget.checked) throw new Error('Confirme primeiro qual retrato deve ser substituído');
      const result = await Promise.resolve(core.buildPatch(spec, state.rom, state.conversion, { targetConfirmed: true }));
      if (token !== state.buildToken) return;
      if (!(result.rom instanceof Uint8Array) || result.rom.length !== state.rom.length)
        throw new Error('O resultado não passou na validação de tamanho.');
      const report = {
        format: 'Grid2026 original-to-season-to-portrait validation report', version: spec.version,
        stages: state.sourceKind === 'original' ? ['original', 'Grid2026 v3.3', 'personalized portrait'] : ['Grid2026 v3.3', 'personalized portrait'],
        source: { kind: state.sourceKind, size: state.sourceRom.length, sha256: state.sourceSha256 },
        composition: {
          applied: state.compositionReady, baselineSha256: state.romHash,
          method: state.compositionReady ? 'automatic-reduced-recipe' : null,
          recipeSha256: state.recipeSha256, originalSha256: state.sourceKind === 'original' ? state.sourceSha256 : null
        },
        baseline: { label: spec.baseline.label, size: state.rom.length, sha256: state.romHash },
        target: { slot: spec.target.slot, label: spec.target.label, visuallyConfirmed: true },
        image: { width: state.image.width, height: state.image.height, crop: { zoom: Number(el.zoom.value), x: Number(el.positionX.value), y: Number(el.positionY.value) } },
        output: { size: result.rom.length, sha256: result.sha256, checksumGenesis: result.checksum, compressedBytes: result.compressedBytes, changedByteCount: result.changedOffsets.length, changedOffsets: result.changedOffsets },
        portraitDiffFromBaseline: { changedByteCount: result.changedOffsets.length, changedOffsets: result.changedOffsets },
        finalDiffFromOriginal: state.sourceKind === 'original' ? diffFromOriginal(state.sourceRom, result.rom) : null,
        validation: { exactSource: true, exactBaseline: true, targetRecord: true, allowedRanges: true, decodedPortrait: true }
      };
      const romUrl = URL.createObjectURL(new Blob([result.rom], { type: 'application/octet-stream' }));
      const reportUrl = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2) + '\n'], { type: 'application/json' }));
      state.outputUrls.push(romUrl, reportUrl);
      el.downloadRom.href = romUrl; el.downloadRom.download = safeDownloadName(state.romName) + '-retrato-grid2026.bin';
      el.downloadReport.href = reportUrl; el.downloadReport.download = safeDownloadName(state.romName) + '-validacao.json';
      el.downloadArea.hidden = false;
      setStatus(el.buildStatus, 'ROM validada e pronta para download. SHA-256: ' + result.sha256.slice(0, 16) + '…', 'success');
      const revision = state.romToken + ':' + state.conversionToken;
      if (state.lastCompletedRevision !== revision) {
        state.lastCompletedRevision = revision;
        window.dispatchEvent(new CustomEvent('smgp2:conversion-completed'));
      }
    } catch (error) {
      if (token !== state.buildToken) return;
      setStatus(el.buildStatus, 'Não foi possível criar a ROM: ' + (error.message || error), 'error');
    } finally {
      if (token === state.buildToken) { state.building = false; el.buildButton.disabled = !canBuild(); }
    }
  }

  if (spec && spec.target) {
    el.targetSlot.textContent = 'SLOT ' + String(spec.target.slot).padStart(2, '0');
    el.targetLabel.textContent = spec.target.label;
  }
  el.candidateDetails.hidden = true;
  el.romFile.addEventListener('change', event => { const file = event.target.files[0]; event.target.value = ''; loadRom(file); });
  el.photoFile.addEventListener('change', event => { const file = event.target.files[0]; event.target.value = ''; loadPhoto(file); });
  el.demoButton.addEventListener('click', makeDemo);
  for (const input of [el.zoom, el.positionX, el.positionY]) input.addEventListener('input', scheduleConversion);
  el.resetButton.addEventListener('click', () => resetCrop());
  el.confirmTarget.addEventListener('change', () => { clearOutput(); renderCustomizerState(); });
  el.buildButton.addEventListener('click', build);
  el.romDropzone.addEventListener('dragover', event => { event.preventDefault(); el.romDropzone.classList.add('dragover'); });
  el.romDropzone.addEventListener('dragleave', () => el.romDropzone.classList.remove('dragover'));
  el.romDropzone.addEventListener('drop', event => {
    event.preventDefault(); el.romDropzone.classList.remove('dragover');
    if (event.dataTransfer.files.length) loadRom(event.dataTransfer.files[0]);
  });
  window.addEventListener('pagehide', revokeUrls);
  renderCustomizerState();
})();
