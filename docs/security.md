# Security

Documents are plain JSON that come from places you don't control — your
database, the clipboard, a pasted web page, an AI model. XProEditor treats all
of it as untrusted.

## What is sanitized

| Input | Where it's checked |
| --- | --- |
| Link marks (`marks.link`) | `spansToHtml` (editor + `DocRenderer`), HTML/Markdown import, `sanitizeBlocks` |
| Image / video / audio / favicon sources | Every `src` in both adapters, HTML export |
| Button, file and bookmark URLs | Every `href` in both adapters, HTML export |
| Colours (`color`, `highlight`, callout/button/table colours) | `spansToHtml`, table normalization, `sanitizeBlocks`, HTML export |
| Block shape (unknown types, non-string text, bad props, duplicate ids) | `sanitizeBlocks` — run by `normalizeContent`, clipboard paste, `setBlocks`, `insertBlocks`, AI output |
| Embeds | The iframe `src` is always re-derived from the stored URL by `resolveEmbed`; only allow-listed providers render, inside a sandboxed iframe |
| Pasted HTML | `<script>`, `<style>`, `<object>`, `<embed>`, `<link>`, `<meta>` are dropped; unknown iframes are dropped |

Allowed URL schemes: `http:`, `https:`, `mailto:`, `tel:` and relative URLs.
Media sources additionally allow `blob:` (the default upload fallback) and
`data:image/(png|gif|jpeg|webp|avif|bmp)`. `javascript:`, `vbscript:`,
`data:text/html` and every other scheme are rejected, including obfuscated
forms such as `java\tscript:`.

## Using the helpers yourself

```ts
import { normalizeContent, sanitizeBlocks, sanitizeLinkUrl, sanitizeCssColor } from '@xproeditor/core'

const blocks = normalizeContent(row.content)     // stored payload → safe Block[]
const fromApi = sanitizeBlocks(await res.json()) // any untrusted Block[]
sanitizeLinkUrl('javascript:alert(1)')           // ''
sanitizeCssColor('red;position:fixed')           // ''
```

## Server-side HTML

`blocksToHtmlContent(blocks)` produces sanitized markup and is safe to store or
send by email. If you render stored HTML from *other* sources, still run it
through your usual HTML sanitizer — XProEditor only vouches for HTML it
generated itself.

## Reporting a vulnerability

Please open a private security advisory on
[GitHub](https://github.com/xofdev/xproeditor/security/advisories/new) rather
than a public issue.
