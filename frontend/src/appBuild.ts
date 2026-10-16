/**
 * The entry script this tab is running, for example `index-BR_zIB7M.js`.
 * Empty on the Vite dev server, which serves source files.
 */
const RUNNING = /(index-[\w-]+\.js)$/.exec(new URL(import.meta.url).pathname)?.[1] ?? ''

const RELOADED_KEY = 'dms_training:reloaded_for'

/**
 * Reload the page when the server serves a newer build than this tab runs,
 * so new scenario steps never ask for screens the old copy doesn't have.
 * Returns true when a reload was started.
 */
export function reloadIfStale(serverBuild: string | undefined): boolean {
  if (!serverBuild || !RUNNING || serverBuild === RUNNING) return false
  try {
    // Reload once per build, so a caching proxy can't cause a reload loop.
    if (sessionStorage.getItem(RELOADED_KEY) === serverBuild) return false
    sessionStorage.setItem(RELOADED_KEY, serverBuild)
  } catch {
    // Storage blocked: still reload; the next load serves the new build.
  }
  window.location.reload()
  return true
}
