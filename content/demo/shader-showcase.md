---
title: Shader showcase
description: Full-screen scenes rendered live on the GPU behind the page, reacting to your cursor and your scrolling.
demo:
  - shaders
tags:
  - demo
---

> [!info] Demo: shader showcase
> The page you're reading floats over a shader running full-screen behind it. Pick a scene below, move your cursor, and scroll: each scene reacts to both. **Immersive** hides the page so you can watch the scene on its own (press Esc to come back).

```shader-stage

```

## Crema

The marbled foam on an espresso, generated from scratch. It's _domain warping_: noise sampled at coordinates distorted by more noise, three layers deep, which gives the folding, tiger-striped look of real crema. Your cursor stirs it: fast movement adds a swirl that settles back over a few seconds.

## Ripples

The surface of a cup seen from above. Every drop is an analytic wave travelling outward from where it landed; their sum is a height field, and the shader works out the surface's slope at every pixel to reflect a warm room and a bright window. The reflection follows the Fresnel effect: looking straight down you see the coffee, at grazing angles you see the sky. Move or click to drop.

## Steam

Four layers of noise drifting upward, each bent by _curl noise_, a velocity field with no sources or sinks, so it swirls like a real fluid without simulating one. The cursor pushes the wisps aside, and scrolling speeds up the rise.

## Beans

Coffee beans with no geometry at all. Each one is an ellipse described by a distance function, given a domed normal so it can be lit and a curved crease down the middle. Three layers at different depths drift past at different speeds as you scroll, and the light follows your cursor.

## Being polite about it

Shaders are expensive, so this one is careful. It renders the softer scenes at half resolution, stops completely when the tab is hidden, and draws a single still frame if you've asked your system to reduce motion. The code loads only on this page.

> [!example]- How this page is written
> A fenced `shader-stage` block marks where the scene picker goes, and the page opts in with `demo: [shaders]`. The scenes themselves are fragment shaders in the showcase plugin.
