---
title: The barista's lock
description: A puzzle-locked page. Solve four clues; their first letters spell the password to a hidden, encrypted note.
demo:
  - puzzle
tags:
  - demo
---

> [!info] Demo: puzzle lock
> Behind this lock is a page that doesn't appear anywhere else on the site. Its contents are encrypted, and the password is the four first letters of the answers below. Every answer is a note in the [[demo/coffee/index|coffee garden]], so if you're stuck, go and read. Answers are checked against scrambled fingerprints, so the page's source won't give them away.

```puzzle
door: demo/back-room
- I'm the first, small pour: just enough water to let the trapped gas escape before the real brew begins. | bloom
- Light, medium or dark. The roaster decides me, and I decide how much of the origin survives. | roast, roast level, roasting
- Water pulling flavour out of grounds. Too little tastes sour, too much tastes bitter. | extraction
- I'm about 98% of every cup, and the minerals I carry change what gets dissolved. | water, water chemistry
```

> [!example]- How this page is written
> A fenced `puzzle` block lists the clues as `clue | answer, alternative answers`, plus a `door:` line naming the locked page. At build time the answers are replaced by salted hashes. The door is an ordinary note with `password:` and `unlisted: true` in its frontmatter, encrypted by Quartz's `encrypted-pages` plugin. When the lock opens, the password is handed to that plugin so the door unlocks by itself. (The password does sit in the note's source file, so this is a game, not a vault.)
