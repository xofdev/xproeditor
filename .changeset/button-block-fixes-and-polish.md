---
'@xproeditor/core': minor
'@xproeditor/vue': minor
'@xproeditor/react': minor
---

Add a new `button` block type (label, link URL, open-in-new-tab, primary/outline/ghost style, alignment) with a settings popover in both adapters and read-only rendering in `DocRenderer`.

Add a standalone, categorized emoji picker (search, 7 categories, recents) usable both from the callout icon button and via a Slack/Discord-style `:` inline trigger that searches and inserts an emoji directly into text.

Fix several real bugs surfaced while building the Bento showcase theme:
- Slash-menu arrow-key/Enter navigation was dead on arrival — the root keydown handler bailed out for any key typed inside the contenteditable block the menu lives in, which is the only place slash state ever exists.
- Floating UI (slash menu, bubble toolbar, popovers, dropdowns) is portaled to `document.body`, which silently escaped any theme class scoped to an ancestor of the editor — these now resync `--xpe-*` variables onto the portaled node so scoped custom themes apply everywhere, not just inline.
- The to-do checkbox's checkmark and the toggle chevron were sized via Tailwind utility classes that weren't reliably taking effect on raw SVGs — both now use explicit width/height so the checkmark is always visible.
- Vue's button-block label lost all styling because it reused `ui/Button.vue`'s scoped `.xpe-btn` class names on a plain `<div>` — Vue scoped CSS only applies to elements a component itself renders, so the classes were dead. Replaced with locally-scoped styles.

Slash menu now groups items into Basic/Lists/Media/Advanced sections, locks page scroll while open (Notion-style), and flips above the caret when there's no room below.
