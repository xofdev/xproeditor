/** Minimal debounce helper (mirrors the subset of `@vueuse/core`'s `useDebounceFn` used here). */
export function useDebounceFn<Args extends unknown[]>(
  fn: (...args: Args) => void,
  wait = 100,
): (...args: Args) => void {
  let timer: ReturnType<typeof setTimeout> | undefined

  return (...args: Args) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), wait)
  }
}
