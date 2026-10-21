# Quartz Showcase — Plan

18 demo pages that show what a Quartz garden can do beyond stock features. Everything lives under
`content/demo/`, the hub is `content/demo/index.md`.

## Ground rules

- **Scoped behaviour.** Every feature is opt-in per page via frontmatter (`demo: [concepts, sidenotes]`).
  Nothing changes on pages without the flag. A later phase may promote features site-wide.
- **Neutral placeholder content.** Demo pages and a supporting corpus of linked notes on one topic:
  _coffee, from cherry to cup_ (`content/demo/coffee/`). Target ~30 notes; Phase 1 ships ~14.
- **Static only.** The site deploys to GitHub Pages. No backend, no third-party data collection.
  Anything "about the reader" lives in their own `localStorage`.
- **Progressive enhancement.** Without JS, every page still reads as a normal article.
- **SPA-safe.** Quartz swaps pages client-side. Every client script hooks `document`'s `nav` event and
  registers teardown via `window.addCleanup`.
- **Obsidian-friendly syntax.** Authoring stays plain Markdown: callouts, footnotes, wikilinks, fenced blocks.
- **Motion respects `prefers-reduced-motion`**, colours use Quartz theme variables (light + dark).

## Architecture

Two local plugins, wired in `quartz.config.yaml`:

- `plugins/showcase/` (transformer): build-time syntax plus small client scripts and styles, inlined
  into every page but inert unless the page opts in. Plain ESM JavaScript, so no build step.
- `plugins/showcase-assets/` (emitter): bundles the heavy client modules in `plugins/showcase/lazy/`
  (WebGL effects, data views) into `static/showcase/*.js`, loaded only by the pages that use them, and
  writes the semantic map's data.

```
plugins/showcase/
  package.json          quartz manifest (category: transformer)
  index.js              transformer: markdown + html plugins, ships client JS/CSS
  lib/                  build-time transforms (one file per feature) and shared modules
  client/               small browser scripts, inlined
  lazy/                 heavy browser modules, bundled separately and loaded on demand
  styles/               CSS (one file per feature), inlined
plugins/showcase-assets/
  index.js              emitter: lazy bundles + semantic-map.json
```

Build-time transforms check the page's `demo` flags and stamp them onto the article as
`<span class="demo-flags" data-demo="…">`. Client scripts and CSS key off that marker, so they are
inert everywhere else.

### Shared foundations

| Foundation                 | What it is                                                                                                                                           | Used by                                                  |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **Reader memory**          | `localStorage` store: per-page visit count, first/last seen, the ordered trail, per-page state (choices, quiz results). Records only `demo/` pages.  | 1, 3, 5, 12, 18                                          |
| **Drawer**                 | Slide-in panel that fetches a note (same mechanism as Quartz popovers) and shows it without leaving the page. Has its own back-stack.                | 2, 8, 18                                                 |
| **Callout & fence syntax** | Custom callout types (`[!checkpoint]`, `[!branch                                                                                                     | id]`, `[!margin]`) and fenced blocks (` ```telescope `). | 1, 4, 8, 10, 11, 16, 17 |
| **WebGL stage**            | One full-viewport canvas shared by all effects on a page; effects register a draw function and a DOM target. Avoids the ~16-contexts-per-page limit. | 6, 7, 14                                                 |

## The pages

Status: ✅ built · 🔜 next phase · ⏳ later

| #   | Page                                     | Flag           | Phase |
| --- | ---------------------------------------- | -------------- | ----- |
| 1   | Choose-your-own-depth article            | `branching`    | ✅ 1  |
| 2   | Dashed-underline concepts + drawer       | `concepts`     | ✅ 1  |
| 8   | Sidenotes & margin notes                 | `sidenotes`    | ✅ 1  |
| 16  | Telescopic text                          | `telescope`    | ✅ 1  |
| 18  | T-profile navigation (deep + wide rails) | `tprofile`     | ✅ 2  |
| 3   | Personal graph (frequency / recency)     | `memory-graph` | ✅ 2  |
| 5   | Your path through the garden             | `trail`        | ✅ 2  |
| 12  | Flashcards from any note                 | `cards`        | ✅ 2  |
| 15  | Puzzle-locked page                       | `puzzle`       | ✅ 2  |
| 4   | YouTube annotations                      | `video-notes`  | ✅ 3  |
| 9   | Scrollytelling explainer                 | `scrolly`      | ✅ 3  |
| 10  | Reactive document                        | `reactive`     | ✅ 3  |
| 11  | Annotated case study                     | `case-study`   | ✅ 3  |
| 17  | Read-aloud page                          | `read-aloud`   | ✅ 3  |
| 6   | Shader showcase                          | `shaders`      | ✅ 4  |
| 7   | 25 shader link hovers                    | `hover-lab`    | ✅ 4  |
| 14  | Morphing page transitions                | `morph`        | ✅ 4  |
| 13  | Semantic map                             | `semantic-map` | ✅ 4  |

### 1 — Choose-your-own-depth

An argument that adapts to the reader. After a claim, a checkpoint asks whether it landed; the answer
reveals supporting material inline, then the article continues.

```md
> [!checkpoint] Fresh beans beat expensive beans. Does that hold for you?
>
> - Makes sense, keep going
> - Not convinced → evidence
> - What counts as fresh? → fresh

> [!branch|evidence]
> Supporting argument, can contain its own checkpoints…
```

- Content after an unanswered checkpoint is held back (fade + "choose to continue"); a page-level
  "show everything" switch removes all gating. No JS → everything visible.
- Choices persist in reader memory; returning readers see their path and can reset it.
- Done when: every branch is reachable, nesting works, reload restores the path.

### 2 — Dashed-underline concepts

Every internal link in the article becomes a concept: dashed underline, hover shows the target's
one-line `description`, click opens the full note in the drawer. Links inside the drawer push onto the
drawer's own stack (back button), the article never moves. Esc / click-outside closes.
Mobile: tap shows the tooltip, second tap opens the drawer as a bottom sheet.

### 3 — Personal graph

Extends Quartz's graph idea with reader memory: node size = visit count, glow = recency,
fade = not seen in a long time, unvisited = faint outline. A legend and "forget me" button.

### 4 — YouTube annotations

YouTube IFrame Player API, polling `getCurrentTime()` (~4 Hz). Annotations authored as a list:

```md
> [!video] https://youtu.be/ID
>
> - 00:42 Note shown at 42 s
> - 01:30–01:55 Note with an end time
```

Notes slide in beside the video and float over it, the list and a marker timeline double as a
clickable index, and readers can add their own notes at the current time (kept in reader memory).
Uses YouTube's privacy-enhanced embed behind a click-to-load placeholder.

### 5 — Your path

Renders the reader's own trail as a route map: start point, hops, revisits as loops, time spent,
dead ends. Personal data only (no aggregate "where others go").

### 6 — Shader showcase

Living background on the WebGL stage: cursor- and scroll-reactive fields that read Quartz theme colours,
pause when hidden, freeze on reduced motion. Several scenes with a switcher.

### 7 — Hover lab: 25 shader link hovers

Codrops-grade only, no plain CSS hovers. Link text is rasterised to a texture and drawn on the shared
WebGL stage under the hovered link. Candidate list (subject to review):
liquid ripple, velocity RGB smear, pixel-sort melt, ink bleed, Bayer dither dissolve, halftone morph,
SDF inflate, magnetic particles, gooey metaballs, ember burn, glass lens, CRT roll, datamosh,
bezier warp, spring-dangle letters, variable-font morph, fluid smoke, Voronoi shatter, ASCII-fy,
elastic stretch, rope underline, metallic sheen, reaction–diffusion, focus pull, thin-film hologram.
Each card names the technique in one line.

### 8 — Sidenotes & margin notes

On pages with the flag, footnotes become Tufte-style sidenotes in the right margin (right sidebar is
hidden on that page). `> [!margin]` callouts become margin figures. Below 1200px the number toggles the
note inline. Hovering a reference highlights its note and vice versa.

### 9 — Scrollytelling explainer

A fenced ` ```scrolly ` block names a figure; the `> [!step|state]` callouts after it become the steps.
The figure sticks beside the steps (above them on phones) and the step crossing the middle of the
screen sets its state. Figures are small scripts registered by name; the first, `extraction`, shows
acids, sugars and bitter compounds dissolving over time, with taste zones and grind size changing
the pace.

### 10 — Reactive document

Tangle-style numbers inside prose, written as inline code: drag (or arrow-key) a number and
everything computed from it updates. Values are also computed at build time for no-JS readers.

```md
Brew `cups: 2 [1..6]` cups at 1:`ratio: 16 [12..20, 0.5]`, using `= cups * 250 / ratio | 1` g of coffee,
which tastes `? ratio < 14.5: strong | ratio > 17.5: light | balanced`.
```

The expression evaluator (`lib/expr.js`, no `eval`) is shared by the build and the browser.

### 11 — Annotated case study

`> [!pins] ![alt](image.svg)` puts numbered pins on an image, one note per line prefixed with its
position (`48, 29: …`, percent from left and top). Pins and notes highlight each other; on narrow
screens a pin shows its note in a bubble. `> [!compare] Before | After` with two images becomes a
draggable before/after divider. Demo content is a fictional café menu redesign with generated SVGs.

### 12 — Flashcards

`==highlights==` on a flagged page become cloze cards. Quiz mode overlays the article (flip cards,
grade Again / Hard / Good); a card counts as learned once answered Good. "Hide highlights" turns the
page into a cloze test. Results go to reader memory, so the graph can tell "seen" from "learned".

### 13 — Semantic map

Computed at build time from the notes' own words, with no model or API: TF-IDF → latent semantic
analysis → t-SNE layout, k-means clusters labelled by their strongest words, and "related but
unlinked" suggestions. Neural embeddings could replace the first two steps later without changing
the page.

### 14 — Morphing page transitions

A gallery of cards (from a ` ```morph-gallery ` block); clicking one wraps Quartz's SPA navigation in
the View Transitions API, so the card grows into the article and its title flies into the page
title. Hover prefetches the page. Plain navigation where unsupported or with reduced motion.

### 15 — Puzzle-locked page

A riddle page; the answer is the password of a note encrypted by the existing `encrypted-pages` plugin.

### 16 — Telescopic text

Text that expands in place, phrase by phrase, plus a "detail" slider that expands everything to a depth.

```telescope
- I made {coffee}.
  - coffee: a {pour-over} with {beans from Ethiopia}
    - pour-over: slow pour-over through a paper filter
    - beans from Ethiopia: washed Yirgacheffe beans, roasted light
```

Each `{phrase}` is expandable; a child line `phrase: replacement` defines what it becomes.

### 17 — Read-aloud page

Web Speech API. Word-level highlight via `boundary` events where the voice supports it, sentence-level
fallback where it doesn't (e.g. Chrome's network voices). Play/pause, speed, click a paragraph to start
there; skips code and math.

### 18 — T-profile navigation

Deep and wide, drawn as a literal T in the right margin (the right sidebar's usual widgets are hidden
on this page).

- **Wide (the crossbar):** one bar per related note. Score = outgoing + incoming links (3 each) +
  shared tags (weighted by rarity) + two-step paths (0.8 each), computed in the browser from Quartz's
  content index. Closest notes sit next to the centre dot (this page), bar height = strength, visited
  notes are coloured. Hover shows a card with the reason, reading time and when you last visited;
  click navigates and the new page's T takes over.
- **Deep (the stem):** aarnphm-style section rail hanging from the centre. One bar per heading, width by
  depth, staggered grow-in, sections on screen brighter, the one being read in the accent colour.
  Hover slides the headings in from the left; click scrolls.
- Below 1200px: a floating dock with **Sections** and **Related** buttons, each opening a sheet.

## Phases

1. **Reading experience** — plugin skeleton, reader memory, drawer, callout/fence syntax, coffee
   corpus (~14 notes), pages 1, 2, 8, 16, demo hub.
2. **Navigation & memory** — 18, 3, 5, 12, 15; corpus to ~30 notes.
3. **Rich media & explorables** — 4, 9, 10, 11, 17.
4. **Visuals** — WebGL stage, 6, 7, 14, 13.

## Verification per page

- `npx quartz build --serve`, open the page in light and dark mode, desktop and ~400px wide.
- Navigate away and back via SPA links: no duplicated listeners, no leaked DOM.
- A non-demo page shows none of the behaviour.
- Reduced-motion on: no gratuitous animation.
