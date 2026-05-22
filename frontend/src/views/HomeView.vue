<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api' 
import { useRouter } from 'vue-router'

const garages = ref([]);
const loading = ref(true);
const isLoggedIn = ref(false);
const scrollContainer = ref(null);
const selectedGarage = ref(null); // Stan dla modala

onMounted(async () => {
  isLoggedIn.value = !!localStorage.getItem('token');

  try {
    const res = await api.get('garages/list/');
    
    const allGarages = Array.isArray(res.data) ? res.data : res.data.results;
    
    garages.value = allGarages.slice(0, 6);

  } catch (err) {
    console.error("Database connection error:", err);
  } finally {
    loading.value = false; 
  }
})

// Funkcja przewijania karuzeli przyciskami
const scroll = (direction) => {
  if (scrollContainer.value) {
    const scrollAmount = 450; // dystans przesunięcia
    scrollContainer.value.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  }
};

// Funkcja otwierająca modal
const openDetails = (garage) => {
  selectedGarage.value = garage;
  document.getElementById('details_modal').showModal();
}

const router = useRouter();
const searchQuery = ref('');

const goToOffer = () => {
  router.push({ 
    path: '/oferta', 
    query: { search: searchQuery.value } 
  });
};
</script>

<template>
  <div class="pb-20 bg-slate-50 min-h-screen">
    
    <div class="bg-indigo-600 text-white rounded-b-[3rem] p-10 md:p-16 mb-12 shadow-2xl text-center">
      <h1 class="text-4xl md:text-5xl font-black italic mb-4 uppercase tracking-tighter">Garage OnDemand</h1>
      <p class="text-sm md:text-base opacity-80 mb-8 font-bold uppercase tracking-[0.2em]">Find a bay and start working</p>
      
      <div class="join shadow-xl w-full max-w-lg mx-auto bg-white rounded-btn p-1 border-none">
  <input 
    v-model="searchQuery"
    @keyup.enter="goToOffer"
    class="input input-ghost join-item bg-transparent text-gray-900 w-full min-w-0 placeholder-gray-500 px-4 focus:bg-transparent focus:outline-none focus:ring-0 border-none" 
    placeholder="Enter city or equipment..." 
  />
  <button 
    @click="goToOffer"
    class="btn join-item text-white px-6 md:px-8 shrink-0 bg-indigo-700 hover:bg-indigo-800 border-none rounded-r-btn font-black uppercase italic"
  >
    Search
  </button>
</div>
    </div>

    <div class="container mx-auto px-4 relative">
      
      <div class="mb-10 text-center md:text-left ml-4">
        <h2 class="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">Recommended Garages</h2>
        <div class="h-1.5 w-20 bg-indigo-600 rounded-full mt-2 mx-auto md:mx-0"></div>
      </div>

      <div class="relative group px-2 md:px-10">
        
        <button 
          @click="scroll('left')" 
          class="absolute left-0 top-1/2 -translate-y-1/2 z-20 btn btn-circle bg-white/90 hover:bg-white text-indigo-600 border-2 border-indigo-100 shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-300 hidden md:flex"
        >
          <span class="text-2xl font-bold">❮</span>
        </button>

        <div 
          ref="scrollContainer"
          class="flex overflow-x-auto pb-10 gap-8 snap-x snap-mandatory scrollbar-hide scroll-smooth px-4"
        >
          
          <template v-if="loading">
            <div v-for="n in 4" :key="'skeleton-' + n" class="flex-none w-80 md:w-[400px] h-[450px] bg-white rounded-[2.5rem] p-4 shadow-md animate-pulse">
              <div class="h-64 bg-slate-200 rounded-[2rem] mb-6"></div>
              <div class="h-10 bg-slate-200 rounded-xl w-3/4 mx-auto"></div>
            </div>
          </template>

          <template v-else>
            <div v-for="garage in garages" :key="garage.id" 
              class="flex-none w-80 md:w-[400px] card bg-white rounded-[2.5rem] shadow-xl border border-slate-100 snap-center overflow-hidden hover:shadow-2xl transition-all group"
            >
              <figure class="h-64 md:h-72 relative overflow-hidden bg-slate-100">
                <img 
                  :src="garage.image || 'https://via.placeholder.com/600x400?text=Garage+Preview'"
                  class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                />
                
                <div 
                  @click="openDetails(garage)"
                  class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-8 cursor-pointer hover:bg-black/10"
                >
                   <p class="text-white text-xs font-black uppercase tracking-[0.2em] underline underline-offset-8 decoration-indigo-500">View facility details</p>
                </div>

                <div class="absolute top-6 right-6 bg-indigo-600 text-white px-5 py-2 rounded-2xl font-black shadow-lg text-sm italic">
                  {{ garage.price_per_hour }} PLN/h
                </div>
              </figure>

              <div class="card-body p-8 text-center">
                <h3 class="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-1">{{ garage.name }}</h3>
                <p class="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-6">{{ garage.address }}</p>
                
                <div class="card-actions">
                  <RouterLink :to="'/rezerwacja/' + garage.id" class="w-full">
                    <button class="btn bg-slate-900 hover:bg-indigo-600 text-white border-none w-full h-14 rounded-2xl font-black uppercase italic tracking-widest shadow-lg transition-all">
                      Reserve now
                    </button>
                  </RouterLink>
                </div>
              </div>
            </div>

            <div v-if="garages.length === 0" class="w-full py-20 text-center opacity-30 italic font-bold uppercase tracking-widest">
              No active bays in the database.
            </div>
          </template>
        </div>

        <button 
          @click="scroll('right')" 
          class="absolute right-0 top-1/2 -translate-y-1/2 z-20 btn btn-circle bg-white/90 hover:bg-white text-indigo-600 border-2 border-indigo-100 shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-300 hidden md:flex"
        >
          <span class="text-2xl font-bold">❯</span>
        </button>

      </div>

      <div class="flex justify-center mt-4">
        <div v-if="!loading" class="badge bg-emerald-50 text-emerald-600 border-none font-black text-[9px] uppercase tracking-widest p-3">
          🟢 Connected to database
        </div>
      </div>

      <div class="text-center border-t border-gray-200 pt-16 mt-12">
        <p class="text-gray-500 mb-6 font-medium tracking-tight">Need a specialized lift or tools in another location?</p>
        <RouterLink to="/oferta">
          <button class="btn bg-indigo-600 hover:bg-indigo-700 text-white btn-lg px-12 md:px-20 uppercase tracking-widest font-black italic rounded-2xl shadow-xl transition-all hover:scale-105 border-none">
            See full offer
          </button>
        </RouterLink>
      </div>

    </div>

    <dialog id="details_modal" class="modal modal-bottom sm:modal-middle">
      <div v-if="selectedGarage" class="modal-box bg-white text-slate-900 shadow-2xl p-0 rounded-[2.5rem] w-11/12 max-w-4xl overflow-hidden">
        
        <div class="relative h-64 sm:h-80">
          <img 
            :src="selectedGarage.image || 'https://via.placeholder.com/800x600?text=Garage'" 
            class="w-full h-full object-cover" 
          />
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
          
          <form method="dialog">
             <button class="btn btn-circle btn-sm absolute text-black right-4 top-4 bg-white/20 hover:bg-white/40 border-none text-black backdrop-blur">✕</button>
          </form>

          <div class="absolute bottom-6 left-6 md:left-8 text-white">
            <h3 class="text-3xl sm:text-4xl font-black uppercase italic tracking-tighter">{{ selectedGarage.name }}</h3>
            <p class="text-white/80 font-bold uppercase text-sm tracking-widest mt-1">{{ selectedGarage.address }}</p>
          </div>
        </div>

        <div class="p-6 md:p-8 flex flex-col gap-6">
          
          <div class="grid grid-cols-2 gap-4">
            <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
               <span class="block text-xs font-bold text-gray-400 uppercase">Hourly Rate</span>
               <span class="block text-2xl font-black text-indigo-600">{{ selectedGarage.price_per_hour }} PLN</span>
            </div>
            <div class="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 text-center">
               <span class="block text-xs font-bold text-indigo-400 uppercase">Daily Rate</span>
               <span class="block text-2xl font-black text-indigo-900">
                  {{ selectedGarage.price_per_day || (parseFloat(selectedGarage.price_per_hour) * 24).toFixed(2) }} PLN
               </span>
            </div>
          </div>

          <div>
            <h4 class="text-sm font-bold text-slate-900 uppercase tracking-wide mb-2">Facility Description</h4>
            <p class="text-gray-600 leading-relaxed text-sm sm:text-base">
              {{ selectedGarage.description || "No additional description for this facility." }}
            </p>
          </div>

          <div>
            <h4 class="text-sm font-bold text-slate-900 uppercase tracking-wide mb-3">Full Equipment</h4>
            <div class="flex flex-wrap gap-2">
              <span v-for="eq in selectedGarage.equipment_details" :key="eq.id" class="badge badge-lg bg-white border border-slate-200 text-slate-600 font-bold p-4 rounded-xl shadow-sm"> 
                  {{ eq.icon || '🔧' }} {{ eq.name }} 
              </span>
              <span v-if="selectedGarage.equipment_details.length === 0" class="text-gray-400 italic text-sm">No equipment data.</span>
            </div>
          </div>

          <div class="flex gap-6 pt-4 border-t border-slate-100 text-gray-400 font-bold text-xs uppercase">
             <span v-if="selectedGarage.width">Width: {{ selectedGarage.width }}m</span>
             <span v-if="selectedGarage.length">Length: {{ selectedGarage.length }}m</span>
             <span v-if="selectedGarage.height">Height: {{ selectedGarage.height }}m</span>
          </div>

          <div class="mt-4 pt-2">
            <RouterLink :to="'/rezerwacja/' + selectedGarage.id" class="w-full">
              <button class="btn bg-slate-900 hover:bg-indigo-600 text-white w-full h-16 rounded-2xl font-black uppercase italic tracking-widest text-lg shadow-xl">
                Reserve Time Slot
              </button>
            </RouterLink>
          </div>

        </div>
      </div>
      <form method="dialog" class="modal-backdrop"><button>close</button></form>
    </dialog>

  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }

.card { transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
.card:hover { transform: translateY(-10px); }

/* Ułatwienie dla myszki */
.flex.overflow-x-auto {
  cursor: grab;
}
.flex.overflow-x-auto:active {
  cursor: grabbing;
}
</style>