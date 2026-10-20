# Validação do protótipo

Validação realizada com imagem geométrica sintética, sem fotografia pessoal. A confirmação automatizada da caixa de alvo nos testes não representa aprovação de uma foto real pelo usuário.

| Verificação | Resultado |
|---|---|
| Testes unitários | 8 passaram |
| Decodificação comparada com leitor anterior | 24/24 retratos da baseline coincidiram em bytes e fim de stream |
| Playwright | 15 verificações passaram, Chromium 145 |
| Abertura direta `file://` | ROM validada, prévia e construção concluídas |
| Desktop e mobile 390 px | Capturas realmente inspecionadas; sem overflow horizontal |
| Rede | Zero requisições externas e zero métodos de upload durante o fluxo |
| Repetição | Mesmo hash da ROM em duas construções com os mesmos ajustes |
| Conferência separada Python | Tamanho, checksum, diff e 4096 pixels da prévia conferidos |
| Revisão independente | Dois checkpoints sem defeitos impeditivos |

O teste de integração importou PNG sintético, ajustou os controles, confirmou o retrato, baixou ROM/JSON, alterou o recorte e verificou a revogação da saída. Também recusou tamanho incorreto, conteúdo alterado com mesmo tamanho, `.smd` e imagem falsa. Os oito unitários cobrem conversão, SHA-256, tiles, fronteiras dos descritores Kosinski, streams truncados e referências inválidas, checksum e mapas incompatíveis.

A saída sintética testada tinha 2.097.152 bytes, checksum `9487`, SHA-256 `264f786954fa837b3be17b432a3dc42da617e418a356f18ec88a9b9bcbd8fada` e 1773 bytes diferentes, todos nos quatro intervalos permitidos. Os dados de teste ficam fora do Git.

## Conferência no jogo

A cópia sintética foi importada no OpenEmu instalado. Foi observada a ficha SERGA do jogador com o padrão de teste no local do capacete e, depois, uma tela de corrida. Uma captura enviada pelo usuário também confirma o padrão na ficha do jogador. Essas são observações de execução real, não reconstruções estáticas.

Isso confirma a exibição do retrato sintético nesse contexto. Não foi feita comparação automatizada de frames com a baseline, uma corrida completa, teste de todos os modos, troca de equipe em carreira ou avaliação de uma foto real. Preservação das demais tabelas é garantida pelo diff integral; observação de uma tela de corrida não equivale a QA visual completo de todas as telas.

O projeto de decompilação separado permaneceu pausado. Nenhum processo longo, build ou tradução C dele foi iniciado. Fontes, ROMs e patches de origem foram apenas lidos.
