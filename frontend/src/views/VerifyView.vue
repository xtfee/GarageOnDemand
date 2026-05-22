<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '@/api';

const route = useRoute();
const router = useRouter();

// Pobieramy parametry z adresu URL
const uid = route.params.uid;
const token = route.params.token;

const status = ref('loading'); // loading, success, error
const message = ref('Your account is being verified...');

onMounted(async () => {
    try {
        // Wysyłamy zapytanie GET do backendu (widok VerifyEmailView w Django)
        const response = await api.get(`accounts/verify/${uid}/${token}/`);
        
        status.value = 'success';
        message.value = response.data.message || 'Account successfully activated!';
    } catch (err) {
        status.value = 'error';
        if (err.response && err.response.data) {
            message.value = err.response.data.error || 'Verification link has expired or is invalid.';
        } else {
            message.value = 'A server connection error occurred.';
        }
    }
});

const goToLogin = () => {
    router.push('/login');
};
</script>

<template>
  <div class="min-h-screen bg-slate-100 flex items-center justify-center px-4 font-sans select-none py-12">
    <div class="max-w-md w-full">
      
      <div class="bg-indigo-600 text-white rounded-t-[2.5rem] p-10 shadow-lg text-center">
        <h1 class="text-3xl font-black italic uppercase tracking-tighter">Garage System</h1>
        <p class="text-[10px] font-bold uppercase tracking-[0.3em] opacity-60 mt-2 text-indigo-100">Email Address Verification</p>
      </div>

      <div class="bg-white rounded-b-[2.5rem] shadow-2xl p-10 text-center border-x border-b border-slate-200">
        
        <div v-if="status === 'loading'" class="py-4">
            <span class="loading loading-spinner loading-lg text-indigo-600 mb-4"></span>
            <p class="text-slate-600 font-bold uppercase text-xs tracking-widest">{{ message }}</p>
        </div>

        <div v-if="status === 'success'" class="space-y-6">
            <div class="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                 <span class="text-4xl">✅</span>
            </div>
            <h3 class="font-black text-2xl uppercase italic text-slate-900">Success!</h3>
            <p class="text-sm text-slate-500 font-bold">{{ message }}</p>
            <button @click="goToLogin" class="btn bg-indigo-600 hover:bg-indigo-700 text-white w-full rounded-2xl font-black uppercase tracking-widest shadow-xl h-14 border-none transition-all">
                Log in now
            </button>
        </div>

        <div v-if="status === 'error'" class="space-y-6">
            <div class="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                 <span class="text-4xl">❌</span>
            </div>
            <h3 class="font-black text-2xl uppercase italic text-slate-900">Oops! Something went wrong</h3>
            <p class="text-sm text-red-500 font-bold">{{ message }}</p>
            <RouterLink to="/register" class="btn btn-outline border-2 border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-indigo-600 w-full rounded-2xl font-black uppercase tracking-widest h-14 transition-all">
                Try registering again
            </RouterLink>
        </div>

      </div>

    </div>
  </div>
</template>

<style scoped>

</style>