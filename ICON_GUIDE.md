# Guia de criação dos ícones do Marketplace

Este arquivo define o padrão visual e técnico dos ícones usados pelo `marketplace-plugins`.

A ideia é simples: quando um novo plugin entrar no catálogo, o ícone precisa parecer parte da mesma família dos demais. Não basta ser "bonito" isoladamente. Ele precisa funcionar lado a lado com dezenas de outros ícones, continuar legível em tamanho pequeno e não trazer fundo branco, bordas cortadas ou estilos completamente diferentes.

## Onde salvar

Cada plugin possui uma pasta própria usando exatamente o componente Moodle:

```text
icon/[component]/icon.png
```

Exemplos:

```text
icon/mod_videoquiz/icon.png
icon/local_personalxp/icon.png
icon/tool_moodledoctor/icon.png
icon/theme_oabflix/icon.png
```

O nome da pasta deve ser exatamente o valor do componente, normalmente o mesmo de `$plugin->component`.

Não use o nome do repositório como pasta. Por exemplo:

```text
moodle-mod_videoquiz       -> errado
mod_videoquiz              -> correto
```

O arquivo deve sempre se chamar:

```text
icon.png
```

## Formato técnico

O formato final é PNG.

Não usar:

- JPG;
- JPEG;
- SVG;
- WebP;
- GIF.

O endpoint de ícones do projeto trabalha exclusivamente com PNG e gera as miniaturas automaticamente.

O arquivo deve ser quadrado, preferencialmente criado em alta resolução. Como referência prática:

```text
1024 x 1024 px
```

Também é aceitável gerar acima disso e depois manter o resultado quadrado. O sistema gera versões menores automaticamente, usando 128 px como tamanho padrão e aceitando até 1024 px.

Não criar manualmente versões como:

```text
icon-128.png
icon-256.png
icon-512.png
```

Apenas `icon.png` é necessário.

## Fundo transparente

O PNG final precisa possuir transparência.

Isso não significa que o desenho interno do ícone deve ser transparente. O padrão visual usa um grande quadrado arredondado azul como base do ícone.

A transparência deve existir fora desse quadrado arredondado, principalmente nos quatro cantos.

Em outras palavras:

- a base azul do ícone é opaca;
- os cantos externos ao quadrado arredondado são transparentes;
- não deve existir um quadrado branco por trás do ícone;
- não deve existir um fundo cinza, preto ou xadrez gravado dentro do PNG.

Um erro comum em imagens geradas por IA é receber uma imagem quadrada com fundo branco e o ícone azul dentro dela. Esse branco precisa ser removido antes de usar o arquivo.

O repositório possui o utilitário:

```text
icon/remove-fundo-branco.php
```

Ele remove o branco ou quase branco conectado às bordas, transforma essa área em transparência e recorta a borda transparente, mantendo o resultado quadrado.

Uso:

```bash
php icon/remove-fundo-branco.php
```

Atenção: o script procura e processa os arquivos `icon/*/icon.png`, portanto deve ser usado sabendo que ele trabalha em todos os ícones encontrados.

## Base azul e borda externa

Todos os novos ícones devem manter a mesma identidade visual.

A base é um grande quadrado com cantos bastante arredondados, preenchido por um gradiente azul.

O fundo normalmente deve variar entre:

- azul-ciano mais claro na região superior;
- azul vivo na região central;
- azul royal ou azul profundo nas áreas inferiores.

Pode haver curvas, ondas e variações discretas de luminosidade no próprio fundo para dar profundidade.

O ponto mais importante é a borda.

O quadrado azul não deve terminar como uma forma plana. Ele precisa possuir uma borda externa visível, com aparência de relevo, usando normalmente azul-ciano claro nas áreas iluminadas e azul mais escuro nas áreas de sombra.

A borda deve lembrar um objeto 3D polido:

- bevel suave;
- brilho na parte superior;
- sombra discreta na parte inferior;
- rim azul/ciano claramente perceptível;
- cantos arredondados contínuos.

Evite gerar uma simples caixa azul chapada. Quando os ícones são colocados lado a lado, a ausência dessa borda fica muito evidente.

## Margens

Existem duas margens diferentes que precisam ser consideradas.

### Margem externa

Depois que o fundo branco for removido, o quadrado azul pode praticamente ocupar todo o canvas.

A borda arredondada deve chegar próxima aos limites da imagem, mas sem ser cortada.

O ideal é não manter uma grande moldura transparente em volta do ícone. O script `remove-fundo-branco.php` já recorta a transparência excedente.

### Área segura interna

Os objetos que representam a funcionalidade do plugin não devem encostar na borda azul.

Como regra prática, mantenha os elementos principais dentro de aproximadamente 80% a 84% da área útil.

Isso significa uma margem visual interna de aproximadamente 8% a 10% em cada lado.

Elementos decorativos como:

- setas;
- círculos;
- pequenos badges;
- pontos de conexão;

podem se aproximar mais da borda, mas não devem parecer cortados.

Se alguma parte essencial do desenho desaparecer quando o ícone for reduzido para 128 x 128 px, a composição está detalhada demais ou está usando margens ruins.

## Estilo visual

O padrão atual usa uma estética 3D moderna, próxima de ícones de aplicativos macOS/iOS, mas sem copiar ícones de terceiros.

Características desejadas:

- formas arredondadas;
- peças com volume;
- molduras brancas;
- painéis internos azul-escuro quando fizer sentido;
- sombras suaves;
- reflexos e highlights;
- gradientes;
- bordas com bevel;
- pequenas áreas de glow quando ajudam a leitura;
- materiais semelhantes a plástico, vidro ou UI 3D.

A iluminação deve parecer consistente. Normalmente funciona melhor imaginar a luz vindo da região superior esquerda.

Objetos brancos não devem ser branco puro e chapado em toda a superfície. Use pequenas variações de cinza muito claro ou azul muito claro para mostrar volume.

## Cores

A base azul é o elemento que mantém a família visual.

As outras cores podem variar de acordo com a função do plugin.

Cores de destaque usadas com frequência:

- verde para sucesso, conclusão e validação;
- ciano para conexão, progresso e tecnologia;
- amarelo ou laranja para alertas, tempo e destaques;
- vermelho para gravação, problema ou ponto crítico;
- roxo para IA, ferramentas ou elementos secundários;
- branco para play, check, documentos, molduras e símbolos principais.

Evite transformar o fundo inteiro em outra cor. A identidade do conjunto depende principalmente da base azul.

## Composição

O ícone precisa explicar o plugin sem depender do nome.

Prefira um conceito principal e poucos elementos complementares.

Um bom padrão é:

```text
1 elemento principal
+
1 a 3 elementos secundários
```

Exemplos:

- vídeo + gráfico;
- documento + check;
- pergunta + progresso;
- webcam + escudo;
- calendário + alerta;
- servidor + conexões;
- certificado + renovação.

Não transforme o ícone em uma screenshot em miniatura.

Se forem necessários oito elementos minúsculos para explicar a função, provavelmente o conceito ainda não está bom.

## Texto dentro do ícone

Não colocar textos, nomes de plugins, frases, números ou siglas.

Evitar principalmente:

```text
Moodle
AI
MCP
PRO
MAX
XP
100%
```

O desenho precisa funcionar sem leitura textual.

Símbolos universais são permitidos, por exemplo:

- play;
- check;
- coração;
- estrela;
- relógio;
- calendário;
- escudo;
- cadeado;
- gráfico;
- setas;
- cursor;
- câmera;
- documento;
- banco de dados;
- nuvem.

## Logos

Evite logos de terceiros.

O objetivo é representar a função do plugin, não transformar o ícone em uma colagem de marcas.

Se o plugin integra algum serviço específico, prefira representar a ideia de integração usando elementos genéricos, a menos que exista uma razão explícita para utilizar a marca oficial.

## Criação com IA

Ao gerar um novo ícone com IA, use alguns ícones existentes como referência visual.

Não basta dizer "crie um ícone azul". A geração deve receber referências da família atual para manter:

- o mesmo tipo de quadrado arredondado;
- a borda externa;
- o gradiente azul;
- o estilo 3D;
- as sombras;
- a proporção dos elementos;
- o nível de detalhe.

É recomendável usar entre 2 e 4 ícones existentes como referência.

O prompt deve explicar primeiro o padrão visual e depois a função específica do plugin.

### Prompt base

Use algo próximo deste modelo:

```text
Create a polished 3D app-style icon matching the provided reference icon family.

The icon must use a large rounded-square blue gradient base with a clearly visible glossy beveled cyan/blue outer rim. Keep the same modern macOS/iOS-like 3D style, soft shadows, smooth highlights, white UI elements and clean high-contrast composition.

The outer area around the rounded blue square must be transparent in the final PNG. Do not create a permanent white background.

Keep all important objects inside a safe margin so nothing is cropped. The icon must remain readable when reduced to 128x128 pixels.

Represent this plugin using:
[DESCREVER AQUI O CONCEITO PRINCIPAL DO PLUGIN]

Use one strong central concept and only a few secondary objects. No text, no letters, no numbers and no third-party logos.

Square 1:1 composition.
```

Depois substitua:

```text
[DESCREVER AQUI O CONCEITO PRINCIPAL DO PLUGIN]
```

por uma descrição curta da funcionalidade.

Exemplo:

```text
a video player with a calendar, reminder bell and compliance checklist
```

ou:

```text
a document with writing activity indicators, user profile and authorship evidence
```

## Escolha do conceito antes de gerar

Antes de criar a imagem, leia o README ou a descrição do plugin.

Não deduza a função apenas pelo nome do repositório.

Tente responder em uma frase:

> Qual problema esse plugin resolve?

Depois transforme essa resposta em símbolos visuais.

Por exemplo, um plugin de recertificação não é simplesmente "um certificado". Ele pode ser melhor representado por:

```text
certificado + setas de renovação + histórico
```

Isso comunica muito melhor a funcionalidade.

## Pós-processamento

Depois da geração:

1. confirme que o arquivo está quadrado;
2. salve como PNG;
3. remova qualquer fundo branco externo;
4. preserve o alpha;
5. confirme que a borda azul não foi cortada;
6. confirme que os cantos externos estão transparentes;
7. verifique se o conteúdo principal possui margem interna;
8. teste visualmente reduzindo para 128 x 128 px;
9. salve no caminho `icon/[component]/icon.png`.

Se a geração vier com uma grande área branca externa, coloque o arquivo no caminho correto e use:

```bash
php icon/remove-fundo-branco.php
```

O script remove somente a área branca conectada às bordas, justamente para evitar destruir detalhes brancos internos do desenho.

## Validação rápida

Antes de fazer commit, confira:

- [ ] arquivo chamado exatamente `icon.png`;
- [ ] pasta chamada exatamente com o componente Moodle;
- [ ] PNG;
- [ ] imagem quadrada;
- [ ] canal alpha presente;
- [ ] sem fundo branco externo;
- [ ] cantos externos transparentes;
- [ ] base azul arredondada;
- [ ] borda azul/ciano em relevo visível;
- [ ] nenhum elemento importante cortado;
- [ ] símbolo principal legível em 128 x 128 px;
- [ ] sem texto desnecessário;
- [ ] sem logo de terceiros sem motivo;
- [ ] composição coerente com a função real do plugin;
- [ ] aparência consistente com os demais ícones do catálogo.

## O que evitar

Evite principalmente:

- quadrado azul sem borda;
- fundo branco sólido;
- fundo transparente por trás de todos os elementos sem a base azul;
- bordas do ícone cortadas;
- elementos chegando até o limite do canvas;
- textos pequenos;
- excesso de objetos;
- aparência de screenshot;
- ícone flat quando todo o restante está em 3D;
- iluminação incompatível;
- logos aleatórios;
- detalhes que desaparecem em 128 px;
- imagem retangular;
- formatos diferentes de PNG.

## Regra principal

Quando houver dúvida entre adicionar mais detalhes e simplificar, simplifique.

O ícone precisa ser reconhecido em poucos segundos e continuar fazendo sentido quando exibido pequeno. A identidade vem primeiro da base azul arredondada com sua borda 3D e, depois, de um símbolo central claro que represente a função do plugin.
