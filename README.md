# Super Monaco GP 2 Converter

Prévia local para trocar o retrato do jogador com capacete na ROM **Grid 2026 v3.3** de Super Monaco GP II. Você escolhe a sua ROM e uma imagem pronta, ajusta o enquadramento, confere a prévia e baixa uma nova cópia personalizada.

Tudo é processado no navegador, sem IA, chaves, serviços externos ou upload. Nenhuma ROM, fotografia, gráfico extraído, patch do jogo ou emulador acompanha este projeto.

## Experimentar

Abra `personalizador-local/index.html` em um navegador moderno. Não é necessário instalar pacotes nem iniciar um servidor.

1. Selecione sua ROM Grid 2026 v3.3 verificada.
2. Confira a miniatura do retrato atual e marque que deseja substituir esse retrato.
3. Escolha uma imagem PNG, JPEG ou WebP. O botão de exemplo gera uma arte geométrica local para experimentar.
4. Ajuste ampliação e posição e confira a imagem convertida.
5. Clique em **Validar e criar ROM** e depois em **Baixar ROM .bin**. O relatório JSON inclui hash, checksum e offsets alterados.

Como alternativa, Python 3 pode servir somente os arquivos da interface na própria máquina:

```sh
python3 personalizador-local/serve.py
```

Acesse `http://127.0.0.1:8765`. O servidor escuta apenas em loopback, não aceita uploads e não serve diretórios, ROMs ou resultados dos testes. `Ctrl+C` encerra.

## Compatibilidade e limites

| Item | Aceito |
|---|---|
| Baseline | Grid 2026 v3.3, binária, não intercalada, 2.097.152 bytes |
| Extensão | `.md`, `.bin` ou `.gen`, sempre validada pelo conteúdo |
| SHA-256 exato | `b840fcaa0851daf548c9c4c4dadf18d3cb78ebf9683fde897bb677b44a3ea872` |
| Imagem | PNG, JPEG ou WebP; até 20 MiB e 32 megapixels |
| Retrato final | 64 × 64 pixels, nove cores estáveis na paleta do Mega Drive |
| Alvo | Slot 11, retrato do próprio jogador com capacete; acompanha o jogador ao trocar equipe |

ROM original, outras revisões, `.smd`, arquivos compactados e ROMs já personalizadas são recusados. Para trocar a foto novamente, use a baseline preservada. Este protótipo não aplica automaticamente os mods de 2026 a uma ROM original.

Somente a paleta e os gráficos realocados desse retrato, seus dois ponteiros e o checksum podem mudar. Nomes, equipes, pinturas, desempenho e demais retratos são preservados byte a byte. A imagem terá a aparência limitada de 64 × 64 pixels; ela não é uma fotografia em alta resolução. A prévia usa RGB linear aproximado do hardware, sem simular todos os filtros ou monitores.

## Testes

Unitários, sem ROM ou dependências:

```sh
node --test personalizador-local/core.test.cjs
```

Fluxo Playwright, usando instalação local de Playwright/Chromium e sua ROM externa ao repositório. Inicie primeiro o servidor acima. Nenhum download de ROM é feito pelos testes:

```sh
TEST_ROM="/caminho/externo/sua-baseline.bin" node tests/browser.cjs
TEST_ROM="/caminho/externo/sua-baseline.bin" python3 tests/verify_output.py
```

Os testes criam um padrão sintético, validam o download e gravam evidências e ROMs de teste em `evidence/`, pasta excluída do Git e do servidor. Não reutilize os arquivos de teste como resultado da sua foto.

[Contrato técnico](docs/TECHNICAL.md) · [Validação e limites observados](docs/VALIDATION.md)

O projeto não concede direitos sobre o jogo, marcas, ROMs ou imagens fornecidas pelo usuário. Nenhuma licença de conteúdo de terceiros foi adicionada.
