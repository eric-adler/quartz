---
title: Hover lab
description: Twenty-five shader effects on link hovers, each drawn live in WebGL from the link's own text.
demo:
  - hover-lab
tags:
  - demo
---

> [!info] Demo: hover lab
> Hover any word. Each one is a real link, and each runs its own shader, drawn live from the link's own text: the word is rasterised where it sits, with distance fields for the effects that need shape, and handed to one shared WebGL canvas while you hover. At rest every effect renders the plain text, so you can't see the hand-over. On a phone, tap once to play an effect and tap again to follow the link.

```hoverlab
ripple | Extraction | demo/coffee/extraction
smear | Espresso | demo/coffee/espresso
melt | Pour-over | demo/coffee/pour-over
ink | Terroir | demo/coffee/terroir
dither | Roast | demo/coffee/roast-level
halftone | Crema | demo/coffee/crema
inflate | Bloom | demo/coffee/bloom
particles | Grind | demo/coffee/grind-size
goo | Sweetness | demo/coffee/sweetness
burn | Bitterness | demo/coffee/bitterness
lens | Varieties | demo/coffee/varieties
crt | Caffeine | demo/coffee/caffeine
datamosh | Channeling | demo/coffee/channeling
wave | Water | demo/coffee/water-chemistry
dangle | Moka pot | demo/coffee/moka-pot
weight | Body | demo/coffee/body
smoke | Cold brew | demo/coffee/cold-brew
shatter | Acidity | demo/coffee/acidity
ascii | AeroPress | demo/coffee/aeropress
elastic | Ratio | demo/coffee/brew-ratio
rope | Freshness | demo/coffee/freshness
chrome | Burr grinder | demo/coffee/burr-grinder
coral | Processing | demo/coffee/processing-methods
focus | Cupping | demo/coffee/cupping
film | Microfoam | demo/coffee/milk-and-microfoam
```

## How it works

Every effect shares the same pipeline. When you hover a link, its text is drawn into an offscreen canvas at the device's resolution, exactly where it sits on the page. From that coverage mask, a distance transform computes how far every pixel is from the nearest edge, once for the regular weight and once for a black weight. That gives the shaders letter _shapes_ to work with, not just pixels. The mask and both distance fields go to the GPU as one texture.

A single canvas floats over the page and draws only the links currently in motion. Effects that need memory run small simulations: the dangling letters and the rope use JavaScript physics, and the coral grows in a Gray–Scott reaction–diffusion simulation on the GPU. Nothing runs when nothing is hovered, and none of this code loads anywhere else on the site.

> [!example]- How this page is written
> A fenced `hoverlab` block, one card per line: the effect, the word, and the note it links to.
>
> ```md
> ripple | Extraction | demo/coffee/extraction
> ```
>
> The page opts in with `demo: [hover-lab]`.
