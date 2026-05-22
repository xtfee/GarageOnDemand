<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '@/api';

const route = useRoute();
const router = useRouter();

const status = ref('loading'); // loading, success, error
const message = ref('Verifying email address change...');

onMounted(async () => {
    // 1. Pobieramy parametry z URL (zdefiniowane w routerze)
    const { uid, token, emailb64 } = route.params;

    if (!uid || !token || !emailb64) {
        status.value = 'error';
        message.value = 'Invalid verification link.';
        return;
    }

    try {
        // 2. Wysyłamy te dane do Backendu, żeby faktycznie zmienił maila w bazie
        await api.post('accounts/confirm-email-change/', {
            uid: uid,
            token: token,
            emailb64: emailb64
        });

        status.value = 'success';
        message.value = 'Your email address has been successfully changed!';
        
        // 3. Po 3 sekundach przekieruj do panelu lub logowania
        setTimeout(() => {
            router.push('/dashboard'); // lub '/login' jeśli chcesz wymusić przelogowanie
        }, 3000);

    } catch (err) {
        status.value = 'error';
        if (err.response && err.response.data && err.response.data.error) {
            message.value = err.response.data.error;
        } else {
            message.value = 'An error occurred during verification. The link may have expired.';
        }
    }
});
</script>

<template>
    <div class="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div class="card bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-slate-100">
            
            <div v-if="status === 'loading'">
                <div class="loading loading-spinner loading-lg text-indigo-600 mb-4"></div>
                <h2 class="text-xl font-black text-slate-700 uppercase">Verification...</h2>
                <p class="text-slate-400 text-sm mt-2">Please wait, we are processing the change.</p>
            </div>

            <div v-else-if="status === 'success'">
                <div class="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span class="text-3xl">✓</span>
                </div>
                <h2 class="text-2xl font-black text-green-600 uppercase">Success!</h2>
                <p class="text-slate-600 font-bold mt-2">{{ message }}</p>
                <p class="text-slate-400 text-xs mt-4">You will be redirected shortly...</p>
                <button @click="router.push('/dashboard')" class="btn btn-sm btn-ghost mt-4">Go now</button>
            </div>

            <div v-else-if="status === 'error'">
                <div class="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span class="text-3xl">✕</span>
                </div>
                <h2 class="text-2xl font-black text-red-600 uppercase">Error</h2>
                <p class="text-slate-600 font-bold mt-2">{{ message }}</p>
                <button @click="router.push('/dashboard')" class="btn bg-indigo-600 hover:bg-indigo-700 text-white border-none mt-6 rounded-xl font-bold">Back to dashboard</button>
            </div>

        </div>
    </div>
</template>