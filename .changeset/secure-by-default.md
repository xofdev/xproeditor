---
"@xproeditor/core": minor
"@xproeditor/react": patch
"@xproeditor/vue": patch
---

**Security:** links, media sources and colours are now sanitized everywhere content is rendered, imported or exported. `javascript:` / `data:` links pasted from a web page, loaded from storage, pasted as clipboard JSON or returned by an AI model no longer become live links in the editor or in `DocRenderer`, and colour values can no longer break out of a `style` attribute. Unknown block types in stored or pasted documents now degrade to paragraphs instead of breaking the renderer. New core helpers: `sanitizeUrl`, `sanitizeLinkUrl`, `sanitizeMediaUrl`, `sanitizeCssColor`, `sanitizeBlock`, `sanitizeBlocks`.
