/* Contrato auditado. Sem ROM ou gráficos do jogo. Endereços [start,end) em bytes. */
(function(root){
  const spec = {
  "version": 1,
  "verified": true,
  "targetConfirmed": true,
  "target": {
    "slot": 11,
    "label": "Piloto do jogador · retrato com capacete",
    "confirmation": "Identificado por descrição única; confirme visualmente antes de gerar."
  },
  "baseline": {
    "label": "Grid 2026 v3.3",
    "size": 2097152,
    "sha256": "b840fcaa0851daf548c9c4c4dadf18d3cb78ebf9683fde897bb677b44a3ea872",
    "checksum": 34547
  },
  "portraitPointerOffset": 509600,
  "expectedRecordHex": "0007c73c0007c9500007fd44",
  "expectedPalettePointer": 510288,
  "expectedGraphicsPointer": 523588,
  "palette": {
    "offset": 1134592,
    "capacity": 26,
    "mode": "reserved-ff"
  },
  "graphics": {
    "offset": 1134624,
    "capacity": 2309,
    "mode": "reserved-ff"
  },
  "reservedBank": {
    "start": 1134592,
    "end": 1138688,
    "fill": 255
  },
  "allowedRanges": [
    {
      "start": 398,
      "end": 400
    },
    {
      "start": 509604,
      "end": 509612
    },
    {
      "start": 1134592,
      "end": 1134618
    },
    {
      "start": 1134624,
      "end": 1136933
    }
  ],
  "usableIndices": [
    3,
    4,
    5,
    6,
    7,
    11,
    12,
    13,
    15
  ],
  "dynamicIndices": [
    8,
    9,
    10,
    14
  ],
  "recordTableOffset": 509468,
  "recordCount": 24,
  "candidates": [
    {
      "slot": 11,
      "label": "Jogador com capacete",
      "recordOffset": 509600,
      "paletteOffset": 510288,
      "graphicsOffset": 523588
    }
  ],
  "sharedPaletteWords": [
    0,
    0,
    174
  ]
};
  if (typeof module === "object" && module.exports) module.exports = spec;
  else root.PORTRAIT_SPEC = spec;
})(typeof globalThis !== "undefined" ? globalThis : this);
