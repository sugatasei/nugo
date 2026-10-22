# nugo — moteur de site statique

Contexte persistant du projet, à tenir à jour à chaque étape terminée.

## Objectif

Moteur de site statique distribué comme dépendance git (`git+https://github.com/sugatasei/nugo.git`, compilé par `prepare`). Il est consommé par un site qui fournit `nugo.config.ts`, ses gabarits, ses styles et ses extensions.

Règle centrale : **le moteur ne contient ni gabarit, ni CSS, ni libellé, ni locale codée en dur.** Toute présentation (HTML, textes, formats de date, routes d'archives et de tags) vit dans le site. Les plugins fournis (`src/plugins`) ne produisent que des fichiers techniques : RSS, sitemap, robots, security.txt, index de recherche Pagefind.

## Structure

- `src/cli.ts` : `nugo build`, `nugo dev`.
- `src/index.ts` : API publique (`defineConfig`, `z`, helpers, types).
- `src/plugins/index.ts` : export `nugo/plugins`.
- `src/types.ts` : contrat public (`Nugo`, `Entry`, `CollectionOptions`, `PageSpec`, `BuildContext`…).
- `src/config/` :
  - `ConfigBuilder` implémente l'objet `nugo` passé à la config ;
  - `ConfigLoader` importe `nugo.config.ts|js`.
- `src/content/` :
  - `FrontMatter` remplace le front matter par des lignes vides pour garder des numéros de ligne exacts ;
  - `ContentScanner` affecte chaque fichier à une collection (dossier le plus spécifique), le valide avec Zod, calcule le permalink, résout `assetFields` et rend le Markdown ;
  - `AssetResolver`.
- `src/markdown/MarkdownRenderer.ts` :
  - pipeline unified : remark-parse, GFM, retrait du HTML de l'auteur, plugins du site, remark-rehype, plugins rehype, stringify ;
  - `file.data` est exposé en `entry.meta`.
- `src/templates/TemplateRenderer.ts` :
  - une instance Handlebars isolée par build ;
  - les partials sont chargés depuis `templates/partials/**` ;
  - helpers techniques `json` et `absoluteUrl`.
- `src/build/` :
  - `Builder` : vide la sortie, copie `public/` et les passthrough, lance `beforeBuild`, scanne, rend les pages de collection, les `pages()` puis les `output()`, copie les fichiers voisins des `index.md`, lance `afterBuild` ;
  - `OutputWriter` : URL → fichier, détection des collisions ;
  - `FileSystem`.
- `src/markdown/MarkdownText.ts` : texte brut de l'arbre mdast (`entry.text`). Le HTML brut est ignoré, et `data.searchText` remplace le contenu d'un nœud. Expose aussi les types `hName` / `hProperties` (`mdast-util-to-hast`).
- `src/markdown/HeadingIds.ts` : `id` des titres calculé dans l'arbre mdast (`slugify`, dédoublonné), après les plugins du site. Le même id sert au HTML et à `entry.sections`.
- `src/plugins/search.ts` : index Pagefind via `addCustomRecord` (texte Markdown + front matter), un enregistrement par section (`url#ancre`), écrit dans `afterBuild`.
- `src/helpers/` : `paginate`, `groupBy`, `groupByDate`, `taxonomy`, `latestUpdate`, `slugify`, `absoluteUrl`, `escapeXml`, `safeJson`.
- `src/dev/DevServer.ts` :
  - serveur `node:http` ;
  - `fs.watch` récursif ;
  - chaque rebuild tourne dans un **processus enfant**, pour que la config et les plugins du site soient relus ;
  - livereload par SSE (`/__nugo/reload`).
- `test/` : `node --test` sur les `.ts` (type stripping), avec un test du plugin d'encadrés de l'exemple.
- `example/` : site de démonstration générique (`"nugo": "file:.."`) qui montre un blog complet.
  - Style : Pico CSS, copié par `passthrough`.
  - Recherche : plugin `search` (Pagefind), interface ouverte dans une boîte de dialogue (`public/search.js`).
  - Plugin d'encadrés `> [!NOTE]` dans `example/plugins/callouts.ts`.

## Conventions

- TypeScript strict, ESM.
  - Imports relatifs en `.ts`, réécrits en `.js` par `tsc` (`rewriteRelativeImportExtensions`).
  - `erasableSyntaxOnly` : pas d'enum ni de propriétés de paramètre de constructeur.
- Classes utilitaires statiques en interne, fonctions pures pour les helpers publics.
- Aucun état statique : le serveur de dev reconstruit le site plusieurs fois.
- DTO `readonly`, `Error` natif avec le chemin du fichier fautif, commentaires d'une ligne en français.
- Messages d'erreur en anglais. Aucun texte destiné aux pages.

## Pistes

- Build incrémental (manifeste).
- Front matter `layout` / `template` par entrée, si le besoin apparaît.
