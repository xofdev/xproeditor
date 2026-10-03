import { useMemo, useState } from 'react'
import { DocRenderer, markdownToBlocks, type Block } from '@xproeditor/react'
import coreChangelog from '../../../packages/core/CHANGELOG.md?raw'
import reactChangelog from '../../../packages/react/CHANGELOG.md?raw'
import vueChangelog from '../../../packages/vue/CHANGELOG.md?raw'

type PackageId = 'react' | 'vue' | 'core'

const PACKAGES: { id: PackageId; label: string; name: string; source: string }[] = [
  { id: 'react', label: 'React', name: '@xproeditor/react', source: reactChangelog },
  { id: 'vue', label: 'Vue', name: '@xproeditor/vue', source: vueChangelog },
  { id: 'core', label: 'Core', name: '@xproeditor/core', source: coreChangelog },
]

// Pending changesets: what the next "Version Packages" release will contain.
const pendingChangesets = import.meta.glob('../../../.changeset/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

interface Release {
  version: string
  blocks: Block[]
}

/** Split a Changesets CHANGELOG.md into releases and render each with the editor's own Markdown import. */
function parseReleases(markdown: string): Release[] {
  const sections = markdown.split(/^## /m).slice(1)

  return sections.map((section) => {
    const [version, ...rest] = section.split('\n')
    const body = rest
      .join('\n')
      // Commit hashes at the start of entries are noise on a website.
      .replace(/^(\s*-\s+)[0-9a-f]{7,}: /gm, '$1')
      // "Updated dependencies [abc1234]" → plain text.
      .replace(/\s*\[[0-9a-f]{7,}\]/g, '')

    return { version: version.trim(), blocks: markdownToBlocks(body) }
  })
}

function pendingEntries(packageName: string): string[] {
  return Object.values(pendingChangesets)
    .map((raw) => {
      const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw.trim())
      if (!match) return null
      const [, frontmatter, summary] = match
      return frontmatter.includes(`"${packageName}"`) || frontmatter.includes(`'${packageName}'`)
        ? summary.trim()
        : null
    })
    .filter((entry): entry is string => !!entry)
}

export function Changelog() {
  const [pkg, setPkg] = useState<PackageId>('react')
  const current = PACKAGES.find((p) => p.id === pkg) ?? PACKAGES[0]
  const releases = useMemo(() => parseReleases(current.source), [current.source])
  const pending = useMemo(() => pendingEntries(current.name), [current.name])
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? releases : releases.slice(0, 3)

  return (
    <section id="changelog" aria-labelledby="changelog-heading">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Changelog</span>
          <h2 id="changelog-heading">What’s new</h2>
          <p>
            Generated from each package’s <code>CHANGELOG.md</code> and rendered with the editor’s own{' '}
            <code>DocRenderer</code>. Every release is semver; breaking changes are always called out.
          </p>
        </div>

        <div className="changelog-tabs mode-switch" role="tablist" aria-label="Package">
          {PACKAGES.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={pkg === p.id}
              className={pkg === p.id ? 'active' : ''}
              onClick={() => {
                setPkg(p.id)
                setShowAll(false)
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <ol className="changelog-list">
          {pending.length > 0 && (
            <li className="changelog-release changelog-release--next">
              <h3>
                Next release <span className="changelog-badge">unreleased</span>
              </h3>
              <DocRenderer blocks={markdownToBlocks(pending.map((entry) => `- ${entry}`).join('\n'))} />
            </li>
          )}
          {visible.map((release) => (
            <li key={release.version} className="changelog-release">
              <h3>
                <code>{current.name}</code> {release.version}
              </h3>
              <DocRenderer blocks={release.blocks} />
            </li>
          ))}
        </ol>

        {releases.length > 3 && (
          <button type="button" className="changelog-more nav-link" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Show fewer releases' : `Show all ${releases.length} releases`}
          </button>
        )}
      </div>
    </section>
  )
}
