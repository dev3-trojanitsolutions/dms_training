import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  // The same path as `frontendRoute` in vite.config.ts
  history: createWebHistory('/training'),
  routes: [
    { path: '/', component: () => import('./pages/Home.vue') },
    {
      path: '/s/:name',
      component: () => import('./pages/Player.vue'),
      props: true,
    },
    { path: '/team', component: () => import('./pages/TeamProgress.vue') },
    { path: '/:path(.*)*', component: () => import('./pages/NotFound.vue') },
  ],
})

// A tab opened before a rebuild asks for page chunks that no longer exist.
// Load the page fresh instead, so it gets the new build.
const CHUNK_ERROR = /dynamically imported module|Importing a module script failed|Failed to fetch/i
router.onError((error: unknown, to) => {
  if (!CHUNK_ERROR.test(String((error as Error)?.message ?? error))) return
  const href = router.resolve(to).href
  try {
    if (sessionStorage.getItem('dms_training:chunk_reload') === href) return
    sessionStorage.setItem('dms_training:chunk_reload', href)
  } catch {
    // Storage blocked: reload anyway.
  }
  window.location.assign(href)
})
