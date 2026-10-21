---
title: Why the same beans taste sour, sweet or bitter
description: A scrollytelling explainer. The chart stays put while you scroll, and each step of the story changes it.
demo:
  - scrolly
tags:
  - demo
---

> [!info] Demo: scrollytelling
> Scroll slowly. The chart stays in place while the text moves past it, and whichever step sits in the middle of the screen decides what the chart shows. On a phone, the chart sits at the top and the steps slide over it.

Coffee from the same bag can taste sour on Monday and bitter on Tuesday. The reason isn't mysterious, and it fits in a single chart.

```scrolly
extraction
```

> [!step|intro] Brewing is dissolving
> Ground coffee is about 30% soluble. From the moment water touches it, flavour compounds start dissolving, and they don't all dissolve at the same speed.

> [!step|acids] Acids go first
> The bright, fruity acids are small and dissolve fast. In the first moments of a brew, they're most of what's in the water. Stop here and the cup tastes sharp and sour.

> [!step|sugars] Then the sweetness
> Sugars and browning compounds take longer. As they catch up, the cup gets rounder and sweeter, and the acidity starts to read as _bright_ rather than sour.

> [!step|bitter] Bitterness comes last
> The heavy, bitter compounds dissolve slowest of all. Given enough time, though, they keep coming, and eventually they dominate.

> [!step|zones] Three tastes, one timeline
> That gives every brew the same arc: **sour** if it stops too early, **sweet** in the middle, **bitter** if it runs too long. Baristas call the middle a balanced [[Extraction|extraction]].

> [!step|cup] Your cup is a point on that arc
> Brew for a fixed time and your cup lands somewhere on the line. With a medium grind and this brew time, it lands in the sweet zone.

> [!step|finer] Grind finer, and everything speeds up
> Finer grounds expose more surface, so every curve rises faster and the whole arc squeezes to the left. Same brew time, but the cup has slid into **bitter**. That's why a fine grind is the usual suspect behind [[Bitterness|bitter coffee]].

> [!step|coarser] Grind coarser, and everything slows down
> Coarser grounds stretch the arc out. The same brew time now stops early, in **sour**. That's why the fix for a sour cup is usually a finer grind, and the fix for a bitter cup a coarser one.

> [!step|cup] One dial, three tastes
> Nothing about the beans changed between these cups. [[Grind size]] moved the arc and the cup went from sour to sweet to bitter. Find the sweet spot once, and you can find it again.

## Why this works as a format

A chart that changes as you read lets each step add exactly one idea. You never have to hold a legend in your head, because the chart only ever shows what the sentence beside it is talking about.

> [!example]- How this page is written
> A fenced block names the figure, and the callouts after it are the steps. Each step's state goes after the `|`:
>
> ````md
> ```scrolly
> extraction
> ```
>
> > [!step|acids] Acids go first
> > The bright, fruity acids dissolve fast…
> ````
>
> The page opts in with `demo: [scrolly]`. The figure itself is a small script registered under that name.
