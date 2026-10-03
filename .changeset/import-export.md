---
"@xproeditor/core": minor
---

Much better HTML and Markdown round-trips. `blocksToHtmlContent` now nests lists by indent, exports to-dos as checkbox lists, callouts, video (file and YouTube/Vimeo), embeds, the code language (`language-*` class), captioned images as `<figure>`, and anchor `id`s on headings; `htmlToBlocks` reads all of those back plus GitHub task lists, `<figure>/<figcaption>`, `<video>` and allow-listed iframes. Markdown import keeps list nesting, `1)` markers, nested emphasis and backslash escapes, and no longer italicises inside `snake_case`; Markdown export escapes syntax characters, numbers ordered lists and keeps lists tight. Heading anchors now keep non-Latin text (Persian, Arabic, Cyrillic, CJK…), and text with no letters (`/`, digits, emoji) inherits the editor direction instead of flipping RTL blocks to LTR.
