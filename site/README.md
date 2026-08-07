# XProEditor site

Marketing landing page with a live embedded `@xproeditor/react` editor, install
snippets for Vue and React, block catalog, features, and package links.

Deployed to GitHub Pages on every push to `main` that touches `site/`,
`packages/core/`, or `packages/react/` (see
[`.github/workflows/deploy-pages.yml`](../.github/workflows/deploy-pages.yml)).

**Live:** https://xofdev.github.io/xproeditor/

## Preview locally

From the repo root (builds core + react, then starts Vite):

```bash
npm install
npm run dev:site
```

Or, if packages are already built:

```bash
npm run dev -w site
```

Dev server: **http://localhost:5175** (`strictPort: true` in `vite.config.ts`).

## SEO / static assets

- `index.html` — title, description, Open Graph, Twitter, JSON-LD
- `public/robots.txt` — allow crawlers + sitemap pointer
- `public/sitemap.xml` — canonical site URL
- `public/favicon.svg` — brand mark

If you fork or rename the repo, update `base` in `vite.config.ts` (or set
`BASE_PATH` at build time) and the absolute URLs in `index.html` /
`public/sitemap.xml` / `public/robots.txt`.
