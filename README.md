# 0w0 UwU -_o

NexusToons e Pluma Comics preparados para instalação no Nyxovira.

## Recursos

- Busca instantânea por nome, domínio ou categoria
- Filtros por idioma e tipo de obra
- Layout responsivo para celular e desktop
- Instalação direta ao abrir o catálogo em Sites externos no Nyxovira
- Publicável diretamente no GitHub Pages

## Executar localmente

Abra `index.html` no navegador ou sirva a pasta com qualquer servidor HTTP estático.

## Atualizar o catálogo

Edite a constante `plugins` no início de `app.js` e mantenha `catalog.json` sincronizado. Os manifestos e scripts instaláveis ficam em `plugins/`.

O botão **Instalar** usa a ponte fornecida pelo Nyxovira. Em um navegador comum, a página apenas orienta o usuário a abri-la pelo app; não exibe nem importa o catálogo manualmente.
