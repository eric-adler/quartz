---
title: Bitter coffee is (usually) not the beans' fault
description: A choose-your-own-depth article. It pauses at each claim and asks whether it landed; your answers decide how much supporting material you get.
demo:
  - branching
tags:
  - demo
---

> [!info] Demo: choose-your-own-depth
> This article checks in after each argument. If a claim lands, you move on; if it doesn't, the supporting material appears right where you asked for it. Your answers are remembered in this browser. Flip **Show everything** to read the full version.

You bought good beans. You brewed them carefully. The cup is bitter. The obvious conclusion is that the beans are the problem: wrong origin, wrong roast, overpriced bag.

Usually, they aren't.

## The claim

Most bitterness in home-brewed coffee comes from _how_ it was brewed, not _what_ was bought. More precisely: the water dissolved too much of the coffee. Baristas call that over-extraction.

> [!checkpoint] Bitterness is mostly a brewing problem, not a bean problem. Does that match your experience?
>
> - Makes sense, keep going
> - I'm not convinced → evidence
> - What does "extraction" actually mean? → extraction

> [!branch|extraction] Extraction in one minute
> Brewing is dissolving. Ground coffee is about 30% soluble, and the water doesn't take everything at once. Bright acids dissolve first, then sugars, and the heavy bitter compounds last.
>
> So every cup sits somewhere on a line from _sour_ (stopped too early) through _sweet_ (about right) to _bitter_ (went too far). A bitter cup usually means the water kept going after the good part was already out.

> [!branch|evidence] Fair. Here is the test that changes most minds.
> Take one bag of beans and brew two cups side by side. Change only one thing: grind the second cup noticeably coarser.
>
> The finer cup tastes bitter and drying, the coarser one sweeter and rounder, sometimes a little sour. Same beans, same water, same everything else. The bitterness moved because the brewing moved.
>
> Professional tasters use the same logic. In _cupping_, every coffee is brewed with a fixed recipe so the only variable left is the bean. Hold the recipe steady and bean differences show up as flavour and character, rarely as harsh bitterness.
>
> > [!checkpoint] Still think it's the beans?
> >
> > - No, that's convincing
> > - What about dark roasts and robusta? → bean-bitterness
>
> > [!branch|bean-bitterness] Where the beans do matter
> > They can. **Dark roasts** carry roast bitterness by design. It's part of what you bought, and no brewing will remove it entirely. **Robusta** has about twice the caffeine of arabica and more chlorogenic acids, and both taste bitter.
> >
> > But both are easy to spot: dark roasts look oily and smell smoky, and robusta is printed on the bag. If your beans are light or medium arabica and the cup is still bitter, look at the brewing.

## Why bitter comes last

If over-extraction is the cause, the next question is what pushes it too far. The biggest single dial is grind size: the finer the grounds, the faster everything dissolves, and the sooner you reach the bitter end of the line.

> [!checkpoint] A finer grind means more extraction and, past a point, more bitterness. Clear?
>
> - Clear
> - Why does grind matter more than brewing time? → surface-area

> [!branch|surface-area] Surface area does the heavy lifting
> Water can only dissolve what it touches. Halve the size of each particle and you roughly double the surface exposed per gram. That changes the pace of the whole brew, while a few extra seconds of contact only nudges it.
>
> It also explains a sneaky problem: a cheap blade grinder makes dust and boulders at the same time. The dust over-extracts and the boulders under-extract, so the cup ends up bitter _and_ sour. A burr grinder fixes more cups than a new bag of beans.

## What to change first

The temptation is to change everything at once: new beans, new grinder, new kettle. Resist it. Change one thing, taste, then decide.

> [!checkpoint] Ready for the one-change recipe?
>
> - Yes, give me the recipe
> - Why only one change at a time? → one-change

> [!branch|one-change] Because taste is a noisy instrument
> If you change grind and temperature together and the cup improves, you don't know which one helped. Worse, they can cancel out: the coarser grind helps, the hotter water undoes it, and you conclude neither works. One dial at a time turns tasting into an experiment.

## The recipe

1. Brew exactly as you usually do, and taste.
2. Grind one step **coarser**. Brew again with nothing else changed.
3. Still bitter? One more step coarser.
4. Now sour or thin? Go back one step. You've found your grind.
5. Only then try water a few degrees cooler, or a slightly lower dose.

Most people never get past step 3. The beans were fine all along.

> [!example]- How this page is written
> Checkpoints and branches are ordinary Obsidian callouts:
>
> ```md
> > [!checkpoint] Bitterness is mostly a brewing problem. Does that match your experience?
> >
> > - Makes sense, keep going
> > - I'm not convinced → evidence
>
> > [!branch|evidence] Fair. Here is the test that changes most minds.
> > Supporting material, which can contain its own checkpoints.
> ```
>
> A choice without an arrow just continues. A choice with `→ id` reveals the branch with that id. The page opts in with `demo: [branching]` in its frontmatter.
