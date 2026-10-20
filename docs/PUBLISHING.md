# Publicação e métricas

O fluxo é **ROM original USA + foto → temporada Grid2026 v3.3 completa + retrato personalizado**. A versão atual inclui uma receita pública reduzida e os onze retratos adicionais cuja distribuição foi autorizada. O visitante não precisa fornecer IPS nem uma ROM pré-modificada.

## Conteúdo distribuído

`season-recipe.js` reconstrói no dispositivo 14.496 bytes de arte, mapas e miniaturas a partir da ROM escolhida. O restante usa regras próprias, preenchimento e referências a dados da original. `season-assets.js` contém exatamente os onze retratos autorizados, em 22 blocos de paleta/gráficos, totalizando 25.685 bytes. Não contém as fotografias de referência.

A proveniência registra os hashes, ranges e classificação dos 84 registros do patch de referência. A composição inteira foi comparada byte a byte com a edição 2026 conhecida, sem emitir ou distribuir essa ROM. O IPS completo e os arquivos privados não entram no pacote público. A autorização dos retratos não concede direitos sobre o jogo original ou sobre arquivos fornecidos por visitantes.

## Hospedagem

O Flow usa Firebase Hosting e aceita uma URL externa na categoria Ferramenta. Os jogos Vibe Jogos usam Vercel, com publicação automática da branch `main`. O conversor será servido em uma pasta própria, sem modificar arquivos dos outros jogos, e cadastrado por URL no Flow. O código canônico está no repositório Super Monaco GP 2 Converter; a pasta da hospedagem contém somente o pacote estático produzido a partir desse código.

A sessão existente do navegador foi confirmada e o plano exibido era **Hobby**. A tentativa de importar o repositório novo na interface da Vercel retornou falha de acesso. A integração Git já existente do Vibe Jogos permite publicar a pasta separada sem criar tokens nem ampliar permissões. Nenhuma assinatura foi alterada.

O modo HTML `srcDoc` do portal limita downloads por sandbox. A integração externa também deve considerar seu overlay de fallback, que aparece após quatro segundos. O botão existente para abrir em nova aba permite usar o conversor diretamente sem alterar o comportamento dos outros jogos.

## Pacote estático

`prepare-public.py` copia somente nove fontes revisados, incluindo os retratos autorizados, e gera configuração/manifesto: onze arquivos no total. Confere a proveniência dos recursos antes de escrever. Não copia ROMs, IPS completo, fotos de referência, testes, inventários, credenciais ou bibliotecas instaladas.

Exemplo de preparação, sem deploy:

```sh
python3 personalizador-local/prepare-public.py --out publication/review --canonical-url https://example.com/tools/smgp2/ --metrics
```

O `vercel.json` do repositório canônico também permite um projeto dedicado: framework Other, nenhuma instalação e build Python para `public-site`. Nesse modo `--vercel` usa somente variáveis de sistema de domínio/ambiente; produção falha fechada sem `VERCEL_PROJECT_PRODUCTION_URL`. Previews mantêm métricas desativadas.

## Medição mínima

`analytics.js` fica inativo sem configuração explícita, em HTTP, `file://`, outro domínio ou outro caminho. Na publicação configurada registra somente uma visualização da URL canônica, sem query/fragmento ou campos fornecidos pelo visitante. Falhas do provedor não bloqueiam a conversão.

O hook local `smgp2:conversion-completed` é emitido após validação e criação dos downloads, sem detalhes da entrada e sem duplicar a mesma revisão. Eventos personalizados exigem Pro/Enterprise e permanecem **desativados no Hobby**: o painel atual mede acessos/visitantes estimados, não conversões. Não há contratação automática, contador público ou backend novo.

ROM, foto, nome de arquivo, hash do resultado e relatório não entram na telemetria. O provedor recebe metadados de rede para estatísticas. Como acrescenta atribuição e referrer depois do middleware, o adaptador bloqueia medição se houver atribuição salva de outro aplicativo, armazenamento inacessível ou referência diferente de vazio/das raízes públicas do Flow. Não limpa armazenamento dos outros jogos. Esses filtros subcontam o tráfego; visitantes estimados não representam pessoas únicas históricas.

Referências: [Web Analytics](https://vercel.com/docs/analytics), [eventos e planos](https://vercel.com/docs/analytics/custom-events), [privacidade](https://vercel.com/docs/analytics/privacy-policy), [filtragem](https://vercel.com/docs/analytics/redacting-sensitive-data).

## Validação

35 testes Node, incluindo integração com a original/referência externas; sete testes Python de empacotamento; 18 verificações E2E tanto nos fontes quanto no pacote estático. O contrato de métricas foi testado com o script público real do provedor e todas as requisições interceptadas localmente, sem telemetria real. As evidências privadas e as ROMs sintéticas de QA não são distribuídas.
