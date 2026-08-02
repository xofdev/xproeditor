---
"@xproeditor/core": patch
---

Pasting HTML that contains `<script>` or `<style>` no longer inserts their source into the document as visible paragraph text. `htmlToBlocks` now strips non-content elements before converting.
