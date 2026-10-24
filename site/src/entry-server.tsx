import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import App from './App'
import { FAQ } from './data/faq'

/** Prerender the landing page to static HTML (see scripts/prerender.mjs). */
export function render(): string {
  return renderToString(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

/** FAQPage structured data, generated from the same entries the page shows. */
export function faqJsonLd(): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  })
}
