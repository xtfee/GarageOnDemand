<script setup>
import { ref } from 'vue';
import api from '@/api';
import { useRouter } from 'vue-router';

const form = ref({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    confirm_password: '',
    phone_number: '' // Dodano pole telefonu
});

const loading = ref(false);
const error = ref('');
const router = useRouter();

const registeredEmail = ref('');

const handleRegister = async () => {
    error.value = '';
    
    if (form.value.password !== form.value.confirm_password) {
        error.value = 'Passwords do not match!';
        return;
    }

    if (form.value.password.length < 8) {
        error.value = 'Password must be at least 8 characters long.';
        return;
    }

    loading.value = true;
    
    try {
        const dataToSend = { ...form.value };
        delete dataToSend.confirm_password;

        await api.post('accounts/register/', dataToSend);
        
        registeredEmail.value = form.value.email;
        document.getElementById('success_modal').showModal();

    } catch (err) {
        console.error(err);
        if (err.response && err.response.data) {
            const errors = err.response.data;
            if (errors.username) error.value = `Login: ${errors.username[0]}`;
            else if (errors.email) error.value = `Email: ${errors.email[0]}`;
            else if (errors.password) error.value = `Password: ${errors.password[0]}`;
            else if (errors.phone_number) error.value = `Phone: ${errors.phone_number[0]}`;
            else error.value = 'Registration error. Check your data.';
        } else {
            error.value = 'Server connection error.';
        }
    } finally {
        loading.value = false;
    }
};

const goToLogin = () => {
    router.push('/login');
};
</script>

<template>
  <div class="min-h-screen bg-slate-100 flex items-center justify-center px-4 font-sans select-none py-12">
    <div class="max-w-md w-full">
      
      <div class="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-violet-700 text-white rounded-t-[2.5rem] p-10 shadow-md text-center">
        <h1 class="text-3xl font-extrabold tracking-tight">Garage System</h1>
        <p class="text-xs font-medium tracking-wide opacity-75 mt-2 text-indigo-100">Create a new account</p>
      </div>

      <div class="bg-white rounded-b-[2.5rem] shadow-2xl border-x border-b border-slate-200">
        <form class="p-10 space-y-5" @submit.prevent="handleRegister">
          
          <div v-if="error" class="bg-red-50 border-l-4 border-red-600 text-red-700 p-4 rounded-xl flex items-center gap-3">
            <span class="text-xs font-black uppercase">{{ error }}</span>
          </div>

          <div class="form-control w-full">
            <label class="label mb-1">
              <span class="label-text font-black text-slate-400 uppercase text-[10px] tracking-widest">Username (Unique)</span>
            </label>
            <input v-model="form.username" type="text" class="input input-bordered bg-slate-50 border-2 border-slate-100 focus:border-indigo-600 rounded-2xl h-12 font-bold text-slate-900" required />
          </div>

          <div class="form-control w-full">
            <label class="label mb-1">
              <span class="label-text font-black text-slate-400 uppercase text-[10px] tracking-widest">Email Address</span>
            </label>
            <input v-model="form.email" type="email" class="input input-bordered bg-slate-50 border-2 border-slate-100 focus:border-indigo-600 rounded-2xl h-12 font-bold text-slate-900" required />
          </div>

          <div class="form-control w-full">
            <label class="label mb-1">
              <span class="label-text font-black text-slate-400 uppercase text-[10px] tracking-widest">Phone</span>
            </label>
            <input v-model="form.phone_number" type="tel" placeholder="+48..." class="input input-bordered bg-slate-50 border-2 border-slate-100 focus:border-indigo-600 rounded-2xl h-12 font-bold text-slate-900" required />
          </div>

          <div class="flex gap-4">
              <div class="form-control w-full">
                <label class="label mb-1">
                  <span class="label-text font-black text-slate-400 uppercase text-[10px] tracking-widest">First Name</span>
                </label>
                <input v-model="form.first_name" type="text" class="input input-bordered bg-slate-50 border-2 border-slate-100 focus:border-indigo-600 rounded-2xl h-12 font-bold text-slate-900" />
              </div>
              <div class="form-control w-full">
                <label class="label mb-1">
                  <span class="label-text font-black text-slate-400 uppercase text-[10px] tracking-widest">Last Name</span>
                </label>
                <input v-model="form.last_name" type="text" class="input input-bordered bg-slate-50 border-2 border-slate-100 focus:border-indigo-600 rounded-2xl h-12 font-bold text-slate-900" />
              </div>
          </div>

          <div class="form-control w-full">
            <label class="label mb-1">
              <span class="label-text font-black text-slate-400 uppercase text-[10px] tracking-widest">Password (min. 8 characters)</span>
            </label>
            <input v-model="form.password" type="password" class="input input-bordered bg-slate-50 border-2 border-slate-100 focus:border-indigo-600 rounded-2xl h-12 font-bold text-slate-900" required />
          </div>

          <div class="form-control w-full">
            <label class="label mb-1">
              <span class="label-text font-black text-slate-400 uppercase text-[10px] tracking-widest">Repeat Password</span>
            </label>
            <input v-model="form.confirm_password" type="password" class="input input-bordered bg-slate-50 border-2 border-slate-100 focus:border-indigo-600 rounded-2xl h-12 font-bold text-slate-900" required />
          </div>

          <div class="pt-4">
            <button 
              class="btn bg-indigo-600 hover:bg-indigo-700 border-none w-full h-14 rounded-2xl text-white font-black uppercase tracking-widest text-xs shadow-xl transition-all"
              :disabled="loading"
            >
              <span v-if="loading" class="loading loading-spinner"></span>
              Register
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
              Sign up with Google
            </a>
          </div>

        </form>
      </div>

      <div class="text-center mt-8">
        <RouterLink to="/login" class="text-slate-400 font-black uppercase text-[9px] tracking-[0.2em] hover:text-indigo-600 transition-colors">
          Already have an account? Log in
        </RouterLink>
      </div>

    </div>

    <dialog id="success_modal" class="modal modal-bottom sm:modal-middle">
      <div class="modal-box bg-white rounded-3xl p-8 text-center shadow-2xl border border-indigo-100">
        
        <div class="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
             <span class="text-4xl">📧</span>
        </div>

        <h3 class="font-black text-2xl uppercase italic text-slate-900 mb-2">Check Your Inbox!</h3>
        <p class="text-sm text-slate-500 font-bold mb-6">
            Your account has been created, but it requires activation.<br>
            We sent a verification link to:<br>
            <span class="text-indigo-600 font-black">{{ registeredEmail }}</span>
        </p>
        
        <div class="modal-action justify-center">
            <button @click="goToLogin" class="btn bg-indigo-600 hover:bg-indigo-700 text-white w-full rounded-2xl font-black uppercase tracking-widest shadow-xl h-12 border-none">
                Understood, go to login
            </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop bg-slate-900/50 backdrop-blur-sm">
        <button>close</button>
      </form>
    </dialog>

  </div>
</template>