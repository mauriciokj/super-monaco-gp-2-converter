# Super Monaco GP 2 Converter

Prévia local: **ROM original USA suportada + foto → edição completa Grid 2026 v3.3 + retrato personalizado**. Você escolhe a ROM original sem modificações e uma imagem pronta, ajusta o enquadramento, confere a prévia e baixa uma nova cópia de 2 MiB.

Tudo é processado no navegador, sem IA, chaves, serviços externos ou upload. O código versionado não contém ROMs, fotos, gráficos extraídos, patches do jogo ou emulador. O protótipo local usa um pacote 2026 privado, separado do Git.

## Experimentar

Com o pacote privado local já configurado, abra `personalizador-local/index.html` em um navegador moderno. Não é necessário instalar pacotes nem iniciar um servidor.

1. Selecione sua ROM **original USA de 1 MiB**. O aplicativo confere o hash e compõe automaticamente a edição 2026 completa.
2. Confira a miniatura do retrato atual e marque que deseja substituir esse retrato.
3. Escolha uma imagem PNG, JPEG ou WebP. O botão de exemplo gera uma arte geométrica local para experimentar.
4. Ajuste ampliação e posição e confira a imagem convertida.
5. Clique em **Validar e criar ROM** e depois em **Baixar ROM .bin**. O relatório JSON inclui hash, checksum e offsets alterados.

Como alternativa, Python 3 pode servir somente os arquivos da interface na própria máquina:

```sh
python3 personalizador-local/serve.py
```

Acesse `http://127.0.0.1:8765`. O servidor escuta apenas em loopback, não aceita uploads e serve somente a interface e o pacote privado local configurado. Não serve diretórios, ROMs ou resultados dos testes. `Ctrl+C` encerra.

## Pacote privado e código publicável

A atualização completa requer dados dos mods existentes, incluindo retratos e arte do jogo. Esses dados **não estão no Git**. Na máquina do protótipo, eles já estão configurados em `personalizador-local/local-grid2026-data.js`, ignorado pelo Git e carregado pelo navegador local. O visitante continua fornecendo apenas a ROM original e a foto.

Em uma nova instalação, um responsável que já tenha o patch completo verificado pode configurar o pacote local:

```sh
python3 personalizador-local/prepare-local-data.py --patch "/caminho/externo/original-to-v3.3.ips"
```

O helper aceita somente o delta de 131.783 bytes com SHA-256 `0fbc5cd9f26ddced20f1b7cd27a61d5869dc19d2539854d109672e0f49c20830`. Ele não baixa nada e nunca deve ser usado para publicar o arquivo gerado. Sem esse pacote, o aplicativo explica a ausência e bloqueia a conversão da original. Uma distribuição pública que realize a atualização completa ainda depende de uma decisão sobre o fornecimento autorizado desses dados; publicar apenas o código não os inclui.

## Compatibilidade e limites

| Item | Aceito |
|---|---|
| Entrada principal | Original USA (En,Ja), binária, não intercalada, 1.048.576 bytes |
| Extensão | `.md`, `.bin` ou `.gen`, sempre validada pelo conteúdo |
| SHA-256 original exato | `c02206602e00dd8e9b6c38943b8a3be41e37d2d21c1768cf342900bce11ab4f0` |
| Intermediária verificada | Grid 2026 v3.3, 2.097.152 bytes, SHA-256 `b840fcaa0851daf548c9c4c4dadf18d3cb78ebf9683fde897bb677b44a3ea872` |
| Imagem | PNG, JPEG ou WebP; até 20 MiB e 32 megapixels |
| Retrato final | 64 × 64 pixels, nove cores estáveis na paleta do Mega Drive |
| Alvo | Slot 11, retrato do próprio jogador com capacete; acompanha o jogador ao trocar equipe |

Outras revisões, `.smd`, arquivos compactados e ROMs já personalizadas são recusados. O tamanho sozinho não autoriza uma ROM. Para trocar a foto novamente, use sua original preservada. A entrada direta da Grid 2026 v3.3 verificada de 2 MiB continua disponível como compatibilidade avançada.

A primeira etapa aplica todos os mods do patch existente e exige que o resultado inteiro seja idêntico à edição 2026 conhecida. A segunda permite mudar somente a paleta e os gráficos realocados do jogador, seus dois ponteiros e o checksum, preservando o restante da edição 2026 byte a byte. A imagem terá a aparência limitada de 64 × 64 pixels. A prévia usa RGB linear aproximado do hardware, sem simular todos os filtros ou monitores.

## Testes

Unitários, sem ROM ou dependências:

```sh
node --test personalizador-local/core.test.cjs personalizador-local/pipeline.test.cjs
```

Fluxo Playwright, usando instalação local de Playwright/Chromium e sua ROM externa ao repositório. Inicie primeiro o servidor acima. Nenhum download de ROM é feito pelos testes:

```sh
TEST_ROM="/caminho/externo/original.bin" TEST_BASELINE_ROM="/caminho/externo/referencia2026.bin" node tests/browser.cjs
TEST_ROM="/caminho/externo/original.bin" TEST_BASELINE_ROM="/caminho/externo/referencia2026.bin" python3 tests/verify_output.py
```

O pacote local precisa estar configurado antes dos testes de integração. `TEST_BASELINE_ROM` permite comparar todos os bytes com a referência externa; a verificação Python exige essa referência. Os testes criam um padrão sintético, validam o download e gravam evidências e ROMs em `evidence/`, excluída do Git e do servidor. Não reutilize os arquivos de teste como resultado da sua foto.

[Contrato técnico](docs/TECHNICAL.md) · [Validação e limites observados](docs/VALIDATION.md)

O projeto não concede direitos sobre o jogo, marcas, ROMs ou imagens fornecidas pelo usuário. Nenhuma licença de conteúdo de terceiros foi adicionada.
