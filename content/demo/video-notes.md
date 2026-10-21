---
title: Annotated video
description: Notes that appear while a YouTube video plays, a timeline you can jump around, and room for your own notes.
demo:
  - video-notes
tags:
  - demo
---

> [!info] Demo: video annotations
> Press play and notes appear beside the video as it reaches them. The note playing now also floats over the picture. Click any timestamp, or a dot on the timeline, to jump there. You can add **your own notes** at the current moment; they're saved in this browser and appear alongside the page's notes in a different colour.

James Hoffmann's _The Ultimate V60 Technique_ is one of the most-watched pour-over guides. The notes below connect what's on screen to the garden's notes on [[Extraction|extraction]], [[Bloom|blooming]] and [[Grind size|grind size]].

> [!video] https://www.youtube.com/watch?v=AI4ynXzkSQo
>
> - 00:05 The recipe in one line: 30 g of coffee to 500 g of water, a [[Brew ratio|brew ratio]] of about 1:16.7.
> - 00:50 Grind: medium-fine, and consistent. A [[Burr grinder|burr grinder]] matters more than the brewer.
> - 01:45 Rinsing the paper filter removes papery taste and preheats the cone.
> - 02:45 The bloom: a small first pour lets trapped CO₂ escape so the rest of the water can reach the grounds. See [[Bloom]].
> - 03:45 Swirling the slurry wets every particle evenly, so the whole bed starts extracting at once.
> - 04:45 The main pours: steady and fairly fast, keeping the water level high.
> - 06:00 Why pour fast? A short, even contact time keeps [[Extraction|extraction]] uniform across the bed.
> - 07:15 A gentle stir and a final swirl knock grounds off the walls and give a flat bed for an even drawdown.
> - 08:30 Total brew time is a symptom: a slow drawdown usually means the grind is too fine.
> - 10:00 Water matters as much as technique. See [[Water chemistry|water chemistry]].

> [!example]- How this page is written
> A callout whose title is the video's URL, with one note per line:
>
> ```md
> > [!video] https://www.youtube.com/watch?v=AI4ynXzkSQo
> >
> > - 00:05 The recipe in one line…
> > - 02:45–03:30 A note with an explicit end time
> ```
>
> Without an end time, a note stays up for 12 seconds or until the next note starts. The page opts in with `demo: [video-notes]` in its frontmatter. The player uses YouTube's privacy-enhanced embed and only loads when you press play.
>
> **The timestamps on this page are approximate.** They follow the order of the video, but I couldn't fetch a transcript to time them exactly. Adjust them in the Markdown.
