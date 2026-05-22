<script setup>
import { ref, onMounted, watch } from 'vue'
import { RouterView, RouterLink, useRoute, useRouter } from 'vue-router'
import GlobalPaymentTimer from '@/components/GlobalPaymentTimer.vue'
import api from '@/api'

const route = useRoute()
const router = useRouter()
const isLoggedIn = ref(false)
const userRole = ref('')
const username = ref('')

// POWIADOMIENIA
const showNotificationModal = ref(false)
const notifications = ref([])

// MOBILE MENU STATE
const isMobileMenuOpen = ref(false)

const checkAuth = async () => {
  const token = localStorage.getItem('token')
  isLoggedIn.value = !!token
  userRole.value = localStorage.getItem('role') || ''
  const stored = localStorage.getItem('username')
  username.value = stored || 'User'

  if (isLoggedIn.value) {
      // Self-heal: if the stored username is missing or stale, refresh from API
      if (!stored || stored === 'User') {
        try {
          const res = await api.get('accounts/profile/')
          const u = res.data
          const displayName = (u.username && u.username.trim())
            || (u.email && u.email.trim())
            || (u.first_name && u.first_name.trim())
            || 'User'
          username.value = displayName
          localStorage.setItem('username', displayName)
          if (u.role) {
            userRole.value = u.role
            localStorage.setItem('role', u.role)
          }
        } catch (e) {
          // Token invalid or network error - leave fallback in place
        }
      }
      checkNotifications()
  }
}

const checkNotifications = async () => {
    try {
        const res = await api.get('garages/reservations/active_notifications/')
        if (res.data && res.data.length > 0) {
            notifications.value = res.data
            showNotificationModal.value = true
        }
    } catch (e) {
        console.error("Notification error:", e)
    }
}

const markNotificationSeen = async () => {
    for (const notif of notifications.value) {
        try {
            await api.post(`garages/reservations/${notif.id}/mark_seen/`)
        } catch (e) { console.error(e) }
    }
    showNotificationModal.value = false
    notifications.value = []
}

onMounted(() => {
  checkAuth()
})

// Zamykaj menu mobilne i sprawdzaj auth przy każdej zmianie strony
watch(() => route.path, () => {
  checkAuth()
  isMobileMenuOpen.value = false
})

const handleLogout = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('role')
  localStorage.removeItem('username')
  
  isLoggedIn.value = false
  userRole.value = ''
  username.value = ''
  isMobileMenuOpen.value = false // Zamknij menu po wylogowaniu
  
  router.push('/') 
}
</script>

<template>
  <div class="min-h-screen bg-base-200 flex flex-col font-sans text-slate-800">
    
    <GlobalPaymentTimer v-if="isLoggedIn" />

    <div class="navbar bg-slate-900/95 backdrop-blur-xl shadow-lg sticky top-0 z-50 border-b border-slate-800 py-3">
      <div class="container mx-auto flex w-full items-center justify-between px-4">
        
        <div class="flex-none">
          <RouterLink to="/" class="flex items-center gap-3 group">
            <div class="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white rounded-xl flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-500/30 group-hover:scale-110 transition-transform duration-300">
              G
            </div>
            <span class="text-xl md:text-2xl font-black tracking-tight text-white group-hover:text-indigo-400 transition-colors duration-300">
              Garage<span class="text-indigo-500">OnDemand</span>
            </span>
          </RouterLink>
        </div>

        <div class="hidden md:flex flex-1 justify-center">
          <ul class="menu menu-horizontal px-1 gap-3">
            <li>
                <RouterLink to="/oferta"
                    active-class="!bg-white !text-indigo-600 shadow-md transform scale-105"
                    class="px-6 py-2.5 rounded-full font-bold text-white bg-indigo-600 border-2 border-indigo-600 hover:bg-indigo-500 hover:border-indigo-500 transition-all shadow-sm">
                    Offer
                </RouterLink>
            </li>

            <li v-if="isLoggedIn">
              <RouterLink to="/dashboard"
                active-class="!bg-white !text-indigo-600 shadow-md transform scale-105"
                class="px-6 py-2.5 rounded-full font-bold text-white bg-indigo-600 border-2 border-indigo-600 hover:bg-indigo-500 hover:border-indigo-500 transition-all shadow-sm">
                My Dashboard
              </RouterLink>
            </li>

            <li v-if="isLoggedIn && userRole === 'admin'">
              <RouterLink to="/admin"
                active-class="!bg-white !text-indigo-600 shadow-md transform scale-105"
                class="px-6 py-2.5 rounded-full font-bold text-white bg-indigo-600 border-2 border-indigo-600 hover:bg-indigo-500 hover:border-indigo-500 transition-all shadow-sm">
                Admin Dashboard
              </RouterLink>
            </li>
            <li v-if="isLoggedIn && userRole === 'admin'">
                <RouterLink to="/admin/analytics"
                  active-class="!bg-white !text-indigo-600 shadow-md transform scale-105"
                  class="px-6 py-2.5 rounded-full font-bold text-white bg-indigo-600 border-2 border-indigo-600 hover:bg-indigo-500 hover:border-indigo-500 transition-all shadow-sm">
                  Analytics
                </RouterLink>
            </li>
          </ul>
        </div>

        <div class="flex-none flex justify-end gap-3 items-center">
          <div class="hidden md:flex gap-3 items-center">
              <template v-if="!isLoggedIn">
                <RouterLink to="/login" class="px-5 py-2.5 rounded-full font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-all">Log in</RouterLink>
                <RouterLink to="/register" class="px-6 py-2.5 rounded-full font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg transition-all">
                  Create account
                </RouterLink>
              </template>

              <template v-else>
                <RouterLink to="/dashboard" class="flex items-center px-3 py-2 text-sm font-bold text-slate-400 hover:text-indigo-400 transition-colors cursor-pointer">
                  Hi,&nbsp;<span class="text-indigo-400">{{ username }}</span>!
                </RouterLink>

                <button @click="handleLogout" class="px-6 py-2.5 rounded-full font-bold bg-transparent border-2 border-red-500 text-red-500 hover:bg-red-600 hover:border-red-600 hover:text-white shadow-sm transition-all">
                  Log out
                </button>
              </template>
          </div>

          <button @click="isMobileMenuOpen = !isMobileMenuOpen" class="btn btn-square btn-ghost md:hidden text-white ml-2">
              <span class="text-2xl">{{ isMobileMenuOpen ? '✕' : '☰' }}</span>
          </button>
        </div>

      </div>

      <Transition name="slide-down">
        <div v-if="isMobileMenuOpen" class="md:hidden absolute top-full left-0 w-full bg-slate-900 border-t border-slate-800 shadow-2xl flex flex-col p-6 gap-4 z-40">
            
            <div v-if="isLoggedIn" class="text-center mb-2 pb-4 border-b border-slate-800">
                <p class="text-slate-400 text-sm font-bold">Logged in as:</p>
                <p class="text-indigo-400 font-black text-lg">{{ username }}</p>
            </div>

            <RouterLink to="/oferta" class="btn btn-ghost w-full justify-start text-white font-bold text-lg">
                📋 Offer
            </RouterLink>

            <template v-if="isLoggedIn">
                <RouterLink to="/dashboard" class="btn btn-ghost w-full justify-start text-white font-bold text-lg">
                    👤 My Dashboard
                </RouterLink>
                
                <div v-if="userRole === 'admin'" class="divider divider-start font-black text-slate-600 text-xs">ADMINISTRATION</div>

                <RouterLink v-if="userRole === 'admin'" to="/admin" class="btn btn-ghost w-full justify-start text-amber-400 font-bold text-lg">
                    🛠️ Admin Dashboard
                </RouterLink>
                <RouterLink v-if="userRole === 'admin'" to="/admin/analytics" class="btn btn-ghost w-full justify-start text-emerald-400 font-bold text-lg">
                    📊 Analytics
                </RouterLink>
            </template>

            <div class="divider my-0"></div>

            <template v-if="!isLoggedIn">
                <RouterLink to="/login" class="btn btn-outline text-white w-full font-bold">Log in</RouterLink>
                <RouterLink to="/register" class="btn bg-indigo-600 hover:bg-indigo-700 text-white w-full border-none font-bold">Create account</RouterLink>
            </template>
            <template v-else>
                <button @click="handleLogout" class="btn btn-outline btn-error w-full font-bold">Log out</button>
            </template>

        </div>
      </Transition>

    </div>

    <main class="flex-grow">
      <RouterView />
    </main>

    <dialog class="modal modal-bottom sm:modal-middle backdrop-blur-md" :class="{ 'modal-open': showNotificationModal }">
      <div class="modal-box bg-white rounded-[2.5rem] p-8 border-4 border-indigo-50 text-center shadow-2xl">
        <div class="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
             <span class="text-4xl">🔔</span>
        </div>
        <h3 class="font-black text-2xl uppercase italic text-slate-900 mb-4">Important Message</h3>
        
        <div class="space-y-4 mb-8">
            <div v-for="note in notifications" :key="note.id" class="bg-slate-50 p-4 rounded-xl border border-slate-200 text-left">
                <p class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Reservation #{{ note.id }} canceled</p>
                <p class="text-slate-800 font-medium text-sm">
                    {{ note.cancellation_reason || 'No reason provided.' }}
                </p>
            </div>
        </div>

        <div class="modal-action justify-center">
            <button @click="markNotificationSeen" class="btn btn-wide bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg border-none">
                I understand
            </button>
        </div>
      </div>
    </dialog>

    <footer class="footer p-10 bg-neutral text-neutral-content mt-auto">
      <div class="container mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <aside class="flex flex-col items-start">
          <div class="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-bold text-2xl mb-4">G</div>
          <p class="font-bold text-lg">Garage OnDemand</p>
          <p class="opacity-80">Professional workshop space for rent.<br/>You fix it yourself, you only pay for time.</p>
        </aside> 
        
      </div>
    </footer>

  </div>
</template>

<style scoped>
/* Animacja rozwijania menu mobilnego */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease-out;
  max-height: 500px;
  opacity: 1;
}

.slide-down-enter-from,
.slide-down-leave-to {
  max-height: 0;
  opacity: 0;
  overflow: hidden;
}
</style>