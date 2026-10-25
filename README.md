# nugo

Générateur de site statique extensible, inspiré de Hugo et Eleventy. Écrit en TypeScript, il utilise unified/remark pour le Markdown et Handlebars pour les gabarits.

Le moteur ne fournit **aucun gabarit, aucun style, aucun libellé et aucune locale** : tout cela appartient au site. Le moteur lit le contenu, le valide, rend le Markdown, exécute les gabarits du site et écrit les fichiers. Le site décrit ses collections, ses routes et ses extensions dans `nugo.config.ts`.

## Installation

Il faut Node 26 ou plus récent. Le site écrit sa configuration en TypeScript, que Node exécute directement grâce au type stripping, sans tsx ni bundler.

```sh
npm install git+https://github.com/sugatasei/nugo.git   # dist/ est versionné : rien à compiler
npx nugo build                                          # génère le site dans build/
npx nugo dev --port 3000                                # build + serveur + rebuild et rechargement à chaque modification
```

En mode dev, `site.url` est remplacé par `http://localhost:<port>` : URL canoniques, balises de partage, RSS, sitemap et security.txt pointent sur le serveur local. `nugo build` garde l'URL de la config, sauf si `--url` est passé (utile pour une préproduction : `npx nugo build --url https://preprod.example.org`).

Dans un helper, l'URL effective se lit dans le contexte de la page avec `options.data.root.site.url` (type `HelperOptions`), pas dans une constante de la config.

Pour développer le moteur et un site en parallèle, utiliser `"nugo": "file:../nugo"`. Le dossier [example/](example/) fonctionne ainsi.

## Arborescence d'un site

```
nugo.config.ts    déclaration du site (obligatoire)
content/          Markdown + front matter YAML, rangés par collection
public/           copié tel quel dans build/
templates/        gabarits Handlebars ; templates/partials/** est enregistré automatiquement
build/            sortie (vidée à chaque build)
```

Ces dossiers se changent avec `nugo.dirs({ content, public, templates, output })`.

## Configuration

```ts
import { defineConfig, paginate, taxonomy, z } from "nugo";
import { rss, sitemap } from "nugo/plugins";

export default defineConfig((nugo) => {
    nugo.site({ url: "https://example.org", title: "Mon site", lang: "fr" }); // objet libre, `url` obligatoire
    nugo.layout("layouts/base");                                             // layout par défaut (false = aucun)

    nugo.collection("posts", {
        dir: "blog",                                   // content/blog/**.md
        schema: z.object({ title: z.string(), date: z.iso.date() }).loose(),
        template: "pages/article",                     // sans template : données seulement, pas de page
        permalink: (entry) => `/blog/${entry.slug}/`,  // défaut : /<dir>/<slug>/
        sort: (a, b) => b.data.date.localeCompare(a.data.date),
        assetFields: ["cover"],                        // chemins résolus en URL (fichier voisin ou public/)
    });

    nugo.pages((context) => [
        ...paginate(context.collection("posts"), 10, (n) => n === 1 ? "/" : `/page/${n}/`)
            .map((pagination) => ({ url: pagination.url, template: "pages/index", data: { pagination } })),
        { url: "/404.html", template: "pages/not-found", noindex: true },
    ]);

    nugo.use(rss({ collection: "posts", language: "fr" })).use(sitemap());
});
```

### API `nugo`

| Méthode | Rôle |
|---|---|
| `site(data)` | Données globales, exposées en `site` aux gabarits. `url` est obligatoire. |
| `dirs({...})` | Change les dossiers `content`, `public`, `templates` et `output`. |
| `layout(name \| false)` | Layout par défaut, appliqué autour de chaque page. |
| `frontMatter([open, close])` | Délimiteurs du front matter YAML. Défaut : `["---", "---"]`. `["<!--", "-->"]` cache le front matter dans les aperçus Markdown. |
| `collection(name, options)` | Les fichiers sous `content/<dir>/` forment une collection. Le dossier le plus spécifique gagne. Un `.md` hors de toute collection fait échouer le build. |
| `pages(factory)` | Pages générées (accueil, archives, tags, 404…). `factory(context)` renvoie des `{ url, template, layout?, data?, noindex?, lastModified? }`. |
| `output(path, factory)` | Fichier brut (XML, JSON, txt…) produit à partir du contexte de build. |
| `markdown({ gfm, html, headingIds })` | GFM est activé par défaut. Le HTML écrit par l'auteur est retiré par défaut. Chaque titre reçoit un `id` par défaut (`## Premiers pas` → `id="premiers-pas"`, suffixe `-1`, `-2`… en cas de doublon). |
| `remark(plugin)` / `rehype(plugin)` | Ajoute un plugin unified, éventuellement sous la forme `[plugin, options]`. |
| `helper(name, fn)` / `partial(name, source)` | Helpers et partials Handlebars. |
| `passthrough(from, to?)` | Copie un fichier ou un dossier (ex. un CSS de `node_modules`) dans la sortie. |
| `on("beforeBuild" \| "afterBuild", hook)` | Hooks asynchrones qui reçoivent le contexte de build. |
| `use(plugin)` | Applique un plugin `(nugo) => void`, qui a accès à toute cette API. |

Une URL qui se termine par `/` donne `index.html`. Sinon, elle donne le fichier nommé, par exemple `/404.html`. Les segments encodés (`/tags/c%23/`) sont décodés pour le disque. Une sortie produite deux fois fait échouer le build.

### Contexte de build

`pages()`, `output()` et les hooks reçoivent un objet `context` :

- `root`, `dirs`, `site` ;
- `entries` : toutes les entrées ;
- `collection(name)` : les entrées d'une collection, déjà triées ;
- `pages` : les pages déjà écrites ;
- `render(template, data)` : rend un gabarit du site, sans layout ;
- `absoluteUrl(path)`.

Une entrée (`Entry`) contient :

- `collection`, `src`, `slug`, `url` ;
- `data` : le front matter validé ;
- `html` ;
- `text` : le texte brut du corps, extrait de l'arbre Markdown après passage des plugins (utilisé par la recherche) ;
- `sections` : ce texte découpé aux titres, `{ anchor?, heading?, text }[]`, utilisable par exemple pour une table des matières ;
- `meta` : le `file.data` laissé par les plugins remark/rehype ;
- `updatedAt` ;
- `noindex`.

### Helpers exportés

À utiliser dans `pages()` :

- `paginate(items, size, url)`
- `groupBy(items, key)`
- `groupByDate(entries, "year" | "month" | "day", field?)`
- `taxonomy(entries, field?, { locale })` : regroupe les libellés qui ont le même slug
- `latestUpdate(entries)`
- `slugify(value, { locale })`
- `absoluteUrl`, `escapeXml`, `safeJson`

## Contrat des gabarits

Chaque page reçoit :

- `site` ;
- `page` (`{ url, noindex }`) ;
- `collections` ;
- le `data` de la page.

Pour une page d'entrée, `data` contient le front matter (accessible directement, comme `{{title}}`) et `entry`, d'où `{{{entry.html}}}`. Le layout reçoit le même contexte, plus `content`.

Le moteur n'enregistre que deux helpers, purement techniques :

- `{{json value}}` : JSON sûr dans un `<script>` ;
- `{{absoluteUrl path}}`.

## Plugins fournis (`nugo/plugins`)

Aucun de ces plugins ne produit de HTML de présentation : seul `images` transforme le rendu du Markdown (`<img>` → `<picture>`).

| Plugin | Sortie |
|---|---|
| `rss({ collection, language?, limit?, date?, … })` | `feed.xml` (RSS 2.0) |
| `sitemap()` | `sitemap.xml`, sans les pages `noindex` |
| `robots({ rules?, sitemap? })` | `robots.txt` |
| `securityTxt({ contact, preferredLanguages? })` | `.well-known/security.txt` |
| `search({ language, collections?, sections?, meta?, filters?, sort? })` | Index [Pagefind](https://pagefind.app) et son interface dans `pagefind/` |
| `frenchSpacing()` | Rend insécables les espaces de la typographie française (fine avant `; ! ? »`, normale avant `:` et après `«`), dans le texte Markdown seulement. |
| `images({ widths?, sizes?, quality?, helper?, cropHelper?, crop?, cacheDir? })` | Variantes WebP + JPEG des images locales, `<picture>` dans le Markdown, helpers `image` et `imageCrop` pour les gabarits (voir [Images](#images)). |
| `minify({ exclude? })` | Minifie avec esbuild les `.js`, `.mjs` et `.css` de la sortie, en fin de build (fichiers `*.min.*` et `exclude`, par défaut `["/pagefind/"]`, laissés intacts). |
| `fingerprint({ extensions?, length? })` | Ajoute `?v=<empreinte du contenu>` aux URL locales (`src`, `href`) des `.js`, `.mjs` et `.css` dans les pages HTML, pour qu'un cache (navigateur, CDN) ne serve pas une ancienne version. À déclarer après `minify()`. |
| `noH1()` | Fait échouer le build si le corps d'un article contient un `#` (quand le gabarit affiche déjà le titre). |

## Étendre le moteur : un exemple

[example/plugins/callouts.ts](example/plugins/callouts.ts) ajoute les encadrés de style GitHub (`> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`). Ce plugin appartient au site, pas au moteur, et c'est aussi le site qui fournit les libellés :

```ts
export function callouts(options: CalloutsOptions): NugoPlugin {
    return (nugo) => {
        nugo.remark([remarkCallouts, options]); // blockquote → <article class="callout callout-note"><header>Note</header>…
    };
}

nugo.use(callouts({ labels: { note: "Note", tip: "Astuce", warning: "Attention" } }));
```

Un plugin remark peut aussi :

- produire des nœuds `html`, qui ne sont jamais filtrés (seul le HTML écrit par l'auteur dépend de `markdown({ html })`) ;
- rendre un partial du site via `context.render()`, capturé dans un hook `beforeBuild` ;
- laisser des données dans `file.data`, que les gabarits lisent dans `entry.meta`.

## Recherche

Le plugin `search` construit un index [Pagefind](https://pagefind.app) à partir des **entrées**, sans relire le HTML généré :

- **Texte :** celui des entrées, extrait de l'arbre Markdown après passage des plugins remark.
- **Un résultat par section :** chaque section (le texte entre deux titres) est un enregistrement, dont l'URL pointe sur l'ancre du titre (`/blog/…/#premiers-pas`). Par défaut, son titre est « Titre de l'entrée › Titre de la section ». `meta(entry, section)` permet de le changer, et `sections: false` revient à un résultat par entrée. Un mot présent dans plusieurs sections donne donc plusieurs résultats pour la même entrée.
- **Métadonnées, filtres et tri :** ils viennent du front matter. Par défaut, `meta` vaut `{ title }` et `sort` vaut `{ date }`. `filters` est vide par défaut et se configure par site, par exemple `(entry) => ({ tag: entry.data.tags })`.
- **Entrées indexées :** seules celles qui ont une page sont indexées, sauf celles en `noindex`. L'option `collections` restreint la liste.
- **Gabarits :** ils n'ont besoin d'aucun attribut `data-pagefind-*`.
- **Interface :** Pagefind écrit `pagefind/pagefind-ui.js` et `pagefind-ui.css`. Le site les charge et instancie `new PagefindUI({ element: "#search" })`.

Le HTML brut ne compte pas dans le texte. Un plugin qui produit des nœuds `html` peut fournir leur équivalent textuel avec `data.searchText` :

```ts
parent.children.splice(index, 1, { type: "html", value: rendered, data: { searchText: label } });
```

## Images

Le plugin `images` génère, au build, des variantes de chaque image **hébergée par le site** (fichier voisin d'un `index.md` ou de `public/`) :

- **Largeurs :** `widths` (par défaut `[480, 800, 1200, 1600]`), jamais plus large que l'original. Une image plus étroite que toutes les largeurs garde sa taille.
- **Formats :** WebP, avec un repli JPEG (PNG si l'image a de la transparence). Fichiers écrits à côté de l'original : `photo-800w.webp`, `photo-800w.jpg`. L'original reste copié.
- **Markdown :** chaque `<img>` local devient un `<picture>` (`srcset`, `sizes` de l'option, `width`/`height`, `loading="lazy"`).
- **Gabarits :** le helper `image` donne les données, le site écrit son HTML :

```hbs
{{#with (image cover)}}
<picture>
    {{#each sources}}<source type="{{type}}" srcset="{{srcset}}" sizes="100vw">{{/each}}
    <img src="{{src}}" srcset="{{srcset}}" sizes="100vw" width="{{width}}" height="{{height}}" alt="">
</picture>
{{/with}}
```

- **Image de partage :** `imageCrop url largeur hauteur` donne une image JPEG recadrée au ratio demandé (zone gardée : option `crop.position`, `"attention"` par défaut), réduite si elle est plus grande, jamais agrandie. Pour Open Graph :

```hbs
{{#with (imageCrop cover 1200 630)}}
<meta property="og:image" content="{{absoluteUrl src}}">
<meta property="og:image:width" content="{{width}}">
<meta property="og:image:height" content="{{height}}">
{{/with}}
```

- **Laissées intactes :** les images externes (`https:`, `//…`, `data:`), introuvables, SVG et GIF. Le helper retourne alors `undefined` (branche `{{else}}`).
- **Cache :** les encodages sont gardés dans `.nugo-cache/images` à la racine du site (option `cacheDir`), sous une clé tirée du contenu de l'image et des réglages : un rebuild ne réencode que les images nouvelles ou modifiées, et retire du cache celles qui ne servent plus. Les variantes de la sortie sont des liens physiques vers le cache : leur contenu n'est stocké qu'une fois sur le disque, même avec plusieurs dossiers de build (copie si le cache est sur un autre disque). Un hook ne doit donc pas modifier ces fichiers en place. Le dossier est hors de `node_modules` pour survivre à un `npm ci` ; l'ajouter au `.gitignore` du site.

## Site d'exemple

[example/](example/) montre un blog complet construit avec les primitives du moteur :

- accueil paginé ;
- archives par année, mois et jour, avec navigation entre les mois ;
- tags, 404, RSS, sitemap, robots.txt, security.txt ;
- balises Open Graph et Twitter, JSON-LD `WebSite` et `BlogPosting` (`templates/partials/seo.hbs`) ;
- covers co-localisées, en `<picture>` via le plugin `images` (`templates/partials/picture.hbs`).

Le style vient de [Pico CSS](https://picocss.com), copié depuis `node_modules` avec `passthrough`. `public/site.css` ne contient que quelques ajouts.

La recherche utilise le plugin `search` : l'interface Pagefind s'ouvre dans une boîte de dialogue (`public/search.js`), avec un filtre par tag.

## Développement du moteur

```sh
npm install
npm run build      # recompile dist/, à committer avec src/ (un test le vérifie)
npm run typecheck
npm test           # node --test, sans dépendance de test
cd example && npm install && npx nugo build
```
