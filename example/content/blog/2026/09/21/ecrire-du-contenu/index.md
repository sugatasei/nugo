---
title: Écrire du contenu
date: 2026-09-21
cover: paysage.jpg
summary: Front matter, Markdown GFM et encadrés ajoutés par un plugin du site.
tags:
  - Nugo
  - markdown
---

Le front matter est validé par le schéma Zod de la collection : un article sans `date` fait échouer le build.

> [!TIP]
> Les encadrés viennent de `plugins/callouts.ts`, un plugin remark propre à ce site.

> [!WARNING]
> Les titres de niveau 1 sont refusés dans le corps : le gabarit affiche déjà le titre.

| Syntaxe | Rendu |
| --- | --- |
| `**gras**` | **gras** |
| `~~barré~~` | ~~barré~~ |

> Une citation sans marqueur reste une citation.

## Images

Une image locale devient un `<picture>` : plusieurs largeurs en WebP, avec un repli JPEG. Une image externe reste telle quelle.

![Paysage stylisé au coucher du soleil](paysage.jpg)
