// Inject the server-rendered landing page into dist/index.html so crawlers,
// link previews and first paint get real content instead of an empty <div>.
// Run after `vite build` (client) and `vite build --ssr` (server bundle).
import { readFile, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(root, 'dist')
const serverEntry = resolve(root, 'dist-server/entry-server.js')

const { render, faqJsonLd } = await import(pathToFileURL(serverEntry).href)

const indexPath = resolve(dist, 'index.html')
const template = await readFile(indexPath, 'utf8')
const appHtml = render()

if (!template.includes('<!--app-html-->')) {
  throw new Error('index.html is missing the <!--app-html--> placeholder')
}

const html = template
  .replace('<!--app-html-->', appHtml)
  .replace(
    '<!--faq-jsonld-->',
    `<script type="application/ld+json">${faqJsonLd().replace(/</g, '\\u003c')}</script>`,
  )

await writeFile(indexPath, html)

// Keep the sitemap's lastmod honest.
const today = new Date().toISOString().slice(0, 10)
const sitemapPath = resolve(dist, 'sitemap.xml')
const sitemap = await readFile(sitemapPath, 'utf8')
await writeFile(sitemapPath, sitemap.replace(/<lastmod>[^<]*<\/lastmod>/, `<lastmod>${today}</lastmod>`))

await rm(resolve(root, 'dist-server'), { recursive: true, force: true })

console.log(`prerendered ${(appHtml.length / 1024).toFixed(1)} KB of HTML into dist/index.html`)
