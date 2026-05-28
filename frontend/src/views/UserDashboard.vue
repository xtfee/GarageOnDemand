<script setup>
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue';
import api from '@/api';
import { useRouter } from 'vue-router';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe('pk_test_51SfWZF2N7fFb8nJsPXXTS8tjWCb5sxgbbHMqb3YXn4JO3v9oiZkve4qhYe7hVwcNxkBcOneSXzxE6cIRud0Ibfjl00A5lxZZ1d');

const router = useRouter();
const activeTab = ref('reservations'); 
const activeSubTab = ref('active'); 
const user = ref({ 
    username: '', 
    email: '', 
    role: '', 
    first_name: '', 
    last_name: '',
    phone_number: '' // Dodano pole telefonu
});
const originalEmail = ref('');

const reservations = ref([]);
const loading = ref(true);
const profileError = ref('');

const infoModal = ref({ isOpen: false, title: '', message: '', type: 'success' });
const openInfoModal = (title, message, type = 'success') => { infoModal.value = { isOpen: true, title, message, type }; };
const closeInfoModal = () => { infoModal.value.isOpen = false; };

const currentTime = ref(Date.now());
let timerInterval = null;

const startTimer = () => {
    timerInterval = setInterval(() => {
        currentTime.value = Date.now();
    }, 1000);
};

const getPaymentTimeLeft = (createdAt) => {
    const created = new Date(createdAt).getTime();
    const deadline = created + (15 * 60 * 1000); 
    const diff = deadline - currentTime.value;

    if (diff <= 0) return null; 

    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const isExpired = (createdAt) => {
    const created = new Date(createdAt).getTime();
    const deadline = created + (15 * 60 * 1000);
    return currentTime.value > deadline;
};

watch(currentTime, () => {
    const hasJustExpired = reservations.value.some(r => 
        r.status === 'pending' && 
        isExpired(r.created_at) && 
        (new Date(r.created_at).getTime() + (15 * 60 * 1000) > (currentTime.value - 2000))
    );
    
    if (hasJustExpired) {
        fetchData();
    }
});

const currentPage = ref(1);
const itemsPerPage = 5;
const sortOption = ref('id_desc'); 
const filterStatus = ref('all'); 
const filterQuery = ref('');

const reservationStatusOptions = computed(() => {
    if (activeSubTab.value === 'active') {
        return [
            { value: 'all', label: 'All' },
            { value: 'confirmed', label: 'Confirmed' },
            { value: 'pending', label: 'Pending' }
        ];
    } else {
        return [
            { value: 'all', label: 'All' },
            { value: 'completed', label: 'Completed' },
            { value: 'cancelled', label: 'Canceled' },
            { value: 'expired', label: 'Expired' },
            { value: 'confirmed', label: 'Confirmed (Old)' } 
        ];
    }
});

watch([activeTab, activeSubTab], () => {
    currentPage.value = 1;
    filterStatus.value = 'all';
    filterQuery.value = '';
    
    if (activeTab.value === 'reservations' && activeSubTab.value === 'active') sortOption.value = 'id_desc';
    else sortOption.value = 'date_desc';
});

const passwordData = ref({ old_password: '', new_password: '', confirm_password: '' });
const passwordError = ref('');
const profilePassword = ref('');
const selectedReservation = ref(null);
const timeRemainingText = ref('');
const willRefund = ref(false);
const deleteCheckbox = ref(false);
const deletePassword = ref('');
const deleteError = ref('');
const selectedAccessCode = ref('');
const extensionType = ref('hours'); 
const extensionHours = ref(1); 
const extensionAdditionalCost = ref(0);
const extensionLoading = ref(false);
const extensionError = ref('');
const extensionStep = ref(1);
let extensionStripe = null;
let extensionElements = null;
const extensionPaymentIntentId = ref(null);

const formatDateLocal = (date) => {
    if (!date) return '';
    return date.toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const previewNewEndDate = computed(() => {
    if (!selectedReservation.value) return null;
    const currentEnd = new Date(selectedReservation.value.end_time);
    if (extensionType.value === 'day') {
        currentEnd.setDate(currentEnd.getDate() + 1);
    } else {
        const hoursToAdd = parseInt(extensionHours.value) || 1;
        currentEnd.setHours(currentEnd.getHours() + hoursToAdd);
    }
    return currentEnd;
});

const totalSpent = computed(() => {
    return reservations.value
        .filter(r => ['confirmed', 'completed', 'expired'].includes(r.status))
        .reduce((sum, r) => sum + Number(r.total_price), 0)
        .toFixed(2);
});

const totalHours = computed(() => {
     return reservations.value.filter(r => r.status !== 'cancelled').length; 
});

const sourceReservations = computed(() => {
    const now = new Date();
    
    if (activeTab.value === 'payments') {
        return reservations.value.filter(r => r.status !== 'cancelled');
    }
    
    if (activeSubTab.value === 'active') {
        return reservations.value.filter(r => 
            ['confirmed', 'pending'].includes(r.status) && 
            new Date(r.end_time) > now
        );
    } else {
        return reservations.value.filter(r => 
            ['cancelled', 'expired', 'completed'].includes(r.status) || 
            new Date(r.end_time) <= now
        );
    }
});

const processedReservations = computed(() => {
    let result = [...sourceReservations.value];

    if (filterStatus.value !== 'all') {
        if (activeTab.value === 'payments' && filterStatus.value === 'paid') {
             result = result.filter(r => ['confirmed', 'completed', 'expired'].includes(r.status));
        } else {
             result = result.filter(r => r.status === filterStatus.value);
        }
    }

    if (filterQuery.value) {
        const q = filterQuery.value.toLowerCase();
        result = result.filter(r => 
            r.total_price.includes(q) || 
            String(r.id).includes(q) ||
            (r.garage_details?.name && r.garage_details.name.toLowerCase().includes(q))
        );
    }

    result.sort((a, b) => {
        const dateA = new Date(a.start_time);
        const dateB = new Date(b.start_time);
        const priceA = Number(a.total_price);
        const priceB = Number(b.total_price);

        if (sortOption.value === 'id_desc') return b.id - a.id;
        if (sortOption.value === 'id_asc') return a.id - b.id;
        if (sortOption.value === 'date_desc') return dateB - dateA;
        if (sortOption.value === 'date_asc') return dateA - dateB;
        if (sortOption.value === 'price_desc') return priceB - priceA;
        if (sortOption.value === 'price_asc') return priceA - priceB;
        
        return 0;
    });

    return result;
});

const paginatedReservations = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage;
    return processedReservations.value.slice(start, start + itemsPerPage);
});

const totalPages = computed(() => {
    return Math.ceil(processedReservations.value.length / itemsPerPage) || 1;
});

const nextPage = () => { if (currentPage.value < totalPages.value) currentPage.value++; };
const prevPage = () => { if (currentPage.value > 1) currentPage.value--; };

const fetchData = async () => {
  try {
    const userRes = await api.get('accounts/profile/');
    user.value = userRes.data;
    originalEmail.value = userRes.data.email; 
    
    const resRes = await api.get('garages/reservations/');
    reservations.value = resRes.data;
  } catch (err) {
    if (err.response && err.response.status === 401) router.push('/login');
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
    fetchData();
    startTimer();
});

onUnmounted(() => {
    if (timerInterval) clearInterval(timerInterval);
});

const updateProfile = async () => {
  profileError.value = '';
  if (!profilePassword.value) { profileError.value = 'To save changes, you must provide your password.'; return; }
  const emailChanged = user.value.email !== originalEmail.value;
  try {
    await api.patch('accounts/profile/', {
        email: user.value.email,
        password_confirmation: profilePassword.value 
    });
    profilePassword.value = ''; 
    if (emailChanged) {
        document.getElementById('email_verification_modal').showModal();
        user.value.email = originalEmail.value; 
    } else {
        openInfoModal('Success', 'Data updated successfully!', 'success');
    }
  } catch (err) { 
      if (err.response && err.response.data && err.response.data.password_error) profileError.value = "Provided password is invalid.";
      else if (err.response && err.response.data && err.response.data.email_error) profileError.value = err.response.data.email_error;
      else profileError.value = 'An error occurred. Check your data.';
  }
};

const openChangePasswordModal = () => {
    passwordData.value = { old_password: '', new_password: '', confirm_password: '' };
    passwordError.value = '';
    document.getElementById('change_password_modal').showModal();
};

const changePassword = async () => {
    passwordError.value = '';
    if (passwordData.value.new_password !== passwordData.value.confirm_password) { passwordError.value = 'New passwords are not identical.'; return; }
    if (passwordData.value.new_password.length < 8) { passwordError.value = 'Password must have at least 8 characters.'; return; }
    try {
        await api.put('accounts/change-password/', { old_password: passwordData.value.old_password, new_password: passwordData.value.new_password });
        document.getElementById('change_password_modal').close();
        openInfoModal('Success', 'Password changed successfully!', 'success');
    } catch (err) {
        if (err.response && err.response.data) {
            if (err.response.data.old_password) passwordError.value = 'Old password is incorrect.';
            else if (err.response.data.new_password) passwordError.value = err.response.data.new_password[0];
            else passwordError.value = 'Validation error occurred.';
        } else passwordError.value = 'Server error. Try later.';
    }
};

const openCancelModal = (reservation) => {
    selectedReservation.value = reservation;
    const now = new Date();
    const start = new Date(reservation.start_time);
    const diffMs = start - now;
    const diffHours = diffMs / (1000 * 60 * 60);
    willRefund.value = diffHours > 24;
    timeRemainingText.value = diffMs <= 0 ? "Reservation started" : "Upcoming reservation";
    document.getElementById('cancel_modal').showModal();
};

const confirmCancel = async () => {
  if (!selectedReservation.value) return;
  try {
    await api.post(`garages/reservations/${selectedReservation.value.id}/emergency_cancel/`);
    fetchData();
    document.getElementById('cancel_modal').close();
    openInfoModal('Canceled', 'Reservation has been canceled.', 'info');
  } catch (err) { openInfoModal('Error', 'Failed to cancel reservation.', 'error'); }
};

const showAccessCode = (res) => {
    selectedAccessCode.value = res.access_code || 'No code';
    document.getElementById('access_code_modal').showModal();
};

const openExtendModal = (reservation) => {
    selectedReservation.value = reservation;
    extensionError.value = ''; extensionAdditionalCost.value = 0; extensionStep.value = 1; extensionType.value = 'hours'; extensionHours.value = 1;
    document.getElementById('extend_modal').showModal();
};

const initiateExtension = async () => {
    if (!previewNewEndDate.value) return;
    extensionLoading.value = true; extensionError.value = '';
    try {
        const res = await api.post(`garages/reservations/${selectedReservation.value.id}/initiate_extension/`, { new_end_time: previewNewEndDate.value.toISOString() });
        extensionAdditionalCost.value = res.data.additional_cost;
        extensionPaymentIntentId.value = res.data.paymentIntentId;
        const clientSecret = res.data.clientSecret;
        extensionStep.value = 2;
        await nextTick();
        extensionStripe = await stripePromise;
        extensionElements = extensionStripe.elements({ clientSecret, appearance: { theme: 'stripe' } });
        const paymentEl = extensionElements.create('payment');
        paymentEl.mount('#extension-payment-element');
    } catch (err) {
        if (err.response && err.response.data && err.response.data.error) extensionError.value = err.response.data.error;
        else extensionError.value = "An error occurred.";
    } finally { extensionLoading.value = false; }
};

const finalizeExtensionPayment = async () => {
    if (!extensionStripe || !extensionElements) return;
    extensionLoading.value = true; extensionError.value = '';
    const { paymentIntent, error } = await extensionStripe.confirmPayment({ elements: extensionElements, redirect: "if_required" });
    const saveToBackend = async (pIntentId) => {
        try {
            await api.post(`garages/reservations/${selectedReservation.value.id}/confirm_extension/`, {
                payment_intent_id: pIntentId,
                new_end_time: previewNewEndDate.value.toISOString(),
                additional_cost: extensionAdditionalCost.value
            });
            fetchData();
            document.getElementById('extend_modal').close();
            openInfoModal('Success', 'Reservation has been extended!', 'success');
        } catch (err) {
            if (err.response && err.response.data && err.response.data.error) extensionError.value = "Save error: " + err.response.data.error;
            else extensionError.value = "Payment succeeded, but a save error occurred.";
        }
    };
    if (error) {
        if (error.payment_intent && error.payment_intent.status === 'succeeded') await saveToBackend(error.payment_intent.id);
        else extensionError.value = error.message;
        extensionLoading.value = false;
    } 
    else if (paymentIntent && paymentIntent.status === 'succeeded') {
        await saveToBackend(paymentIntent.id);
        extensionLoading.value = false;
    }
};

const openDeleteAccountModal = () => {
    deleteCheckbox.value = false; deletePassword.value = ''; deleteError.value = '';
    document.getElementById('delete_account_modal').showModal();
};

const confirmDeleteAccount = async () => {
    deleteError.value = '';
    if (!deleteCheckbox.value || !deletePassword.value) return;
    try {
        await api.delete('accounts/delete/', { data: { password: deletePassword.value } });
        localStorage.clear();
        document.getElementById('delete_account_modal').close();
        openInfoModal('Account deleted', 'Your account has been permanently deleted.', 'info');
        setTimeout(() => router.push('/'), 2000);
    } catch(e) { 
        if (e.response && e.response.data && e.response.data.error) deleteError.value = e.response.data.error;
        else deleteError.value = 'Deletion error.'; 
    }
};

const logout = () => { localStorage.clear(); router.push('/login'); };
const goToPayment = (res) => router.push({ path: `/rezerwacja/${res.garage}`, query: { payment_for: res.id } });
</script>

<template>
  <div class="min-h-screen bg-slate-50 pt-24 pb-12 px-4">
    <div class="max-w-5xl mx-auto">
      
      <div class="flex flex-col md:flex-row justify-between items-end mb-10 gap-6">
        <div>
          <h1 class="text-4xl font-extrabold text-slate-900 tracking-tight">Client Dashboard</h1>
          <div class="mt-2">
              <p class="text-gray-500 font-bold uppercase text-xs tracking-widest">
                  Logged in as: <span class="text-indigo-600">{{ user.username }}</span>
              </p>
              <p class="text-gray-400 font-bold text-[10px] uppercase tracking-wider mt-1">
                  {{ user.email }}
              </p>
          </div>
        </div>
        <div class="flex flex-wrap gap-4 w-full md:w-auto justify-end">
            <div class="bg-white px-6 py-3 rounded-2xl shadow-sm border border-slate-100 text-center flex-1 md:flex-none">
                <div class="text-[10px] text-slate-400 font-black uppercase tracking-widest">Spent funds</div>
                <div class="text-xl font-black text-indigo-600">{{ totalSpent }} EUR</div>
            </div>
            <div class="bg-white px-6 py-3 rounded-2xl shadow-sm border border-slate-100 text-center flex-1 md:flex-none">
                <div class="text-[10px] text-slate-400 font-black uppercase tracking-widest">Reservations</div>
                <div class="text-xl font-black text-slate-800">{{ totalHours }}</div>
            </div>
        </div>
        <button @click="logout" class="btn btn-ghost text-red-500 font-bold uppercase text-xs self-end">Log out</button>
      </div>

      <div class="flex gap-4 mb-8 border-b border-gray-200 overflow-x-auto">
        <button @click="activeTab='reservations'" :class="activeTab==='reservations' ? 'border-indigo-600 text-indigo-600' : 'text-gray-400'" class="pb-4 px-4 font-black uppercase italic border-b-4 transition-colors whitespace-nowrap">My Reservations</button>
        <button @click="activeTab='payments'" :class="activeTab==='payments' ? 'border-indigo-600 text-indigo-600' : 'text-gray-400'" class="pb-4 px-4 font-black uppercase italic border-b-4 transition-colors whitespace-nowrap">Payments</button>
        <button @click="activeTab='settings'" :class="activeTab==='settings' ? 'border-indigo-600 text-indigo-600' : 'text-gray-400'" class="pb-4 px-4 font-black uppercase italic border-b-4 transition-colors whitespace-nowrap">Settings</button>
      </div>

      <div v-if="activeTab === 'reservations'" class="space-y-6">
        <div class="flex justify-between items-center bg-slate-100 p-2 rounded-2xl w-fit">
            <div class="flex gap-2">
                <button @click="activeSubTab='active'" :class="activeSubTab==='active' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'" class="px-6 py-2 rounded-xl text-xs font-black uppercase transition-all">Upcoming</button>
                <button @click="activeSubTab='history'" :class="activeSubTab==='history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'" class="px-6 py-2 rounded-xl text-xs font-black uppercase transition-all">History</button>
            </div>
        </div>

        <div class="flex flex-wrap gap-4 items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div class="flex items-center gap-2">
                <span class="text-[10px] font-black uppercase text-slate-400 tracking-widest hidden sm:inline-block">Sort:</span>
                <select v-model="sortOption" class="select select-sm select-bordered rounded-lg text-xs font-bold bg-slate-50 pr-8 w-auto">
                    <option value="id_desc">ID (Newest added)</option>
                    <option value="id_asc">ID (Oldest)</option>
                    <option value="date_desc">Date (Newest)</option>
                    <option value="date_asc">Date (Oldest)</option>
                    <option value="price_desc">Price (Descending)</option>
                    <option value="price_asc">Price (Ascending)</option>
                </select>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-[10px] font-black uppercase text-slate-400 tracking-widest hidden sm:inline-block">Status:</span>
                <select v-model="filterStatus" class="select select-sm select-bordered rounded-lg text-xs font-bold bg-slate-50 pr-8 w-auto">
                    <option v-for="option in reservationStatusOptions" :key="option.value" :value="option.value">
                        {{ option.label }}
                    </option>
                </select>
            </div>
            <div class="ml-auto text-xs font-bold text-slate-400">
                Results: {{ processedReservations.length }}
            </div>
        </div>

        <div v-if="loading" class="text-center py-10">Loading...</div>

        <div v-else>
             <div v-if="paginatedReservations.length === 0" class="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-300">
                <p class="text-gray-400 font-bold mb-4">No reservations match the criteria.</p>
                <button v-if="activeSubTab === 'active' && filterStatus === 'all'" @click="router.push('/oferta')" class="btn btn-sm bg-indigo-600 hover:bg-indigo-700 text-white border-none rounded-xl font-bold shadow-lg">Reserve a Garage</button>
             </div>

             <div v-else class="grid gap-4">
                <div v-for="res in paginatedReservations" :key="res.id" 
                     :class="['p-6 shadow-lg rounded-3xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all',
                        activeSubTab === 'history' ? 'bg-slate-50 border-slate-200 opacity-90' : 'bg-white border-slate-100']">
                    
                    <div class="w-full md:w-auto">
                        <div class="flex items-center gap-2">
                             <h3 class="font-black text-xl uppercase italic text-slate-700">#{{ res.id }}</h3>
                             <span v-if="res.status === 'confirmed'" class="badge badge-success text-white font-bold text-[10px]">CONFIRMED</span>
                             <span v-else-if="res.status === 'pending'" class="badge badge-warning text-white font-bold text-[10px]">PENDING</span>
                             <span v-else-if="res.status === 'cancelled'" class="badge badge-error text-white font-bold text-[10px]">CANCELED</span>
                             <span v-else class="badge badge-ghost font-bold text-[10px] uppercase">{{ res.status }}</span>
                        </div>
                        <p class="text-xs text-gray-400 font-bold uppercase mt-1">{{ res.garage_details ? res.garage_details.name : 'Garage' }}</p>
                        <p class="text-sm font-bold text-slate-700 mt-2 bg-white border border-slate-100 p-2 rounded-lg inline-block shadow-sm">
                            📅 {{ new Date(res.start_time).toLocaleString() }} 
                            <span class="mx-2 text-slate-300">|</span> 
                            🏁 {{ new Date(res.end_time).toLocaleString() }}
                        </p>
                    </div>

                    <div class="flex flex-col md:flex-row items-end md:items-center gap-4 w-full md:w-auto">
                        <div class="text-right mr-2">
                            <span class="font-black text-indigo-600 text-xl">{{ res.total_price }} EUR</span>
                            
                            <div v-if="res.status === 'pending'" class="mt-2 flex flex-col items-end gap-1">
                                <div v-if="!isExpired(res.created_at)" class="flex flex-col items-end">
                                    <div class="text-xs font-bold text-red-500 animate-pulse">
                                        ⏳ Time left to pay: {{ getPaymentTimeLeft(res.created_at) }}
                                    </div>
                                    <button @click="goToPayment(res)" class="btn btn-xs bg-indigo-600 hover:bg-indigo-700 text-white border-none w-full rounded-md shadow-lg">Pay</button>
                                </div>
                                <div v-else class="text-xs font-bold text-gray-400">
                                    Time is up. Refreshing...
                                </div>
                            </div>
                        </div>

                        <div v-if="activeSubTab === 'active' && res.status !== 'cancelled' && res.status !== 'expired'" class="flex gap-2">
                            <button v-if="res.status === 'confirmed'" @click="showAccessCode(res)" class="btn btn-square btn-ghost border-slate-200 hover:bg-yellow-50 hover:border-yellow-200 text-yellow-600 rounded-xl" title="Show access code">
                                <span class="text-xl">🔑</span>
                            </button>
                            <button v-if="res.status === 'confirmed'" @click="openExtendModal(res)" class="btn btn-neutral btn-outline rounded-xl font-bold uppercase text-xs">
                                Extend
                            </button>
                            <button @click="openCancelModal(res)" class="btn btn-error btn-outline rounded-xl font-bold uppercase text-xs">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
             </div>

             <div v-if="totalPages > 1" class="flex justify-center items-center gap-4 mt-8 pb-8">
                <button @click="prevPage" :disabled="currentPage === 1" class="btn btn-sm btn-ghost font-bold text-slate-500 disabled:text-slate-300">← Previous</button>
                <span class="text-xs font-black uppercase text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg">Page {{ currentPage }} of {{ totalPages }}</span>
                <button @click="nextPage" :disabled="currentPage === totalPages" class="btn btn-sm btn-ghost font-bold text-slate-500 disabled:text-slate-300">Next →</button>
             </div>
        </div>
      </div>

      <div v-if="activeTab === 'payments'" class="space-y-6">
          <div class="bg-indigo-600 text-white p-8 rounded-3xl shadow-xl flex justify-between items-center relative overflow-hidden">
             <div class="relative z-10">
                 <h2 class="text-3xl font-black italic uppercase tracking-tighter">Your Wallet</h2>
             </div>
             <div class="text-right relative z-10">
                 <div class="text-xs font-bold uppercase opacity-60">Spent</div>
                 <div class="text-4xl font-black">{{ totalSpent }} <span class="text-lg">EUR</span></div>
             </div>
          </div>

          <div class="flex flex-wrap gap-4 items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div class="flex items-center gap-2">
                    <span class="text-[10px] font-black uppercase text-slate-400 tracking-widest hidden sm:inline-block">Sort:</span>
                    <select v-model="sortOption" class="select select-sm select-bordered rounded-lg text-xs font-bold bg-slate-50 pr-8 w-auto">
                        <option value="date_desc">Newest</option>
                        <option value="date_asc">Oldest</option>
                        <option value="price_desc">Highest amount</option>
                        <option value="price_asc">Lowest amount</option>
                    </select>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-[10px] font-black uppercase text-slate-400 tracking-widest hidden sm:inline-block">Status:</span>
                    <select v-model="filterStatus" class="select select-sm select-bordered rounded-lg text-xs font-bold bg-slate-50 pr-8 w-auto">
                        <option value="all">All</option>
                        <option value="paid">Paid</option>
                        <option value="pending">To pay</option>
                    </select>
                </div>
                <div class="form-control w-full sm:w-auto flex-1 max-w-xs ml-auto">
                    <input v-model="filterQuery" type="text" placeholder="Search (Amount, ID...)" class="input input-sm input-bordered rounded-lg font-bold bg-slate-50 w-full" />
                </div>
          </div>

          <div class="card bg-white rounded-3xl shadow-lg border border-slate-100 overflow-x-auto">
              <table class="table w-full min-w-[600px]">
                  <thead class="bg-slate-50 text-slate-400 font-black uppercase text-[10px] tracking-widest">
                      <tr><th class="p-5">Transaction Date</th><th>Description / Garage</th><th>Status</th><th class="text-right p-5">Amount</th></tr>
                  </thead>
                  <tbody class="text-sm font-bold text-slate-700 divide-y divide-slate-50">
                      <tr v-for="res in paginatedReservations" :key="res.id" class="hover:bg-indigo-50/30 transition-colors">
                          <td class="p-5">{{ new Date(res.created_at || res.start_time).toLocaleDateString() }} <span class="text-xs font-normal text-gray-400 block">{{ new Date(res.created_at || res.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }}</span></td>
                          <td>
                              <div class="font-bold text-slate-800">Reservation #{{ res.id }}</div>
                              <div class="text-xs text-gray-400 uppercase font-bold">{{ res.garage_details?.name || 'Garage' }}</div>
                          </td>
                          <td>
                              <div v-if="['confirmed','completed','expired'].includes(res.status)" class="badge badge-success text-white font-bold text-[10px] uppercase">Paid</div>
                              <div v-else-if="res.status === 'pending'" class="flex items-center gap-2">
                                  <span class="badge badge-warning text-white font-bold text-[10px] uppercase">Pending</span>
                                  <button @click="goToPayment(res)" class="btn btn-xs bg-indigo-600 hover:bg-indigo-700 text-white border-none rounded-lg">Pay now</button>
                              </div>
                          </td>
                          <td class="text-right p-5 font-black text-indigo-600">{{ res.total_price }} EUR</td>
                      </tr>
                      <tr v-if="paginatedReservations.length === 0">
                          <td colspan="4" class="text-center py-10 text-gray-400 font-bold">No transactions match the criteria.</td>
                      </tr>
                  </tbody>
              </table>
          </div>

          <div v-if="totalPages > 1" class="flex justify-center items-center gap-4 mt-4 pb-8">
                <button @click="prevPage" :disabled="currentPage === 1" class="btn btn-sm btn-ghost font-bold text-slate-500 disabled:text-slate-300">← Previous</button>
                <span class="text-xs font-black uppercase text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg">Page {{ currentPage }} of {{ totalPages }}</span>
                <button @click="nextPage" :disabled="currentPage === totalPages" class="btn btn-sm btn-ghost font-bold text-slate-500 disabled:text-slate-300">Next →</button>
          </div>
      </div>

      <div v-if="activeTab === 'settings'" class="grid gap-6 md:grid-cols-2">
         
         <div class="card bg-white p-8 rounded-3xl shadow-lg border border-slate-100 h-fit">
            <h3 class="font-black text-xl mb-6 uppercase italic flex items-center gap-2">
                <span class="text-indigo-600">👤</span> Profile Editing
            </h3>
            
            <div class="form-control mb-6">
                <label class="label font-bold text-xs uppercase text-gray-400 mb-3">Username (Login)</label>
                <input v-model="user.username" disabled class="input input-bordered w-full pl-4 bg-slate-100 border-slate-200 rounded-xl text-slate-500 cursor-not-allowed font-bold" />
            </div>

            <div class="grid grid-cols-2 gap-6 mb-6">
                <div class="form-control">
                    <label class="label font-bold text-xs uppercase text-gray-400 mb-3">First Name</label>
                    <input v-model="user.first_name" disabled class="input input-bordered w-full pl-4 bg-slate-100 border-slate-200 rounded-xl text-slate-500 cursor-not-allowed font-bold" />
                </div>
                <div class="form-control">
                    <label class="label font-bold text-xs uppercase text-gray-400 mb-3">Last Name</label>
                    <input v-model="user.last_name" disabled class="input input-bordered w-full pl-4 bg-slate-100 border-slate-200 rounded-xl text-slate-500 cursor-not-allowed font-bold" />
                </div>
            </div>

            <div class="form-control mb-6">
                <label class="label font-bold text-xs uppercase text-gray-400 mb-3">Phone Number</label>
                <input v-model="user.phone_number" disabled class="input input-bordered w-full pl-4 bg-slate-100 border-slate-200 rounded-xl text-slate-500 cursor-not-allowed font-bold" />
            </div>

            <div class="form-control mb-8">
                <label class="label font-bold text-xs uppercase text-gray-400 mb-3">Email (change requires verification)</label>
                <input v-model="user.email" type="email" class="input input-bordered w-full pl-4 bg-white border border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 rounded-xl transition-all" />
            </div>

            <div class="form-control mb-8">
                <label class="label font-bold text-xs uppercase text-gray-400 mb-3">Enter password to save changes</label>
                <input v-model="profilePassword" type="password" placeholder="Your password..." class="input input-bordered w-full pl-4 bg-white border border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 rounded-xl transition-all" />
            </div>

            <div v-if="profileError" class="text-red-500 text-xs font-bold text-center mb-4">{{ profileError }}</div>

            <button @click="updateProfile" :disabled="!profilePassword" class="btn bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black uppercase w-full disabled:bg-slate-300">
                Save changes
            </button>
         </div>

         <div class="flex flex-col gap-6">
             <div class="card bg-slate-50 p-8 rounded-3xl border border-slate-200 h-fit">
                <h3 class="font-black text-xl mb-4 uppercase italic flex items-center gap-2">
                    <span>🔒</span> Security
                </h3>
                <p class="text-xs text-slate-500 mb-6 font-medium">We recommend changing your password regularly to keep your account secure.</p>
                <button @click="openChangePasswordModal" class="btn bg-white border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300 rounded-xl font-bold uppercase w-full shadow-sm">
                    Change password
                </button>
             </div>

             <div class="card bg-red-50 p-8 rounded-3xl border border-red-100 h-fit mt-auto">
                <h3 class="font-black text-red-600 uppercase italic">Danger Zone</h3>
                <p class="text-xs text-red-400 mb-4 font-bold mt-2">Account deletion is irreversible.</p>
                <button @click="openDeleteAccountModal" class="btn btn-error btn-outline rounded-xl font-bold uppercase w-full">
                    Delete account
                </button>
             </div>
         </div>
      </div>

    </div>

    <Transition name="fade">
        <div v-if="infoModal.isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div class="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-sm w-full text-center border-4 border-indigo-50 transform transition-all scale-100">
                <div class="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm" :class="infoModal.type === 'success' ? 'bg-green-100 text-green-600' : (infoModal.type === 'error' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600')">
                    <span class="text-4xl font-black">{{ infoModal.type === 'success' ? '✓' : (infoModal.type === 'error' ? '✕' : 'i') }}</span>
                </div>
                <h3 class="text-2xl font-black uppercase italic text-slate-900 mb-2 tracking-wide">{{ infoModal.title }}</h3>
                <p class="text-slate-500 font-bold text-sm mb-8 leading-relaxed">{{ infoModal.message }}</p>
                <button @click="closeInfoModal" class="btn btn-wide bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg">OK</button>
            </div>
        </div>
    </Transition>

    <dialog id="email_verification_modal" class="modal modal-bottom sm:modal-middle backdrop-blur-sm"> 
        <div class="modal-box bg-white rounded-3xl p-8 border border-indigo-100 text-center">
            <div class="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span class="text-3xl">📧</span>
            </div>
            <h3 class="font-black text-2xl uppercase italic text-indigo-900 mb-2">Check your inbox!</h3>
            <p class="text-sm text-slate-500 font-medium mb-6">
                We sent an activation link to your new email address.<br>
                <strong>The change will apply only after you click the link.</strong><br>
                Until then, your old email remains active.
            </p>
            <div class="modal-action justify-center">
                <form method="dialog">
                    <button class="btn bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black uppercase px-8 shadow-lg">I understand</button>
                </form>
            </div>
        </div>
        <form method="dialog" class="modal-backdrop"><button>close</button></form>
    </dialog>

    <dialog id="access_code_modal" class="modal modal-bottom sm:modal-middle">
        <div class="modal-box bg-white rounded-3xl p-8 text-center border border-yellow-200">
            <div class="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span class="text-3xl">🔑</span>
            </div>
            <h3 class="font-black text-slate-400 uppercase text-xs tracking-widest mb-2">Your access code</h3>
            <div class="bg-slate-900 text-white text-4xl font-mono font-black py-6 rounded-xl tracking-widest select-all cursor-pointer hover:bg-slate-800 transition-colors shadow-lg">
                {{ selectedAccessCode }}
            </div>
            <p class="text-xs text-gray-400 mt-4">Enter this code on the keypad at the entrance.</p>
            <div class="modal-action justify-center">
                <form method="dialog"><button class="btn btn-ghost font-bold text-slate-500">Close</button></form>
            </div>
        </div>
        <form method="dialog" class="modal-backdrop"><button>close</button></form>
    </dialog>

    <dialog id="cancel_modal" class="modal modal-bottom sm:modal-middle">
        <div class="modal-box bg-white rounded-3xl p-8">
            <h3 class="font-black text-2xl uppercase italic mb-4">Cancellation</h3>
            <p>{{ timeRemainingText }}</p>
            <p v-if="willRefund" class="text-green-600 font-bold">We will issue a refund.</p>
            <p v-else class="text-red-600 font-bold">No refund (less than 24h).</p>
            <div class="modal-action">
                <form method="dialog"><button class="btn btn-ghost">Back</button></form>
                <button @click="confirmCancel" class="btn bg-red-600 text-white rounded-xl">Confirm</button>
            </div>
        </div>
    </dialog>

    <dialog id="extend_modal" class="modal modal-bottom sm:modal-middle">
        <div class="modal-box bg-white rounded-3xl p-8 w-11/12 max-w-2xl border border-indigo-100">
            <h3 class="font-black text-2xl uppercase italic text-slate-900 mb-2">Extend Reservation</h3>
            <p v-if="selectedReservation" class="text-xs text-gray-400 font-bold uppercase mb-6">
                Current end: <span class="text-slate-800">{{ new Date(selectedReservation.end_time).toLocaleString() }}</span>
            </p>

            <div v-if="extensionStep === 1">
                <div class="form-control mb-4">
                    <label class="label cursor-pointer justify-start gap-4 border border-slate-200 p-4 rounded-xl hover:border-indigo-300 transition-colors">
                        <input type="radio" name="extension_type" value="hours" v-model="extensionType" class="radio radio-primary" />
                        <span class="label-text font-bold text-slate-700">Extend by hours</span>
                    </label>
                </div>

                <div v-if="extensionType === 'hours'" class="form-control mb-6 pl-10">
                    <label class="label font-bold text-xs uppercase text-gray-400">Number of hours</label>
                    <div class="flex items-center gap-4">
                        <button @click="extensionHours > 1 ? extensionHours-- : null" class="btn btn-square btn-ghost border-slate-200 bg-white text-slate-400 hover:border-indigo-300 hover:text-indigo-600 rounded-xl transition-all" :disabled="extensionHours <= 1"><span class="text-xl font-black">−</span></button>
                        <input type="number" min="1" v-model="extensionHours" class="input input-bordered w-24 rounded-xl text-center font-black text-2xl bg-indigo-50 border-indigo-100 text-indigo-900 focus:bg-white focus:border-indigo-500 transition-all appearance-none m-0" />
                        <button @click="extensionHours++" class="btn btn-square btn-ghost border-slate-200 bg-white text-slate-400 hover:border-indigo-300 hover:text-indigo-600 rounded-xl transition-all"><span class="text-xl font-black">+</span></button>
                    </div>
                </div>

                <div class="form-control mb-6">
                    <label class="label cursor-pointer justify-start gap-4 border border-slate-200 p-4 rounded-xl hover:border-indigo-300 transition-colors">
                        <input type="radio" name="extension_type" value="day" v-model="extensionType" class="radio radio-primary" />
                        <span class="label-text font-bold text-slate-700">Extend by one day (24h)</span>
                    </label>
                </div>

                <div class="alert alert-info bg-indigo-50 text-indigo-800 text-xs font-bold rounded-xl mb-6">New end time: {{ formatDateLocal(previewNewEndDate) }}</div>
                <div v-if="extensionError" class="alert alert-error text-sm mb-4 rounded-xl font-bold">{{ extensionError }}</div>
                
                <div class="modal-action justify-between">
                    <form method="dialog"><button class="btn btn-ghost font-bold text-gray-400">Cancel</button></form>
                    <button @click="initiateExtension" :disabled="extensionLoading" class="btn bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black uppercase px-8 py-3 h-auto min-h-[3rem] text-sm"><span v-if="extensionLoading" class="loading loading-spinner"></span><span v-else>Go to payment →</span></button>
                </div>
            </div>

            <div v-if="extensionStep === 2">
                <div class="bg-indigo-50 p-4 rounded-xl border border-indigo-100 mb-6 flex justify-between items-center"><span class="text-xs font-bold text-indigo-400 uppercase">Amount due</span><span class="font-black text-2xl text-indigo-700">{{ extensionAdditionalCost }} EUR</span></div>
                <div id="extension-payment-element" class="min-h-[200px] mb-6"></div>
                <div v-if="extensionError" class="alert alert-error text-sm mb-4 rounded-xl font-bold">{{ extensionError }}</div>
                <div class="modal-action justify-between">
                    <button @click="extensionStep = 1" class="btn btn-ghost font-bold text-gray-400">← Back</button>
                    <button @click="finalizeExtensionPayment" :disabled="extensionLoading" class="btn bg-green-600 hover:bg-green-700 text-white rounded-xl font-black uppercase w-1/2"><span v-if="extensionLoading" class="loading loading-spinner"></span><span v-else>Pay and Extend</span></button>
                </div>
            </div>
        </div>
        <form method="dialog" class="modal-backdrop"><button>close</button></form>
    </dialog>

    <dialog id="change_password_modal" class="modal modal-bottom sm:modal-middle backdrop-blur-sm">
        <div class="modal-box p-0 overflow-hidden bg-white shadow-2xl rounded-3xl w-full max-w-lg border border-slate-100">
            <div class="bg-indigo-50 p-6 flex items-center gap-4 border-b border-indigo-100">
                <div class="bg-indigo-100 p-3 rounded-full text-indigo-600 shadow-sm"><span class="text-xl">🔐</span></div>
                <h3 class="text-xl font-black text-indigo-900 uppercase tracking-widest">Password Change</h3>
            </div>

            <div class="p-8 space-y-6">
                <div class="form-control">
                    <label class="label font-bold text-[10px] uppercase text-slate-400 tracking-wider mb-3">Old password</label>
                    <input v-model="passwordData.old_password" type="password" class="input input-bordered w-full pl-4 bg-white border border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 rounded-xl transition-all" />
                </div>
                <hr class="border-slate-100">
                <div class="form-control">
                    <label class="label font-bold text-[10px] uppercase text-slate-400 tracking-wider mb-3">New password</label>
                    <input v-model="passwordData.new_password" type="password" class="input input-bordered w-full pl-4 bg-white border border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 rounded-xl transition-all" />
                </div>
                <div class="form-control">
                    <label class="label font-bold text-[10px] uppercase text-slate-400 tracking-wider mb-3">Confirm new password</label>
                    <input v-model="passwordData.confirm_password" type="password" class="input input-bordered w-full pl-4 bg-white border border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 rounded-xl transition-all" />
                </div>
                <div v-if="passwordError" class="text-red-500 text-xs font-bold text-center bg-red-50 py-2 rounded-lg border border-red-100">{{ passwordError }}</div>
                <div class="modal-action flex justify-between pt-2">
                    <form method="dialog"><button class="btn btn-ghost font-bold text-slate-400 hover:text-slate-600 rounded-xl">Cancel</button></form>
                    <button @click="changePassword" class="btn bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black uppercase px-8 shadow-lg shadow-indigo-200">Change password</button>
                </div>
            </div>
        </div>
        <form method="dialog" class="modal-backdrop"><button>close</button></form>
    </dialog>

    <dialog id="delete_account_modal" class="modal modal-bottom sm:modal-middle backdrop-blur-sm"> 
        <div class="modal-box p-0 overflow-hidden bg-white shadow-2xl rounded-3xl w-full max-w-lg">
            <div class="bg-red-50 p-6 flex flex-col items-center justify-center border-b border-red-100">
                <div class="bg-red-100 p-4 rounded-full mb-3 text-red-600 shadow-sm"><span class="text-2xl">🗑️</span></div>
                <h3 class="text-xl font-black text-red-900 uppercase tracking-widest">Account Deletion</h3>
            </div>
            <div class="p-8 space-y-6">
                <p class="text-slate-500 text-sm font-medium text-center leading-relaxed">Are you sure you want to delete your account? This action cannot be undone.</p>
                <div class="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex gap-3 items-start">
                    <span class="text-xl">⚠️</span>
                    <span class="text-xs font-bold text-yellow-800 mt-1">Reservation history will remain in the system (anonymized).</span>
                </div>
                <label class="flex items-center gap-4 p-4 border border-slate-200 rounded-xl cursor-pointer transition-all hover:border-red-300 hover:bg-red-50/30 group">
                    <input type="checkbox" v-model="deleteCheckbox" class="checkbox checkbox-error" />
                    <span class="label-text font-bold text-slate-600 text-xs group-hover:text-slate-800 transition-colors">I understand the risk and want to permanently delete my account.</span>
                </label>
                <div class="form-control">
                    <label class="label font-bold text-[10px] uppercase text-slate-400 tracking-wider mb-3">Confirm with password</label>
                    <input v-model="deletePassword" type="password" placeholder="Enter your password..." class="input input-bordered w-full pl-4 bg-white border border-slate-300 focus:border-red-500 focus:ring-4 focus:ring-red-100 rounded-xl transition-all" />
                </div>
                <div v-if="deleteError" class="text-red-600 text-xs font-bold text-center bg-red-50 py-2 rounded-lg border border-red-100">{{ deleteError }}</div>
                <div class="modal-action flex justify-between gap-4 mt-8 pt-4 border-t border-slate-100">
                    <form method="dialog" class="w-1/3"><button class="btn btn-ghost w-full font-bold text-slate-500 hover:bg-slate-100 rounded-xl">Cancel</button></form>
                    <button @click="confirmDeleteAccount" :disabled="!deleteCheckbox || !deletePassword" class="btn bg-red-600 hover:bg-red-700 text-white w-2/3 rounded-xl font-black uppercase tracking-wider disabled:bg-slate-200 disabled:text-slate-400 shadow-lg shadow-red-200">Delete permanently</button>
                </div>
            </div>
        </div>
        <form method="dialog" class="modal-backdrop"><button>close</button></form>
    </dialog>

    <dialog id="delete_success_modal" class="modal">
        <div class="modal-box bg-white rounded-3xl p-8 text-center"><h3 class="font-black">Deleted!</h3><button @click="finalizeDelete" class="btn bg-indigo-600 hover:bg-indigo-700 text-white border-none mt-4">OK</button></div>
    </dialog>

  </div>
</template>

<style scoped>
input[type=number]::-webkit-inner-spin-button, 
input[type=number]::-webkit-outer-spin-button { 
  -webkit-appearance: none; 
  margin: 0; 
}
input[type=number] {
  -moz-appearance: textfield;
}

.dp-custom-input {
    background-color: #f8fafc !important; 
    border: 1px solid #e2e8f0 !important;
    border-radius: 0.75rem !important; 
    font-weight: 700 !important;
    color: #1e293b !important; 
    padding: 0.75rem !important;
}

/* Animacja dla Popupa Sukcesu */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>