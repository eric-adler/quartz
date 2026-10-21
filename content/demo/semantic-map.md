---
title: Semantic map
description: The garden arranged by meaning instead of by links, with suggestions for links that are missing.
demo:
  - semantic-map
tags:
  - demo
---

> [!info] Demo: semantic map
> Quartz's graph shows how notes are _linked_. This map shows how they're _related in meaning_: notes that talk about similar things sit close together, whether or not they link to each other. Hover a note to see its closest neighbours in meaning, toggle **Show the actual links** to compare the two, and look below the map for pairs that probably should link but don't.

```semantic-map

```

## How it's computed

The map is calculated when the site is built, from the notes' own words, without any AI model or outside service:

1. Each note becomes a list of word weights (TF-IDF): words that are frequent in this note but rare across the garden count most.
2. _Latent semantic analysis_ compresses those lists into a handful of underlying themes, so two notes can be close because they use related vocabulary, not only identical words.
3. _t-SNE_ lays the notes out in two dimensions so that close notes stay close, and _k-means_ groups them into the coloured regions, labelled with each group's most characteristic words.

Because it only reads the words, it's honest about what it knows: notes that discuss the same idea in different language can still end up apart. Swapping in neural embeddings later would sharpen it without changing the page.

> [!example]- How this page is written
> A fenced `semantic-map` block marks where the map goes, and the page opts in with `demo: [semantic-map]`. The data is written to `static/showcase/semantic-map.json` at build time by the `showcase-assets` plugin.
