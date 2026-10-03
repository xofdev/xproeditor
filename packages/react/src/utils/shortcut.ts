function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent)
}

/** `⌘` on Apple platforms, `Ctrl+` elsewhere. */
export function modKeyLabel(): string {
  return isMacPlatform() ? '⌘' : 'Ctrl+'
}

/** Tooltip text with a platform-correct shortcut hint, e.g. `Bold (⌘B)`. */
export function withShortcut(label: string, key?: string): string {
  return key ? `${label} (${modKeyLabel()}${key})` : label
}
