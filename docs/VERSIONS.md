# Duas edições no mesmo conversor

O seletor oferece a v3.3 preservada e a edição PT-BR aprovada com Audio 2 e Kimi. A PT-BR é a seleção inicial. Ambas exigem a ROM americana original verificada e uma foto; todo o processamento da ROM e da imagem ocorre no navegador. Nenhuma chave de IA é usada pelo site.

| Edição | SHA-256 antes da foto | Checksum |
| --- | --- | --- |
| Grid 2026 v3.3 | `b840fcaa0851daf548c9c4c4dadf18d3cb78ebf9683fde897bb677b44a3ea872` | `86F3` |
| PT-BR / Audio 2 / Kimi | `83ff290cfca22a52f97c18134d86af012848c7e591627c6d96dba4e893aff3a9` | `F687` |

A original aceita tem 1.048.576 bytes e SHA-256 `c02206602e00dd8e9b6c38943b8a3be41e37d2d21c1768cf342900bce11ab4f0`. As duas bases têm 2.097.152 bytes. O hash final muda de acordo com a foto e o enquadramento, e aparece no relatório baixado.

## Composição e publicação

`season-recipe.js`, `season-assets.js`, `season-provenance.json` e `spec.js` continuam intactos. A receita anterior reconstrói a v3.3 a partir da cópia do visitante. `versions.js` então aplica, somente para PT-BR, `ptbr-delta.js`: 1.431 operações ordenadas sem sobreposição, 109.471 bytes literais de diferenças, 30.068 bytes copiados da v3.3 local e 1.620 bytes de preenchimento. A receita incremental ocupa 247.947 bytes como fonte JavaScript. Seu SHA-256 é fixado no código e conferido também pelo empacotador contra `ptbr-provenance.json`.

O novo arquivo é um patch incremental da tradução, das sete vozes autorizadas e do grid/retrato Kimi; não é uma ROM completa nem o antigo IPS privado da temporada. A publicação não inclui ROMs, fotos de referência, saves, áudio original extraído, credenciais ou resultados de teste. Os textos/gráficos traduzidos são diferenças sobre a base exigida. Recursos idênticos encontrados na base são referências locais. A receita v3.3 continua reconstruindo a arte original a partir da ROM do visitante.

O gerador `prepare-ptbr-delta.py` recebe `--baseline`, `--target` e `--out`; verifica os dois hashes antes de produzir a receita. Os caminhos das ROMs são fornecidos localmente e não ficam no código público. O pacote final usa uma allowlist de 13 arquivos; apenas o patch auditado recebe limite de 300 kB, enquanto os demais mantêm 200 kB.

## Retrato e preservação

A foto substitui somente o jogador de capacete, slot 11, registro `0x7C6A0`. As duas bases têm o mesmo registro `0007c73c0007c9500007fd44` e a reserva `0x115000–0x116000` inteiramente `FF`. A paleta vai para `0x115000`, os 64 tiles Kosinski para `0x115020`. Somente a paleta/arte nova, dois ponteiros desse registro e o checksum podem mudar. A confirmação visual do jogador permanece obrigatória.

Kimi ocupa o slot 0; Norris vai ao slot 1; Sainz ao 12; Russell permanece no 4. A foto não muda esses retratos, equipes, nomes, traduções nem os sete slots de áudio. O teste compara cada byte fora da allowlist contra a base selecionada, inclusive todo o banco `0xF8000–0x100000` e os recursos do Kimi.

Uma v3.3 verificada também pode ser usada diretamente ou atualizada para PT-BR. A PT-BR verificada pode ser personalizada diretamente. ROMs já personalizadas, revisões desconhecidas e PT-BR fornecida como se fosse v3.3 são recusadas. Para voltar à v3.3, o visitante escolhe a edição anterior e fornece sua original/v3.3 preservada. Trocar de versão invalida leituras e downloads pendentes e exige nova confirmação do retrato.

## Validação

- 38 testes Node, com ROMs locais fornecidas via `ROM_TEST`, `BASELINE_TEST` e `PTBR_TEST`: equivalência integral das duas bases, imutabilidade de entrada, checksum, formato/limites, rejeição de receita alterada e personalização restrita.
- 7 testes Python do empacotador: allowlist, proveniência, ausência de arquivo privado, configuração preview/produção e métricas mínimas existentes.
- 18 verificações do fluxo anterior no Chromium: incluindo v3.3, download, reversão, entradas inválidas, `file://` e ausência de uploads.
- 9 grupos de verificações em `tests/versions-browser.cjs`: duas versões com foto, nomes de download/relatórios, reversão byte exata, preservação de áudio/Kimi, troca rápida, atualização avançada e layout em 390/320 px. O mesmo teste roda em loopback, preview e domínio deste projeto. Evidências ficam em `evidence/`, fora do Git e da pasta pública.
- Verificação de sintaxe JavaScript e `git diff --check`. O repositório não tem comando lint/npm nem framework; o build é `prepare-public.py`.

Esses testes verificam o conversor e seus arquivos de saída. Não são uma nova sessão de gameplay no emulador. A base PT-BR é a aprovada pelo usuário; a cobertura de tradução continua a dessa base, sem promessa de tradução integral. As taxas das vozes permanecem as nominais usadas no teste aprovado, não uma nova medição em execução. Não há alteração de saves, física ou sessão ativa.

## Deploy e rollback

Projeto existente: `prj_RcjtrZy4QFeJWEghu5nrLqo1nbbq`, domínio `https://super-monaco-gp-2-converter.vercel.app/`.

Rollback anterior preservado: deployment `dpl_LGH7MR5meU2HJWftV5YHMk6BqbuW`, commit `c7be6b76246115da382404f9311c20e91f16789c`, URL `https://super-monaco-gp-2-converter-hl9wumkp5-mauriciokjs-projects.vercel.app/`. Retornar a esse deployment restaura o site anterior; o seletor também mantém a v3.3 funcional no site atualizado. O relatório privado de entrega registra os IDs e resultados do preview/produção desta atualização.
