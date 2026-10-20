# Validação do protótipo

Validação realizada com imagem geométrica sintética, sem fotografia pessoal. A confirmação automatizada da caixa de alvo nos testes não representa aprovação de uma foto real pelo usuário.

| Verificação | Resultado |
|---|---|
| Testes unitários | 35 passaram, incluindo receita reduzida com original/referência externas; 7 testes Python de empacotamento |
| Decodificação comparada com leitor anterior | 24/24 retratos da baseline coincidiram em bytes e fim de stream |
| Playwright | 18 verificações passaram nos fontes e no pacote público, usando a original anexada |
| Abertura direta `file://` | Original → edição 2026 → retrato concluído com a receita reduzida versionada |
| Desktop e mobile 390 px | Capturas realmente inspecionadas; sem overflow horizontal |
| Rede | Zero requisições externas e zero métodos de upload durante o fluxo |
| Repetição | Mesmo hash da ROM em duas construções com os mesmos ajustes |
| Conferência separada Python | Tamanho, checksum, diff e 4096 pixels da prévia conferidos |
| Composição antes do retrato | Original anexada + receita reduzida + onze retratos autorizados = referência 2026 byte a byte |
| Revisão independente | Checkpoints do retrato e do compositor sem defeitos impeditivos |

O teste de integração importou a **ROM original anexada de 1 MiB**, compôs a edição 2026 de 2 MiB e comparou todos os bytes com a referência conhecida antes de personalizar. Depois importou PNG sintético, ajustou os controles, confirmou o retrato, baixou ROM/JSON, alterou o recorte e verificou a revogação da saída. Também recusou tamanho incorreto, original alterada com mesmo tamanho, `.smd`, imagem falsa e alterações nos assets autorizados. A UI tem somente duas entradas de arquivo, ROM e imagem. O modo avançado de entrada2026 permanece testado.

Os unitários cobrem conversão, SHA-256, tiles, fronteiras dos descritores Kosinski, streams truncados e referências inválidas, checksum e mapas incompatíveis. O compositor acrescenta registros IPS literais/RLE, expansão até 2 MiB, truncamento, limites, formato inválido, trailer incorreto e verificação da identidade de cada etapa. A nova receita acrescenta vetores Enigma independentes, identidade dos assets e rejeição de originales incompatíveis; o empacotamento confere a allowlist e a configuração Hobby. As fontes e o patch privado permanecem inalterados.

O arquivo original enviado tem SHA-256 `c02206602e00dd8e9b6c38943b8a3be41e37d2d21c1768cf342900bce11ab4f0` e checksum `5AC7`. A intermediária tem SHA-256 `b840fcaa0851daf548c9c4c4dadf18d3cb78ebf9683fde897bb677b44a3ea872` e checksum `86F3`. O delta completo histórico foi reproduzido por implementações JS e Python independentes. A receita pública reduzida foi depois comparada integralmente com a mesma referência, reconstruindo 14.496 bytes derivados da original e incorporando somente os onze retratos autorizados. A igualdade integral cobre retratos de adversários, textos, equipes, cores e menu; o verificador também compara explicitamente os 23 retratos não personalizados e os blocos de cores/menu após a segunda etapa.

A saída sintética testada tinha 2.097.152 bytes, checksum `9487`, SHA-256 `264f786954fa837b3be17b432a3dc42da617e418a356f18ec88a9b9bcbd8fada` e 1773 bytes diferentes, todos nos quatro intervalos permitidos. Os dados de teste ficam fora do Git.

## Conferência no jogo

A cópia sintética foi importada no OpenEmu instalado. Foi observada a ficha SERGA do jogador com o padrão de teste no local do capacete e, depois, uma tela de corrida. Uma captura enviada pelo usuário também confirma o padrão na ficha do jogador. Essas são observações de execução real, não reconstruções estáticas.

A saída final do novo fluxo original → edição 2026 → retrato tem exatamente o mesmo hash desse binário já observado no OpenEmu; não foi necessária outra importação para conferir um conteúdo idêntico. Isso não constitui uma nova sessão de QA completa do jogo.

Isso confirma a exibição do retrato sintético nesse contexto. Não foi feita comparação automatizada de frames com a baseline, uma corrida completa, teste de todos os modos, troca de equipe em carreira ou avaliação de uma foto real. Preservação das demais tabelas é garantida pelo diff integral; observação de uma tela de corrida não equivale a QA visual completo de todas as telas.

O projeto de decompilação separado permaneceu pausado. Nenhum processo longo, build ou tradução C dele foi iniciado. Fontes, ROMs e patches de origem foram apenas lidos.
