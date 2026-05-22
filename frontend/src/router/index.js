import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import OfferView from '../views/OfferView.vue'
import LoginView from '../views/LoginView.vue'
import RegisterView from '../views/RegisterView.vue'
import AdminDashboard from '../views/AdminDashboard.vue'
import AnalyticsPanel from '../views/AnalyticsPanel.vue'

import ReservationView from '../views/ReservationView.vue'
import SuccessView from '../views/SuccessView.vue'
import CancelView from '../views/CancelView.vue'
import UserDashboard from '../views/UserDashboard.vue'
import AuthCallback from '../views/AuthCallback.vue';

// --- NOWY IMPORT ---
import ConfirmEmail from '../views/ConfirmEmail.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),

  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else {
      return { top: 0 }
    }
  },

  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/oferta',
      name: 'offer',
      component: OfferView
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView
    },
    {
      path: '/register',
      name: 'register',
      component: RegisterView
    },

    {
      path: '/dashboard',
      name: 'dashboard',
      component: UserDashboard,
      meta: { requiresAuth: true }
    },

    {
      path: '/admin',
      name: 'admin',
      component: AdminDashboard,
      meta: { requiresAdmin: true }
    },

    {
      path: '/rezerwacja/:id',
      name: 'reservation',
      component: ReservationView,
      meta: { requiresAuth: true }
    },
    {
      path: '/success',
      name: 'success',
      component: SuccessView
    },
    {
      path: '/cancel',
      name: 'cancel',
      component: CancelView
    },
    {
      path: '/verify/:uid/:token',
      name: 'verify',
      component: () => import('../views/VerifyView.vue')
    },

    // --- NOWA TRASA DO ZMIANY MAILA ---
    {
      path: '/confirm-email/:uid/:token/:emailb64',
      name: 'confirm-email',
      component: ConfirmEmail
    },

    {
      path: '/admin/analytics',
      name: 'AdminAnalytics',
      component: AnalyticsPanel,
      meta: { requiresAdmin: true }
    },

    {
      path: '/auth-callback',
      name: 'AuthCallback',
      component: AuthCallback
    }
  ]
})


router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');


  if (to.matched.some(record => record.meta.requiresAdmin)) {
    if (token && role === 'admin') {
      next();
    } else {
      next('/login');
    }


  } else if (to.matched.some(record => record.meta.requiresAuth)) {
    if (token) {
      next();
    } else {
      next('/login');
    }


  } else {
    next();
  }
});

export default router