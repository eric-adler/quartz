---
title: Morphing page transitions
description: Pages that morph into each other. A card's title flies into the next page's title, and the card grows into the article.
demo:
  - morph
tags:
  - demo
---

> [!info] Demo: morphing page transitions
> Click any card. Instead of the page swapping, the card **grows into the article** and its title **flies into place** as the new page's title. It uses the browser's View Transitions API around Quartz's own client-side navigation, so no page reload is involved. Browsers without the API, and readers who prefer reduced motion, get an ordinary page change.

```morph-gallery
demo/coffee/extraction
demo/coffee/espresso
demo/coffee/pour-over
demo/coffee/terroir
demo/coffee/cold-brew
demo/coffee/crema
demo/coffee/bloom
demo/coffee/processing-methods
demo/coffee/cupping
```

## How it works

When you click, the card and its title are each given a _view-transition name_. The browser takes a snapshot of the page, Quartz loads and swaps in the new page, and the new page's title and article receive the same names. The browser then animates between the two snapshots: elements that share a name morph from their old position and size to their new ones, and everything else crossfades.

Hovering a card also starts loading its page in the background, so by the time you click, the new page is usually already there and the morph starts at once.

> [!example]- How this page is written
> A fenced `morph-gallery` block with one note per line. The cards' titles, tags and excerpts come from Quartz's content index. The page opts in with `demo: [morph]`.
