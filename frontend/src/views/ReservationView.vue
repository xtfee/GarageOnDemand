<script setup>
import { ref, onMounted, computed, nextTick, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '@/api';
import { loadStripe } from '@stripe/stripe-js';

// Rejestracja globalna w main.js

const stripePromise = loadStripe('pk_test_51SfWZF2N7fFb8nJsPXXTS8tjWCb5sxgbbHMqb3YXn4JO3v9oiZkve4qhYe7hVwcNxkBcOneSXzxE6cIRud0Ibfjl00A5lxZZ1d');

const route = useRoute();
const router = useRouter();
const garageId = route.params.id;

const garage = ref(null);
const loading = ref(true);
const step = ref(1); 
const errorMessage = ref('');
const isProcessing = ref(false);

// --- OBSŁUGA LIMITÓW I KOLIZJI (MODAL) ---
const showLimitModal = ref(false);
const limitErrorMsg = ref('');
const modalTitle = ref('Limit Reached!'); 
const maxReservationDays = ref(7); // Domyślnie 7, ale zaktualizujemy z API

const startDate = ref("");
const endDate = ref("");
const startTime = ref({ hours: 8, minutes: 0 }); 
const endTime = ref({ hours: 16, minutes: 0 });
const reservationId = ref(null);
const existingReservationPrice = ref(null);

const currentMonth = ref(new Date().getMonth());
const currentYear = ref(new Date().getFullYear());

const busyHoursForSelectedDate = ref([]); 

// --- ZMIENNE DRAG & DROP ---
const isDraggingTime = ref(false);
const dragStartTime = ref(null);
const isDraggingCalendar = ref(false);
const dragStartDateObj = ref(null);

let stripe = null;
let elements = null;

const formatDateLocal = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatTimeObj = (timeObj) => {
    if (!timeObj) return "00:00";
    const h = String(timeObj.hours).padStart(2, '0');
    const m = String(timeObj.minutes).padStart(2, '0');
    return `${h}:${m}`;
};

const isSingleDay = computed(() => {
    return startDate.value === endDate.value;
});

const fetchAvailability = async (dateStr) => {
    try {
        const res = await api.get(`garages/list/${garageId}/check_availability/?date=${dateStr}`);
        busyHoursForSelectedDate.value = res.data.busy_hours;

        if (busyHoursForSelectedDate.value.length === 0) {
            startTime.value = { hours: 0, minutes: 0 };
            endTime.value = { hours: 24, minutes: 0 };
        } else {
            let start = 0;
            while (busyHoursForSelectedDate.value.includes(start) && start < 23) start++;
            startTime.value = { hours: start, minutes: 0 };
            endTime.value = { hours: Math.min(start + 8, 24), minutes: 0 };
        }
    } catch (err) {
        console.error("Błąd dostępności:", err);
    }
};

watch([startDate, endDate], ([newStart, newEnd]) => {
    if (route.query.payment_for) return;

    if (newStart === newEnd) {
        fetchAvailability(newStart);
    } else {
        startTime.value = { hours: 0, minutes: 0 };
        endTime.value = { hours: 24, minutes: 0 };
    }
}, { immediate: true });


const resumePayment = async (existingId) => {
    loading.value = true;
    try {
        const res = await api.get(`garages/reservations/${existingId}/`);
        const reservationData = res.data;

        reservationId.value = reservationData.id;
        existingReservationPrice.value = reservationData.total_price;
        
        const start = new Date(reservationData.start_time);
        const end = new Date(reservationData.end_time);
        
        startDate.value = formatDateLocal(start);
        endDate.value = formatDateLocal(end);
        
        startTime.value = { hours: start.getHours(), minutes: start.getMinutes() };
        endTime.value = { hours: end.getHours(), minutes: end.getMinutes() };

        step.value = 2;
        
        const intentRes = await api.post(`create-payment-intent/${reservationId.value}/`);
        const clientSecret = intentRes.data.clientSecret;

        await nextTick();

        stripe = await stripePromise;
        elements = stripe.elements({ clientSecret, appearance: { theme: 'stripe' } });
        const paymentElement = elements.create('payment');
        paymentElement.mount('#payment-element');

    } catch (err) {
        console.error("Błąd wznawiania płatności:", err);
        errorMessage.value = "Failed to load reservation for payment.";
        step.value = 1; 
    } finally {
        loading.value = false;
    }
};


onMounted(async () => {
  try {
    // 1. Pobierz dane garażu
    const res = await api.get(`garages/list/${garageId}/`);
    garage.value = res.data;

    // 2. NOWE: Pobierz konfigurację systemu (limity dni)
    try {
        const configRes = await api.get('garages/system-config/');
        if (configRes.data && configRes.data.max_reservation_days) {
            maxReservationDays.value = configRes.data.max_reservation_days;
            console.log("Załadowano limit dni z serwera:", maxReservationDays.value);
        }
    } catch (cfgErr) {
        console.warn("Nie udało się pobrać konfiguracji, używam domyślnej:", cfgErr);
    }

    const existingId = route.query.payment_for;
    
    if (existingId) {
        await resumePayment(existingId);
    } else {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = formatDateLocal(tomorrow);
        startDate.value = tomorrowStr;
        endDate.value = tomorrowStr;
        loading.value = false;
    }
    
    window.addEventListener('mouseup', () => {
        stopDragTime();
        stopDragCalendar();
    });
  } catch (err) {
    console.error("Błąd:", err);
    loading.value = false;
  }
});

const garageEquipmentNames = computed(() => {
    if (!garage.value || !garage.value.equipment) return [];
    return garage.value.equipment.map(eq => eq.name);
});

// --- LOGIKA KALENDARZA ---
const daysInMonth = computed(() => {
    const date = new Date(currentYear.value, currentMonth.value, 1);
    const days = [];
    while (date.getMonth() === currentMonth.value) {
        days.push(new Date(date));
        date.setDate(date.getDate() + 1);
    }
    return days;
});

const monthName = computed(() => {
    return new Date(currentYear.value, currentMonth.value).toLocaleString('en-US', { month: 'long', year: 'numeric' });
});

const changeMonth = (delta) => {
    let newMonth = currentMonth.value + delta;
    if (newMonth > 11) { currentMonth.value = 0; currentYear.value++; }
    else if (newMonth < 0) { currentMonth.value = 11; currentYear.value--; }
    else { currentMonth.value = newMonth; }
};

const isInRange = (date) => {
    if (!startDate.value || !endDate.value) return false;
    const start = new Date(startDate.value).setHours(0,0,0,0);
    const end = new Date(endDate.value).setHours(0,0,0,0);
    const current = date.setHours(0,0,0,0);
    return current >= start && current <= end;
};

// DRAG & SELECT KALENDARZ
const startDragCalendar = (date) => {
    isDraggingCalendar.value = true;
    dragStartDateObj.value = date;
    const dStr = formatDateLocal(date);
    startDate.value = dStr;
    endDate.value = dStr;
};

const onDragMoveCalendar = (date) => {
    if (!isDraggingCalendar.value || !dragStartDateObj.value) return;
    const t1 = dragStartDateObj.value.getTime();
    const t2 = date.getTime();
    if (t1 < t2) {
        startDate.value = formatDateLocal(dragStartDateObj.value);
        endDate.value = formatDateLocal(date);
    } else {
        startDate.value = formatDateLocal(date);
        endDate.value = formatDateLocal(dragStartDateObj.value);
    }
};

const stopDragCalendar = () => {
    isDraggingCalendar.value = false;
    dragStartDateObj.value = null;
};

// DRAG & SELECT OŚ CZASU
const startDragTime = (hour) => {
    if (!isSingleDay.value) return;
    isDraggingTime.value = true;
    dragStartTime.value = hour;

    const currentStart = startTime.value.hours;
    const currentEnd = endTime.value.hours - 1;

    if (hour < currentStart) {
        startTime.value = { hours: hour, minutes: 0 };
    } else if (hour > currentEnd) {
        endTime.value = { hours: hour + 1, minutes: 0 };
    } else {
        startTime.value = { hours: hour, minutes: 0 };
        endTime.value = { hours: hour + 1, minutes: 0 };
    }
};

const onDragMoveTime = (hour) => {
    if (!isDraggingTime.value) return;
    const start = Math.min(dragStartTime.value, hour);
    const end = Math.max(dragStartTime.value, hour);
    const finalStart = Math.min(start, startTime.value.hours);
    const finalEnd = Math.max(end + 1, endTime.value.hours);

    startTime.value = { hours: finalStart, minutes: 0 };
    endTime.value = { hours: finalEnd, minutes: 0 };
};

const stopDragTime = () => {
    isDraggingTime.value = false;
    dragStartTime.value = null;
};

const timelineHours = computed(() => {
    const hours = [];
    const startH = startTime.value ? startTime.value.hours : 0;
    const endH = endTime.value ? endTime.value.hours : 0;
    
    const now = new Date();
    const isToday = startDate.value === formatDateLocal(now);
    const currentHour = now.getHours();

    for (let i = 0; i < 24; i++) {
        let status = 'free'; 
        if (isToday && i <= currentHour) {
            status = 'past'; 
        }
        else if (busyHoursForSelectedDate.value.includes(i)) {
            status = 'busy';
        }
        else if (i >= startH && i < endH) {
            status = 'selected';
        }
        hours.push({ hour: i, status });
    }
    return hours;
});

const totalPrice = computed(() => {
  if (existingReservationPrice.value) return existingReservationPrice.value;
  if (!garage.value || !startDate.value || !endDate.value) return 0;

  const priceH = parseFloat(garage.value.price_per_hour);
  const priceD = parseFloat(garage.value.price_per_day) || (priceH * 24);

  if (!isSingleDay.value) {
    const d1 = new Date(startDate.value);
    const d2 = new Date(endDate.value);
    const diffDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
    return (diffDays * priceD).toFixed(2);
  } else {
    const diffHours = endTime.value.hours - startTime.value.hours;
    if (diffHours <= 0) return 0;
    
    const isDayTotallyFree = busyHoursForSelectedDate.value.length === 0;
    
    if (diffHours === 24 && isDayTotallyFree) {
        return priceD.toFixed(2);
    }
    return (diffHours * priceH).toFixed(2);
  }
});

const initPayment = async () => {
  if (hasCollision.value) {
    errorMessage.value = "Selected time range conflicts with another reservation!";
    return;
  }

  // --- WALIDACJA LIMITU (DYNAMICZNA) ---
  const dStart = new Date(startDate.value);
  const dEnd = new Date(endDate.value);
  const diffTime = Math.abs(dEnd - dStart);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 

  // Używamy wartości pobranej z API
  if (diffDays > maxReservationDays.value) {
    modalTitle.value = "Limit Reached!";
    limitErrorMsg.value = `You selected ${diffDays} days. Maximum reservation length is ${maxReservationDays.value} days.`;
    showLimitModal.value = true;
    return;
  }
  // -----------------------------

  if (parseFloat(totalPrice.value) <= 0) {
    errorMessage.value = "Please select a valid time range.";
    return;
  }

  const token = localStorage.getItem('token');
  if (!token) {
    alert("You must be logged in to reserve a garage.");
    router.push('/login');
    return;
  }

  isProcessing.value = true;
  errorMessage.value = '';

  try {
    const startObj = new Date(`${startDate.value}T${formatTimeObj(startTime.value)}:00`);
    const endObj = new Date(`${endDate.value}T${formatTimeObj(endTime.value)}:00`);

    const bookingData = {
      garage: garageId,
      start_time: startObj.toISOString(),
      end_time: endObj.toISOString(),
      total_price: totalPrice.value
    };

    const resRes = await api.post('garages/reservations/', bookingData);
    reservationId.value = resRes.data.id;

    const intentRes = await api.post(`create-payment-intent/${reservationId.value}/`);
    const clientSecret = intentRes.data.clientSecret;

    step.value = 2; 
    await nextTick();

    stripe = await stripePromise;
    elements = stripe.elements({ clientSecret, appearance: { theme: 'stripe' } });
    const paymentElement = elements.create('payment');
    paymentElement.mount('#payment-element');

    isProcessing.value = false;
  } catch (err) {
    console.error(err);
    
    // --- OBSŁUGA BŁĘDÓW Z BACKENDU ---
    if (err.response && err.response.data) {
        const data = err.response.data;
        // Błędy walidacji w DRF mogą być listą w 'non_field_errors' lub po prostu tablicą
        const msg = data.non_field_errors ? data.non_field_errors[0] : (Array.isArray(data) ? data[0] : JSON.stringify(data));
        
        const msgLower = msg ? msg.toLowerCase() : '';

        // Obsługa limitów (DODANO 'maksymalny' bo backend zwraca "Maksymalny czas...")
        if (
          msgLower.includes('limit') ||
          msgLower.includes('zakończ obecne') ||
          msgLower.includes('zaległości') ||
          msgLower.includes('maksymalny') ||
          msgLower.includes('maximum') ||
          msgLower.includes('outstanding')
        ) {
            modalTitle.value = "Limit Reached!";
            limitErrorMsg.value = msg.replace(/['"\[\]]/g, '');
            showLimitModal.value = true;
            isProcessing.value = false;
            return;
        }

        // Obsługa kolizji dat
        if (msgLower.includes('zajęty') || msgLower.includes('termin') || msgLower.includes('occupied') || msgLower.includes('time slot')) {
             modalTitle.value = "Time Slot Unavailable!";
             limitErrorMsg.value = "There are already reservations in the selected date range. Please choose a different range.";
             showLimitModal.value = true;
             isProcessing.value = false;
             return;
        }
    }
    // -----------------------------

    errorMessage.value = "An error occurred while creating the reservation.";
    isProcessing.value = false;
    step.value = 1;
  }
};

const isDateDisabled = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); 
    return date < today;
};

const payNow = async () => {
  if (!stripe || !elements) return;
  isProcessing.value = true;
  errorMessage.value = '';

  const { paymentIntent, error } = await stripe.confirmPayment({
    elements,
    confirmParams: {
      return_url: `${window.location.origin}/success`,
    },
    redirect: "if_required"
  });

  if (error) {
    errorMessage.value = error.message;
    isProcessing.value = false;
  } else if (paymentIntent && paymentIntent.status === 'succeeded') {
    try {
        await api.post('garages/save-payment/', {
            reservation_id: reservationId.value,
            payment_intent_id: paymentIntent.id
        });
        router.push('/success');
    } catch (err) {
        console.error("Błąd zapisu:", err);
        errorMessage.value = "Payment save error. Contact support.";
        isProcessing.value = false;
    }
  }
};


const hasCollision = computed(() => {
    if (!isSingleDay.value) return false; 
    
    const startH = startTime.value.hours;
    const endH = endTime.value.hours;

    
    for (let i = startH; i < endH; i++) {
        if (busyHoursForSelectedDate.value.includes(i)) {
            return true; 
        }
    }
    return false;
});


const canProceed = computed(() => {
    return totalPrice.value > 0 && !hasCollision.value && !loading.value;
});
</script>

<template>
  <div class="min-h-screen bg-slate-50 py-12 px-4 select-none">
    <div class="max-w-6xl mx-auto">

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div v-if="loading" class="animate-pulse bg-white h-96 rounded-3xl"></div>
          <div v-else-if="garage" class="card bg-white shadow-xl rounded-[2.5rem] overflow-hidden border border-slate-100 h-full">
            <figure class="h-64 relative">
              <img :src="garage.image || 'https://via.placeholder.com/600x400'" class="w-full h-full object-cover" />
              <div class="absolute bottom-0 left-0 w-full bg-gradient-to-t from-slate-900/90 to-transparent p-8 pt-24">
                <h2 class="text-3xl font-black text-white uppercase italic tracking-tighter">{{ garage.name }}</h2>
                <p class="text-white/80 font-bold uppercase text-xs tracking-widest mt-1">{{ garage.address }}</p>
              </div>
            </figure>
            <div class="card-body p-8">
              <div class="flex justify-between font-bold text-slate-700 mb-4 border-b border-slate-100 pb-4">
                <span class="text-slate-400 uppercase text-xs tracking-widest self-center">Hourly Rate</span>
                <span class="text-lg">{{ garage.price_per_hour }} PLN</span>
              </div>
              <div class="mb-4">
                <span class="text-slate-400 uppercase text-[10px] tracking-widest font-black block mb-2">Available equipment</span>
                  <div class="flex flex-wrap gap-2">
                      <span v-for="item in garage.equipment" :key="item.id" class="badge badge-lg bg-indigo-50 text-indigo-700 border-indigo-100 font-bold text-xs uppercase py-3">
                        {{ item.name }}
                      </span>
                  </div>
              </div>
              <div class="divider my-2"></div>
              <div class="flex justify-between items-end mt-2">
                <span class="text-slate-400 uppercase text-xs tracking-widest font-bold">To pay</span>
                <div class="text-right">
                  <span class="font-black text-4xl text-indigo-600">{{ totalPrice }} <span class="text-lg text-slate-400">PLN</span></span>
                  
                  <div class="text-[10px] text-indigo-400 font-bold uppercase mt-1">
                      <span v-if="isSingleDay && (busyHoursForSelectedDate.length > 0 || (endTime.hours - startTime.hours < 24))">
                          * Hourly rate applies (day partially occupied)
                      </span>
                      <span v-else>
                          * Daily discounted rate applied
                      </span>
                  </div>
                </div>
              </div>
              <div class="mt-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Selected time slot</div>
                  <div v-if="isSingleDay">
                      <div class="text-slate-800 font-bold">{{ startDate }}</div>
                      <div class="text-indigo-600 font-black text-lg">{{ formatTimeObj(startTime) }} - {{ formatTimeObj(endTime) }}</div>
                  </div>
                  <div v-else>
                      <div class="text-slate-900 font-black">{{ startDate }} - {{ endDate }}</div>
                  </div>
              </div>
            </div>
          </div>

          <div class="card bg-white shadow-2xl rounded-[2.5rem] p-8 border border-indigo-50 h-full flex flex-col justify-center">
              <template v-if="step === 1">
                  <h3 class="text-xl font-black text-slate-900 uppercase italic mb-4">Choose Days</h3>
                  <div class="bg-slate-50 rounded-3xl p-4 border border-slate-200 flex-1 flex flex-col">
                      <div class="flex justify-between items-center mb-4">
                          <button @click="changeMonth(-1)" class="btn btn-sm btn-circle btn-ghost text-lg">‹</button>
                          <span class="font-black uppercase text-slate-700 tracking-wider text-sm">{{ monthName }}</span>
                          <button @click="changeMonth(1)" class="btn btn-sm btn-circle btn-ghost text-lg">›</button>
                      </div>
                      <div class="grid grid-cols-7 text-center mb-2">
                          <span v-for="d in ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']" :key="d" class="text-[9px] font-bold text-slate-400 uppercase">{{ d }}</span>
                      </div>
                      <div class="grid grid-cols-7 gap-2 text-center flex-1" @mouseleave="stopDragCalendar">
                          <button 
                              v-for="date in daysInMonth" :key="date" 
                              @mousedown="!isDateDisabled(date) && startDragCalendar(date)" 
                              @mouseenter="!isDateDisabled(date) && onDragMoveCalendar(date)" 
                              @mouseup="stopDragCalendar"
                              :disabled="isDateDisabled(date)"
                              :class="['w-full aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-bold transition-all relative', 
                                isDateDisabled(date) ? 'bg-slate-100 text-slate-300 cursor-not-allowed opacity-50' : 
                                isInRange(date) ? 'bg-indigo-600 text-white shadow-lg scale-105 z-10' : 
                                'bg-white hover:bg-indigo-50 text-slate-700 border border-slate-100']"
                            >
                              {{ date.getDate() }}
                            </button>
                      </div>
                  </div>
              </template>
              <template v-if="step === 2">
                  <div class="flex items-center justify-between mb-6">
                    <h3 class="text-2xl font-black text-slate-900 uppercase italic">Payment</h3>
                    <button v-if="!route.query.payment_for" @click="step = 1" class="btn btn-sm btn-circle btn-ghost">✕</button>
                  </div>
                  <div id="payment-element" class="min-h-[250px] mb-6"></div>
                  <div v-if="errorMessage" class="alert alert-error text-sm mb-4 rounded-xl font-bold">{{ errorMessage }}</div>
                  <button @click="payNow" :disabled="isProcessing" class="btn bg-indigo-600 hover:bg-indigo-700 text-white w-full h-16 rounded-2xl font-black uppercase italic tracking-widest shadow-xl transition-all text-lg">
                    <span v-if="isProcessing" class="loading loading-spinner"></span>
                    <span v-else>Pay {{ totalPrice }} PLN</span>
                  </button>
              </template>
          </div>
      </div>

      <Transition name="slide-fade">
        <div v-if="step === 1 && isSingleDay" class="card bg-white shadow-2xl rounded-[2.5rem] p-8 border border-indigo-50 w-full mb-8">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-2xl font-black text-slate-900 uppercase italic">Select Hours</h3>
            </div>
            <div class="mb-4">
                <div class="flex w-full h-20 rounded-2xl overflow-hidden border border-slate-200 shadow-inner bg-slate-100 relative" @mouseleave="stopDragTime">
                   <div v-for="h in timelineHours" :key="h.hour" 
                        @mousedown="h.status !== 'past' && h.status !== 'busy' && startDragTime(h.hour)" 
                        @mouseenter="h.status !== 'past' && h.status !== 'busy' && onDragMoveTime(h.hour)" 
                        @mouseup="stopDragTime"
                        :class="['flex-1 flex flex-col items-center justify-center border-r border-white/20 last:border-none transition-all cursor-pointer h-full', 
                          h.status === 'past' ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 
                          h.status === 'busy' ? 'bg-red-400 text-white cursor-not-allowed' : 
                          h.status === 'selected' ? 'bg-indigo-600 text-white shadow-inner scale-105 z-10' : 
                          'bg-white text-slate-400 hover:bg-indigo-50']"
                      >
                        <span class="text-[9px] font-black">{{ h.hour }}:00</span>
                      </div>
                </div>
                <div class="flex justify-center gap-6 mt-4">
                    <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-white border border-slate-300"></span><span class="text-[10px] font-bold text-slate-500 uppercase">Free</span></div>
                    <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-red-400"></span><span class="text-[10px] font-bold text-slate-500 uppercase">Busy</span></div>
                    <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-indigo-600"></span><span class="text-[10px] font-bold text-slate-500 uppercase">Your Selection</span></div>
                </div>
            </div>
        </div>
      </Transition>

      <div v-if="step === 1" class="flex flex-col items-center w-full mt-4 gap-4">
    <div v-if="hasCollision" class="alert alert-error shadow-lg max-w-lg rounded-2xl font-bold italic">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span>Warning! You selected hours that are already occupied.</span>
    </div>

    <button 
      @click="initPayment" 
      :disabled="isProcessing || !canProceed" 
      :class="['btn w-full max-w-lg h-20 rounded-[2.5rem] font-black uppercase italic tracking-widest shadow-2xl transition-all text-xl border-none', 
               hasCollision ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white']"
    >
      <span v-if="isProcessing" class="loading loading-spinner"></span>
      <span v-else-if="hasCollision">Time Slot Busy</span>
      <span v-else>Reserve Time Slot ({{ totalPrice }} PLN) <span class="ml-2">→</span></span>
    </button>
</div>

    </div>

    <dialog class="modal modal-bottom sm:modal-middle backdrop-blur-sm" :class="{ 'modal-open': showLimitModal }">
      <div class="modal-box bg-white rounded-[2.5rem] p-8 border-4 border-red-50 text-center shadow-2xl">
        <div class="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
             <span class="text-4xl">🛑</span>
        </div>
        <h3 class="font-black text-2xl uppercase italic text-slate-900 mb-2">{{ modalTitle }}</h3>
        <p class="text-slate-500 font-bold text-sm mb-8 leading-relaxed">
            {{ limitErrorMsg || 'A reservation problem occurred.' }}
        </p>
        <div class="modal-action justify-center">
            <button @click="showLimitModal = false" class="btn btn-wide bg-slate-900 hover:bg-black text-white rounded-2xl font-black uppercase tracking-widest shadow-lg border-none">
                I understand
            </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop bg-slate-900/60">
        <button @click="showLimitModal = false">close</button>
      </form>
    </dialog>

  </div>
</template>

<style scoped>
.slide-fade-enter-active { transition: all 0.4s ease-out; }
.slide-fade-leave-active { transition: all 0.3s cubic-bezier(1, 0.5, 0.8, 1); }
.slide-fade-enter-from, .slide-fade-leave-to { transform: translateY(-20px); opacity: 0; max-height: 0; margin-bottom: 0; overflow: hidden; }
</style>