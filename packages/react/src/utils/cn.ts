export type ClassValue = string | number | false | null | undefined

/** Joins truthy class fragments with a space. Minimal `clsx`-style helper. */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ')
}
