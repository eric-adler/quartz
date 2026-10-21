---
title: A short history of the coffeehouse
description: Sidenotes and margin notes. Footnotes move into the margin beside the sentence they belong to, Tufte-style.
demo:
  - sidenotes
tags:
  - demo
---

> [!info] Demo: sidenotes and margin notes
> On a wide screen, footnotes sit in the right margin next to the sentence they annotate. Hover a number to light up its note. On a narrower screen, tap a number to open the note inline. The page is written with ordinary Markdown footnotes.

Coffee has always been a social drug. Long before anyone worried about extraction or roast dates, people gathered around it to talk, argue, trade and gossip. Its history is mostly the history of the rooms it was served in.

## From Ethiopia to Yemen

The plant comes from the highlands of Ethiopia. The popular story of how it was discovered, a goatherd named Kaldi whose goats danced after eating red berries, makes a good legend but poor evidence.[^kaldi]

> [!margin] Origin, at a glance
> _Coffea arabica_ still grows wild in the forests of southwestern Ethiopia. Botanists treat the region as the species' genetic home.

The first reliable traces of coffee _drinking_ come from Yemen in the fifteenth century, where Sufi communities used it to stay awake through night-time devotions.[^sufi] From there it travelled with pilgrims and traders across the Arabian peninsula and into Egypt.

## Banned, unbanned, banned again

Wherever coffeehouses appeared, authorities grew nervous. They were places where people met as equals, talked freely and stayed for hours. In 1511 the governor of Mecca shut them down. The ban did not last.[^mecca]

Istanbul's first coffeehouses opened in the 1550s, and within decades there were hundreds. Ottoman rulers banned them repeatedly, with little lasting effect.

## The penny universities

Coffee reached England in the middle of the seventeenth century. Oxford had a coffeehouse around 1650, and London's first opened in 1652, run by Pasqua Rosée in a small alley off Cornhill.[^rosee]

> [!margin] What a penny bought
> Entry was typically a penny, which bought coffee, a seat, newspapers and conversation, hence the nickname _penny universities_.

London's coffeehouses specialised. Merchants met in one, scientists in another, writers in a third. In 1675 King Charles II issued a proclamation to suppress them as breeding grounds of sedition. The outcry was so loud that it was withdrawn within days.[^charles]

One of these rooms became a global institution. Edward Lloyd's coffeehouse, opened in the 1680s, was where shipowners and underwriters met to insure voyages. The business outgrew the café and became Lloyd's of London.[^lloyds]

## Vienna and Paris

Vienna has its own founding legend: after the Ottoman siege of 1683, a hero is said to have taken sacks of abandoned beans and opened the city's first café. The documented first licence went to someone else two years later.[^vienna] In Paris, the Café Procope opened in 1686 and is still serving today.

What these rooms shared was more than a drink. They were cheap, open to strangers, and full of news. Much of what we now do on the internet, people once did over coffee.

> [!example]- How this page is written
> Ordinary Markdown footnotes (`text.[^kaldi]` plus `[^kaldi]: …` at the end) become sidenotes. A margin note is a callout:
>
> ```md
> > [!margin] Origin, at a glance
> > _Coffea arabica_ still grows wild in southwestern Ethiopia.
> ```
>
> The page opts in with `demo: [sidenotes]` in its frontmatter.

[^kaldi]: The earliest known written version of the Kaldi story dates from 1671, roughly two centuries after coffee drinking is first documented.

[^sufi]: Coffee's ability to keep people awake made it valuable for nightly prayers. That is part of why its early spread followed religious networks.

[^mecca]: The order was overturned soon afterwards. Coffee had already become too popular to suppress.

[^rosee]: Rosée was a servant of a merchant who traded with the Levant. His handbill, _The Vertue of the Coffee Drink_, made generous medical claims.

[^charles]: The proclamation was issued in late December 1675 and withdrawn in early January 1676, a retreat that says a lot about how central the coffeehouses had become.

[^lloyds]: The coffeehouse kept shipping news and lists of vessels, which made it the natural place to strike insurance deals.

[^vienna]: The story of Georg Franz Kolschitzky's café is a nineteenth-century embellishment. The first documented licence to serve coffee in Vienna went to Johannes Diodato in 1685.
