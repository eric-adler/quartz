---
title: How much coffee do you need?
description: A reactive document. Drag the blue numbers and everything that depends on them recalculates as you read.
demo:
  - reactive
tags:
  - demo
---

> [!info] Demo: a reactive document
> Every **blue number** with a dotted underline is adjustable: drag it left or right, or click it and use the arrow keys. Everything calculated from it updates instantly, so the article becomes a calculator you read rather than fill in.

## Your morning

Say you make `cups: 2 [1..6]` cups of coffee each morning, each about `size: 250 [150..400, 10]` ml. That's `= cups * size` ml of coffee a day.

For filter coffee, a common ratio is 1 part coffee to `ratio: 16 [12..20, 0.5]` parts water. At that ratio you need `= cups * size / ratio | 1` g of ground coffee every morning, which makes your coffee `? ratio < 14.5: strong and heavy | ratio > 17.5: light and delicate | balanced`.

## Your bag of beans

A standard bag holds `bag: 250 [200..1000, 50]` g. At your dose it lasts `= floor(bag / (cups * size / ratio))` mornings, roughly `= bag / (cups * size / ratio) / 7 | 1` weeks.

That matters because roasted coffee is at its best for about four weeks after roasting. `? bag / (cups * size / ratio) > 28: At your pace this bag will outlive its best weeks, so buy smaller bags or share. | You'll finish this bag while it's still fresh.`

If the bag costs `price: 14 [6..40, 0.5]` per bag, each cup costs `= price / floor(bag / (cups * size / ratio)) / cups | 2`. A café flat white at around 3.50 costs `= 3.5 / (price / floor(bag / (cups * size / ratio)) / cups) | 0` times as much.

## Your caffeine

Roasted arabica contains about `mg: 12 [8..24]` mg of caffeine per gram (robusta is closer to 22), and brewing extracts nearly all of it. Your morning brings `= cups * size / ratio * mg` mg of caffeine, `? cups * size / ratio * mg > 400: above the 400 mg a day that most health agencies consider safe for adults | within the 400 mg a day that most health agencies consider safe for adults`.

## Why write like this

Most explanations pick one example and hope it's close to yours. A reactive document lets every reader plug in their own numbers without leaving the text. The argument stays the same, but it's about _your_ coffee. See [[Brew ratio]] and [[Caffeine]] for the background.

> [!example]- How this page is written
> Inline code in three forms:
>
> - `` `cups: 2 [1..6]` `` is a number readers can drag between 1 and 6 (an optional third value sets the step: `[150..400, 10]`).
> - `` `= cups * size / ratio | 1` `` is a calculated value with one decimal place.
> - `` `? ratio < 14.5: strong | balanced` `` shows the text of the first condition that holds, with the last as the default.
>
> Values are also calculated at build time, so the page reads correctly without JavaScript. The page opts in with `demo: [reactive]`.
