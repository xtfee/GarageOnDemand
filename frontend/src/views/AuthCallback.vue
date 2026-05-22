<template>
  <div class="min-h-screen bg-slate-100 flex items-center justify-center px-4 font-sans select-none">
    <div class="text-center">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
      <h3 class="mt-6 text-xl font-black italic uppercase tracking-tight text-slate-700">Authenticating with Google...</h3>
      <p class="text-sm font-bold text-slate-400 uppercase tracking-widest mt-2">Please wait</p>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '@/api';

const route = useRoute();
const router = useRouter();

onMounted(async () => {
  const token = route.query.token;

  if (!token) {
    router.push('/login?error=auth_failed');
    return;
  }

  localStorage.setItem('token', token);

  try {
    const res = await api.get('accounts/profile/');
    const u = res.data;
    const displayName = (u.username && u.username.trim())
      || (u.email && u.email.trim())
      || (u.first_name && u.first_name.trim())
      || 'User';
    localStorage.setItem('role', u.role || 'client');
    localStorage.setItem('username', displayName);
  } catch (e) {
    localStorage.setItem('role', 'client');
    localStorage.setItem('username', 'User');
  }

  window.location.href = '/';
});
</script>