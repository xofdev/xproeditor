# XProEditor site

The project's landing page — hero, a live embedded `@xproeditor/react`
editor you can actually type in, install snippets for both frameworks,
features, and package links. Deployed to GitHub Pages automatically on every
push to `main` that touches `site/`, `packages/core/`, or `packages/react/`
(see [`.github/workflows/deploy-pages.yml`](../.github/workflows/deploy-pages.yml)).

```bash
npm install
npm run dev -w site
```

Deployed at **https://xofdev.github.io/xproeditor/**.

If you fork this repo or rename it, update `base` in `vite.config.ts` (or set
the `BASE_PATH` env var at build time) to match your Pages URL path.
