---
title: Your garden
description: A personal graph of the demo notes, sized and lit by your own visits. Frequent notes grow, recent ones glow, and forgotten ones fade.
demo:
  - memory-graph
tags:
  - demo
---

> [!info] Demo: personal graph
> This is the garden's graph, drawn for you. A note **grows** the more often you visit it, **glows** when you've been there recently, turns **grey** when you haven't been back in two weeks, and stays a **hollow** circle until you visit. A dashed **ring** means you've learned flashcards from it. Hover a note for details; click to go there.

```garden-graph

```

## How it works

Everything here comes from your own browser. Each time you open a page in the showcase, a small record is kept in this browser's local storage: how many times you've visited, and when you were last there. Nothing is sent anywhere, and **Forget me** erases it.

The layout is the same for everyone and the same on every visit, so a note always sits in the same spot. That makes the map learnable: after a while you know where _[[Extraction]]_ lives and what's around it. The [[your-path|path page]] uses the same map to draw the route you took.

> [!example]- How this page is written
> A fenced code block with the language `garden-graph` marks where the graph goes, and the page opts in with `demo: [memory-graph]` in its frontmatter.
