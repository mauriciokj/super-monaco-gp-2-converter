# Contrato técnico da prévia

O aplicativo usa um contrato fixo em `personalizador-local/spec.js`; não aceita offsets ou especificações enviados pelo visitante. A original, a receita, os retratos autorizados e a baseline intermediária são identificados por SHA-256 e tamanho exatos. A personalização também confere o registro de ponteiros esperado.

## Composição original → edição 2026

Entrada suportada: original USA de 1 MiB, SHA-256 `c02206602e00dd8e9b6c38943b8a3be41e37d2d21c1768cf342900bce11ab4f0`, checksum `5AC7`, cabeçalho SEGA GENESIS e região U. Não se remove a validação de tamanho: o contrato aceita essa revisão exata.

O módulo puro `season-recipe.js` usa uma receita reduzida: expande a cópia da original, aplica escritas próprias de nomes, cores, cabeçalho e ponteiros, copia dados da original por referência e reconstrói arte de seleção, mapa Enigma e miniaturas. Os 14.496 bytes derivados não estão incluídos como imagens extraídas no pacote. `season-assets.js` fornece somente os onze retratos adicionais autorizados: 22 blocos, 25.685 bytes, cada retrato com 26 bytes de paleta e 2309 de gráficos Kosinski.

`season-provenance.json` classifica os 84 registros do IPS de referência sem incluir esse IPS. A receita usa 92 escritas pequenas, totalizando 746 bytes, e dez cópias de 248 bytes da original, além de preenchimento e recursos derivados. Hashes de recursos e limites são conferidos antes da composição. O gerador externo reproduz a receita sem emitir ROM, IPS completo ou foto de referência.

A ROM inteira resultante precisa ter 2 MiB, checksum de cabeçalho e calculado `86F3` e SHA-256 `b840fcaa0851daf548c9c4c4dadf18d3cb78ebf9683fde897bb677b44a3ea872`. A comparação com a referência conhecida foi byte a byte. Só então essa intermediária pode chegar ao personalizador de retrato. O módulo histórico `pipeline.js` mantém o parser IPS limitado e a validação da baseline avançada; não exige seleção de IPS no fluxo atual.

## Alvo e formato

A tabela de retratos tem 24 registros de 12 bytes em `0x7C61C`: ponteiros big endian de nome/país, paleta e gráfico. O único retrato com capacete é o slot 11, registro `0x7C6A0`. A alteração conserva o ponteiro de nome e redireciona somente paleta e gráfico desse registro.

O retrato usa 64 tiles de 8 × 8 pixels, em ordem de linhas. Cada tile ocupa 32 bytes, 4 bits por pixel, com o pixel esquerdo no nibble alto. A imagem descomprimida ocupa 2048 bytes. Os gráficos usam Kosinski com descritor little endian consumido a partir do bit menos significativo. A próxima palavra de descritor é consumida imediatamente após o 16º bit, antes de seu payload.

A paleta local tem 13 palavras big endian, correspondentes aos índices 3–15. CRAM usa três bits por canal no formato `0000 BBB0 GGG0 RRR0`. Os índices 0–2 pertencem ao contexto da tela. O jogo sobrescreve os índices 8, 9, 10 e 14 de acordo com a equipe do jogador. O conversor usa somente `[3,4,5,6,7,11,12,13,15]` e copia as quatro palavras reservadas da baseline para a nova paleta. Nenhum pixel novo usa as cores dinâmicas.

## Conversão

Após decodificar a imagem, o recorte usa uma grade determinística de 4 × 4 amostras por pixel de saída. Transparência é composta sobre fundo azul. A quantização usa a grade de 512 cores do hardware, seleção inicial por frequência/distância e refinamento com desempate estável. Não há aleatoriedade ou dithering. O mesmo raster decodificado e os mesmos controles produzem os mesmos bytes; decodificação JPEG, orientação e perfis de cor seguem o navegador.

O encoder escreve somente tokens literais, gerando sempre 2309 bytes. Isso evita depender da taxa de compressão da foto e permite uma reserva de espaço fixa. Encoder e decoder são verificados por roundtrip exato antes da exportação.

## Espaço e preservação

O banco `0x115000..0x116000` foi reservado explicitamente dentro da expansão existente da v3.3, após conferir a cadeia de alocações dos mods. O último recurso anterior termina em `0x11405E`. A baseline inteira deve corresponder ao hash conhecido e o banco inteiro deve conter `FF`; a escolha não se baseia apenas em encontrar bytes vazios.

| Intervalo [início,fim) | Única alteração permitida |
|---|---|
| `0x18E..0x190` | checksum |
| `0x7C6A4..0x7C6AC` | ponteiros de paleta e gráfico do jogador |
| `0x115000..0x11501A` | paleta realocada, 26 bytes |
| `0x115020..0x115925` | gráfico Kosinski literal, 2309 bytes |

Nesta segunda etapa, os recursos existentes da edição 2026 ficam intactos, inclusive quando houver alguma referência indireta não identificada. O nome compartilhado, outras 23 entradas e rotinas do jogo não mudam. A ROM intermediária e a final têm exatamente 2 MiB; a original de entrada continua com 1 MiB e não é alterada. Checksum: soma das palavras big endian de `0x200` ao final, módulo 65536, gravada em `0x18E`.

O core confere registro completo, ponteiros, capacidade, reserva, sobreposição e cobertura das escritas. Depois compara todos os bytes da saída com a **intermediária 2026** e exige a allowlist. A diferença ampla original → edição 2026 é registrada separadamente no relatório. Não se aplica a allowlist do retrato à expansão da primeira etapa. As entradas são clonadas, nunca alteradas. O navegador cria um novo Blob para download.

## Privacidade e fronteira de confiança

No uso local, a CSP bloqueia conexões e a telemetria permanece desligada. Na publicação configurada, somente o endpoint de analytics aprovado pode receber uma visualização da URL canônica; custom events ficam desligados no plano Hobby. Nenhuma ROM, foto, nome de arquivo, hash do resultado ou relatório é enviado. Não há API de conversão, formulário remoto, armazenamento persistente de ROM ou service worker. Trocar imagem, recorte, ROM ou confirmação revoga os links da saída anterior.

O código e o spec distribuídos são a parte confiável; a prévia não é uma garantia de segurança para um spec alterado manualmente. O servidor opcional usa uma lista fixa de arquivos e loopback. ROMs, IPS completo, screenshots, inventários privados e downloads nunca são servidos. O empacotador público inclui apenas fontes revisados e os retratos autorizados, após validar a proveniência; a receita atual realiza a composição completa com a original fornecida pelo visitante.
