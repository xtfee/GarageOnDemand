<script setup>
import { ref } from 'vue';
import api from '@/api';
import { useRouter } from 'vue-router';

const username = ref('');
const password = ref('');
const loading = ref(false);
const error = ref('');
const router = useRouter();

const handleLogin = async () => {
    error.value = '';
    loading.value = true;
    
    try {
        const res = await api.post('accounts/login/', {
            username: username.value,
            password: password.value
        });
        
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('role', res.data.role);
        localStorage.setItem('username', res.data.username);
        
        if (res.data.role === 'admin') {
            router.push('/admin');
        } else {
            router.push('/'); 
        }

    } catch (err) {
        if (err.response && err.response.data && err.response.data.error) {
            error.value = err.response.data.error;
        } 
        else if (err.response && err.response.status === 403) {
            error.value = 'Access denied. Contact the administrator.';
        } 
        else if (!err.response) {
            error.value = 'Server connection error.';
        }
        else {
            error.value = 'Invalid login credentials.';
        }
    } finally {
        loading.value = false;
    }
};
</script>

<template>
  <div class="min-h-screen bg-slate-100 flex items-center justify-center px-4 font-sans select-none">
    <div class="max-w-md w-full">
      
      <div class="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-violet-700 text-white rounded-t-[2.5rem] p-10 shadow-md text-center">
        <h1 class="text-3xl font-extrabold tracking-tight">Garage System</h1>
        <p class="text-xs font-medium tracking-wide opacity-75 mt-2 text-indigo-100">Sign in to your account</p>
      </div>

      <div class="bg-white rounded-b-[2.5rem] shadow-2xl border-x border-b border-slate-200">
        <form class="p-10 space-y-6" @submit.prevent="handleLogin">
          
          <div v-if="error" class="bg-red-50 border-l-4 border-red-600 text-red-700 p-4 rounded-xl flex items-center gap-3">
            <span class="text-xs font-black uppercase">{{ error }}</span>
          </div>

          <div class="form-control w-full">
            <label class="label mb-1">
              <span class="label-text font-black text-slate-400 uppercase text-[10px] tracking-widest">Login</span>
            </label>
            <input 
              v-model="username" 
              type="text" 
              class="input input-bordered bg-slate-50 border-2 border-slate-100 focus:border-indigo-600 rounded-2xl h-14 font-bold text-slate-900" 
              required 
            />
          </div>

          <div class="form-control w-full">
            <label class="label mb-1">
              <span class="label-text font-black text-slate-400 uppercase text-[10px] tracking-widest">Password</span>
            </label>
            <input 
              v-model="password" 
              type="password" 
              class="input input-bordered bg-slate-50 border-2 border-slate-100 focus:border-indigo-600 rounded-2xl h-14 font-bold text-slate-900" 
              required 
            />
          </div>

          <div class="pt-4">
            <button 
              class="btn bg-indigo-600 hover:bg-indigo-700 border-none w-full h-14 rounded-2xl text-white font-black uppercase tracking-widest text-xs shadow-xl transition-all"
              :disabled="loading"
            >
              <span v-if="loading" class="loading loading-spinner"></span>
              Log in
            </button>
          </div>

          <div class="relative flex items-center py-2">
            <div class="flex-grow border-t border-slate-200"></div>
            <span class="flex-shrink-0 mx-4 text-slate-400 text-[10px] font-black uppercase tracking-widest">OR</span>
            <div class="flex-grow border-t border-slate-200"></div>
          </div>

          <div>
            <a href="http://127.0.0.1:8000/accounts/google/login/" 
               class="flex items-center justify-center gap-3 w-full h-14 bg-white border-2 border-slate-100 hover:border-slate-200 rounded-2xl text-slate-700 font-black uppercase tracking-widest text-[10px] shadow-sm transition-all cursor-pointer no-underline">
              <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" class="w-5 h-5">
              Sign in with Google
            </a>
          </div>

        </form>
      </div>

      <div class="text-center mt-8 flex flex-col gap-3">
        <RouterLink to="/register" class="text-slate-400 font-black uppercase text-[9px] tracking-[0.2em] hover:text-indigo-600 transition-colors">
          Don't have an account? Register
        </RouterLink>
        <RouterLink to="/" class="text-slate-400 font-black uppercase text-[9px] tracking-[0.2em] hover:text-indigo-600 transition-colors">
          ← Back to home page
        </RouterLink>
      </div>

    </div>
  </div>
</template>

<style scoped>
.input:focus { outline: none; }
</style>