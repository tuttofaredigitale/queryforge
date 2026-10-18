import { createRouter, createWebHistory } from 'vue-router';
import store from '../store';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/LandingPage.vue'),
    meta: { public: true }
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { guest: true }
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('../views/Register.vue'),
    meta: { guest: true }
  },
  {
    path: '/playground',
    name: 'Playground',
    component: () => import('../views/Playground.vue'), // Già corretto!
    meta: { requiresAuth: true }
  },
  {
    path: '/profilo',
    name: 'profile',
    component: () => import('../views/ProfileView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/reset-password',
    name: 'ResetPasswordQuery',
    component: () => import('../views/ResetPassword.vue'),
    meta: { guest: true },
    props: route => ({ token: route.query.token || route.params.token })
  },
  {
    path: '/reset-password/:token',
    name: 'ResetPassword',
    component: () => import('../views/ResetPassword.vue'),
    meta: { guest: true },
    props: true
  },
  // Le pagine legali erano già corrette!
  {
    path: '/privacy-policy',
    name: 'PrivacyPolicy',
    component: () => import('../views/legal/PrivacyPolicy.vue'),
    meta: { public: true }
  },
  {
    path: '/cookie-policy',
    name: 'CookiePolicy',
    component: () => import('../views/legal/CookiePolicy.vue'),
    meta: { public: true }
  },
  {
    path: '/terms',
    name: 'TermsAndConditions',
    component: () => import('../views/legal/TermsAndConditions.vue'),
    meta: { public: true }
  },
  {
  path: '/verify-email',
  name: 'VerifyEmail',
  component: () => import('@/views/VerifyEmail.vue'),
  meta: { requiresAuth: false }
  },
  {
    path: '/registration-success',
    name: 'RegistrationSuccess',
    component: () => import('@/views/RegistrationSuccess.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/whitelabel',
    name: 'WhiteLabel',
    component: () => import('../views/WhiteLabel.vue'), // Usiamo l'import dinamico
    meta: { public: true } // È una pagina pubblica, visibile a tutti
  },
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

// La guardia di navigazione rimane identica e funziona perfettamente con gli import dinamici.
router.beforeEach((to, from, next) => {
  const isAuthenticated = store.getters['auth/isAuthenticated'];

  if (to.meta.public) {
    return next();
  }
  if (to.meta.requiresAuth && !isAuthenticated) {
    return next('/login');
  }
  if (to.meta.guest && isAuthenticated) {
    return next('/playground');
  }
  next();
});

export default router;