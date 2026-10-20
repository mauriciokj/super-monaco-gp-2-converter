# Preparação de publicação e métricas

Esta preparação ainda não foi publicada. O fluxo solicitado continua sendo **ROM original + foto**, com a temporada 2026 completa. No protótipo privado esse fluxo funciona porque o pacote de dados está instalado localmente. O clone público não inclui esse pacote.

## Dados da temporada

O IPS completo não é um pacote apenas de instruções: contém retratos e arte. Estar ignorado pelo Git não autoriza servi-lo em um site. A análise técnica encontrou arte de seleção, mapa e miniaturas que podem ser reconstruídos no dispositivo com recursos da ROM original e regras dos mods. Essa reconstrução foi comparada byte a byte com a versão 2026 conhecida.

Onze retratos adicionais continuam necessários para preservar a mesma edição. Os metadados locais registram dez ilustrações geradas com referências e um PNG fornecido; não estabelecem autorização explícita para distribuição pública. Codificar esses pixels como diferenças ou referências curtas não remove o conteúdo nem comprova sua origem.

A interface preparada também permite um IPS verificado selecionado pelo próprio visitante, ou a entrada da ROM 2026 verificada. Essas alternativas alteram as entradas do fluxo e **não devem ser publicadas sem decisão explícita**. Nenhum patch é baixado ou enviado pelo aplicativo.

## Hospedagem existente

O Flow de Development usa Firebase Hosting e aceita uma URL externa na categoria Ferramenta. Os jogos Vibe Jogos usam Vercel. O conversor pode seguir esse caminho, com seus arquivos em uma pasta própria e registro por URL no portal, preservando os outros jogos.

O modo HTML `srcDoc` do portal limita downloads por sandbox. A integração externa também precisa testar o overlay de fallback do portal, que atualmente aparece após quatro segundos independentemente do carregamento do iframe. Não é necessário alterar outros jogos para abrir o conversor diretamente em uma aba própria.

## Pacote público sem dados privados

`prepare-public.py` copia somente uma lista fixa de fontes da interface para uma pasta vazia e separada. Remove o carregamento do sidecar privado, gera configuração de métricas e um manifesto de arquivos com hashes. Não copia ROM, IPS, foto, resultados de teste, bibliotecas instaladas, inventários ou credenciais.

Exemplo de preparação local, **não de deploy**:

```sh
python3 personalizador-local/prepare-public.py --out publication/review --canonical-url https://example.com/tools/smgp2/
```

O diretório resultante é uma variante que depende dos dados fornecidos pelo visitante. Prepará-lo não resolve a pendência do fluxo original + foto nem autoriza publicá-lo.

## Medição mínima

`analytics.js` fica inativo sem configuração explícita. Também fica inativo em HTTP, `file://`, outro domínio ou outro caminho. Na versão pública configurada pode registrar uma visualização da URL canônica, descartando query, fragmento e campos extras. Falhas do provedor não bloqueiam a conversão.

O hook local `smgp2:conversion-completed` é emitido somente após validação e criação dos downloads, sem detalhes da entrada. Repetir a geração da mesma revisão não repete o hook. O adaptador admite apenas o nome fixo `smgp2_conversion_completed`, sem propriedades. ROM, IPS, foto, nomes de arquivo, hashes do resultado e relatório não entram na telemetria.

`--metrics` prepara pageviews da Vercel. `--custom-events-confirmed` só deve ser usado após confirmar um plano Pro/Enterprise já existente; o plano da conta ainda não foi verificado. Não há contratação automática, contador público ou backend novo. O script entregue nos jogos existentes foi observado; isso não comprova números no painel do conversor ainda não publicado.

O aviso público diferencia processamento local de arquivos e envio de métricas. O provedor recebe metadados de rede e navegação para estatísticas; não se promete ausência absoluta de dados de rede. Como o script acrescenta atribuição e referrer depois do middleware, o adaptador bloqueia medição se houver atribuição salva de outro aplicativo, armazenamento inacessível ou referência diferente de vazio/das duas raízes públicas do Flow. Não limpa nem altera o armazenamento de outros jogos. Esses filtros subcontam o tráfego e devem ser considerados ao ler o painel. Visitantes estimados pela Vercel não representam pessoas únicas históricas. Um contador público acumulado exigiria persistência e controles adicionais.

Referências: [Web Analytics](https://vercel.com/docs/analytics), [eventos e planos](https://vercel.com/docs/analytics/custom-events), [privacidade](https://vercel.com/docs/analytics/privacy-policy), [filtragem de dados](https://vercel.com/docs/analytics/redacting-sensitive-data).

## Verificação

```sh
node --test personalizador-local/core.test.cjs personalizador-local/pipeline.test.cjs personalizador-local/app.test.cjs personalizador-local/analytics.test.cjs
python3 tests/public_package_test.py
```

`tests/browser.cjs` verifica o fluxo local com a ROM do responsável, imagens sintéticas e os dados privados já presentes. `tests/metrics-browser.cjs` verifica o adaptador com todas as requisições interceptadas, sem enviar eventos reais; exige uma cópia local do script público do provedor e uma pasta preparada de teste. Esses arquivos e ROMs de QA não entram no pacote público.
