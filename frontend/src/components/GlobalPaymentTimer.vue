<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import api from '@/api';

const router = useRouter();
const route = useRoute();
const pendingReservation = ref(null);
const currentTime = ref(Date.now());
const isVisible = ref(true);
let timerInterval = null;
let checkInterval = null;

const fetchPendingReservations = async () => {
    try {
        const res = await api.get('garages/reservations/');
        const reservations = res.data;

        const now = Date.now();
        const found = reservations.find(r => {
            if (r.status !== 'pending') return false;
            const deadline = new Date(r.created_at).getTime() + (15 * 60 * 1000);
            return deadline > now;
        });

        pendingReservation.value = found || null;
    } catch (err) {
        // Cicho ignorujemy
    }
};

const startTimer = () => {
    timerInterval = setInterval(() => {
        currentTime.value = Date.now();
        
        if (pendingReservation.value && timeLeft.value === null) {
            fetchPendingReservations();
        }
    }, 1000);

    checkInterval = setInterval(fetchPendingReservations, 30000);
};

const timeLeft = computed(() => {
    if (!pendingReservation.value) return null;

    const created = new Date(pendingReservation.value.created_at).getTime();
    const deadline = created + (15 * 60 * 1000);
    const diff = deadline - currentTime.value;

    if (diff <= 0) return null;

    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

const goToPayment = () => {
    if (pendingReservation.value) {
        router.push({ 
            path: `/rezerwacja/${pendingReservation.value.garage}`, 
            query: { payment_for: pendingReservation.value.id } 
        });
    }
};

watch(() => route.fullPath, () => {
    fetchPendingReservations();
});

onMounted(() => {
    fetchPendingReservations();
    startTimer();
});

onUnmounted(() => {
    clearInterval(timerInterval);
    clearInterval(checkInterval);
});
</script>

<template>
    <Transition name="slide-up">
        <div v-if="pendingReservation && timeLeft" 
             class="fixed bottom-4 right-4 z-[9999] max-w-sm w-full bg-white rounded-2xl shadow-2xl border-2 border-red-100 overflow-hidden transform transition-all hover:scale-105">
            
            <div class="bg-red-600 text-white p-3 flex justify-between items-center cursor-pointer" @click="isVisible = !isVisible">
                <div class="flex items-center gap-2">
                    <span class="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-white opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                    <span class="font-black text-xs uppercase tracking-widest ml-2 text-white">Payment required</span>
                </div>
                <button class="text-white hover:text-red-200 font-bold text-lg leading-none">
                    {{ isVisible ? '−' : '+' }}
                </button>
            </div>

            <div v-if="isVisible" class="p-5 bg-white">
                <div class="text-center mb-4">
                    <div class="text-4xl font-black text-red-600 font-mono tracking-widest tabular-nums">
                        {{ timeLeft }}
                    </div>
                    <div class="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-wider">Until reservation is canceled</div>
                </div>
                
                <div class="flex justify-between items-center bg-red-50 p-3 rounded-xl mb-4 border border-red-100">
                    <div class="text-xs font-bold text-slate-700 pl-1">
                        Reservation #{{ pendingReservation.id }}
                    </div>
                    <div class="font-black text-lg text-slate-900 pr-1">
                        {{ pendingReservation.total_price }} PLN
                    </div>
                </div>

                <button @click="goToPayment" class="btn btn-sm w-full rounded-xl font-black text-white bg-red-600 hover:bg-red-700 border-none shadow-lg shadow-red-200 animate-pulse">
                    PAY NOW →
                </button>
            </div>
        </div>
    </Transition>
</template>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease-out;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(20px);
  opacity: 0;
}
</style>