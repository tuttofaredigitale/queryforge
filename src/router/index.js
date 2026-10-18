import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/LandingPage.vue')
  },
  {
    path: '/playground',
    name: 'Playground',
    component: () => import('../views/Playground.vue')
  },
  // Le pagine legali
  {
    path: '/privacy-policy',
    name: 'PrivacyPolicy',
    component: () => import('../views/legal/PrivacyPolicy.vue')
  },
  {
    path: '/cookie-policy',
    name: 'CookiePolicy',
    component: () => import('../views/legal/CookiePolicy.vue')
  },
  {
    path: '/terms',
    name: 'TermsAndConditions',
    component: () => import('../views/legal/TermsAndConditions.vue')
  },
  {
    path: '/whitelabel',
    name: 'WhiteLabel',
    component: () => import('../views/WhiteLabel.vue') // Usiamo l'import dinamico
  },
  // Account e registrazione non esistono più: i vecchi link portano al playground
  { path: '/login', redirect: '/playground' },
  { path: '/register', redirect: '/playground' },
  { path: '/profilo', redirect: '/playground' },
  { path: '/verify-email', redirect: '/playground' },
  { path: '/registration-success', redirect: '/playground' },
  { path: '/reset-password/:token?', redirect: '/playground' },
  // Fallback
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    // Se la navigazione ha una posizione salvata (es. quando si usa il pulsante "indietro" del browser),
    // torna a quella posizione.
    if (savedPosition) {
      return savedPosition;
    }

    // Se la rotta di destinazione ha un hash (es. /pagina#sezione),
    // scrolla a quell'elemento.
    if (to.hash) {
      return {
        el: to.hash,
        behavior: 'smooth', // Aggiunge uno scroll morbido
      };
    }

    // In tutti gli altri casi (la maggior parte delle navigazioni),
    // scrolla la pagina in cima.
    return { top: 0, behavior: 'smooth' };
  },
});

export default router;
