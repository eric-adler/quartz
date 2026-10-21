---
title: Telescopic text
description: Text that unfolds in place. Click a highlighted phrase to expand it; click expanded text to fold it back.
demo:
  - telescope
tags:
  - demo
---

> [!info] Demo: telescopic text
> Each highlighted phrase hides a longer version of itself. **Click** a phrase to expand it in place, and **click** expanded text to fold it back. The **Detail** slider expands everything to a given depth; the counter shows how the text grows.

## A morning

```telescope
- {Before work}, I made {coffee}.
  - Before work: Before work, {while the house was still quiet}
    - while the house was still quiet: while the house was still quiet and the kettle was the loudest thing in it
  - coffee: a {pour-over} with {beans from Ethiopia} and {a patient bloom}
    - pour-over: slow pour-over through a paper filter
    - beans from Ethiopia: washed beans from Yirgacheffe, {roasted light}
      - roasted light: roasted light three weeks earlier, right at their peak,
    - a patient bloom: a forty-second bloom to let the trapped CO₂ escape first
```

## An explanation

The same idea works for explanations. Start with the claim and let readers unfold only the parts they need.

```telescope
- {Bitterness} usually means {over-extraction}.
  - Bitterness: The harsh, drying bitterness people blame on cheap beans
  - over-extraction: the water {dissolved too much}, and {the fix is a coarser grind}
    - dissolved too much: kept dissolving after the pleasant acids and sugars were out, and started on the heavy, bitter compounds
    - the fix is a coarser grind: the usual fix is a coarser grind, which shrinks the surface area and slows the whole brew down
```

> [!example]- How this page is written
> A fenced block with the language `telescope` holds a nested list. Every `{phrase}` with a matching child line `phrase: replacement` becomes expandable, and replacements can contain more phrases:
>
> ```md
> - {Before work}, I made {coffee}.
>   - Before work: Before work, {while the house was still quiet}
>     - while the house was still quiet: while the house was still quiet and the kettle was the loudest thing in it
>   - coffee: a {pour-over} with {beans from Ethiopia}
> ```
>
> The page opts in with `demo: [telescope]` in its frontmatter.
