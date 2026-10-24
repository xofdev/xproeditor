import { FAQ as ITEMS } from '../data/faq'

export function FAQ() {
  return (
    <section id="faq" aria-labelledby="faq-heading">
      <div className="container container--narrow">
        <div className="section-head">
          <span className="eyebrow">FAQ</span>
          <h2 id="faq-heading">Questions teams ask before adopting</h2>
        </div>

        <div className="faq-list">
          {ITEMS.map((item, i) => (
            <details className="faq-item" key={item.q} open={i === 0}>
              <summary>
                <h3>{item.q}</h3>
                <span className="faq-icon" aria-hidden />
              </summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
