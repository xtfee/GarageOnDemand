<script setup>
import { ref, onMounted, computed, watch } from 'vue' 
import api from '@/api'
import { useRoute, useRouter } from 'vue-router' 

const loading = ref(true);
const garages = ref([]);
const error = ref(null);
const route = useRoute();
const router = useRouter(); 
const allAvailableCities = ref([]);

// --- ZMIENNE FILTRÓW ---
const draftMinPrice = ref(0);
const draftMaxPrice = ref(200);
const draftLocation = ref("");
const draftEquipment = ref([]);

const activeFilters = ref({
  minPrice: 0,
  maxPrice: 200,
  location: "",
  equipment: []
});

const selectedGarage = ref(null);

const getGarageEquipment = (garage) => {
  if (!garage) return [];
  if (Array.isArray(garage.equipment_details) && garage.equipment_details.length > 0) return garage.equipment_details;
  if (Array.isArray(garage.equipment) && garage.equipment.length > 0 && typeof garage.equipment[0] === 'object') return garage.equipment;
  return [];
};

// Pobieranie unikalnych lokalizacji z bazy (do listy w modalu)
const availableLocations = computed(() => {
  const cities = new Set();
  if (Array.isArray(garages.value)) {
    garages.value.forEach(g => {
      const parts = g.address.split(',');
      if (parts.length > 1) cities.add(parts[parts.length - 1].trim());
    });
  }
  return Array.from(cities).sort();
});

const availableEquipmentOptions = computed(() => {
  const eqSet = new Set();
  if (Array.isArray(garages.value)) {
    garages.value.forEach(g => {
      getGarageEquipment(g).forEach(e => eqSet.add(e.name));
    });
  }
  return Array.from(eqSet).sort();
});

// --- FILTROWANIE LOKALNE ---
const filteredGarages = computed(() => {
  if (!Array.isArray(garages.value)) return [];
   
  return garages.value.filter(garage => {
    const price = parseFloat(garage.price_per_hour);
    if (price < activeFilters.value.minPrice || price > activeFilters.value.maxPrice) return false;

    if (activeFilters.value.location) {
      const garageLoc = garage.address.toLowerCase();
      const filterLoc = activeFilters.value.location.toLowerCase();
      if (!garageLoc.includes(filterLoc) && !route.query.search) return false;
    }

    if (activeFilters.value.equipment.length > 0) {
      const garageEqNames = getGarageEquipment(garage).map(e => e.name);
      return activeFilters.value.equipment.every(req => garageEqNames.includes(req));
    }
    return true;
  });
});

// --- LOGIKA POBIERANIA ---
const fetchGarages = async () => {
  loading.value = true;
  try {
    const searchParam = (route.query.search || '').toLowerCase();
    
    // 1. Najpierw pobierz dane z API
    const response = await api.get(`garages/list/?search=${searchParam}`);
    garages.value = Array.isArray(response.data) ? response.data : (response.data.results || []);

    // 2. SYNCHRONIZACJA ZNACZNIKA:
    if (searchParam && allAvailableCities.value.length > 0) {
      const matchedCity = allAvailableCities.value.find(city => {
        const normalizedCity = city.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const normalizedSearch = searchParam.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        return normalizedCity === normalizedSearch || city.toLowerCase().includes(searchParam);
      });

      if (matchedCity) {
        draftLocation.value = matchedCity;
        activeFilters.value.location = matchedCity;
      }
    }
  } catch (err) {
    console.error("Error fetching offers:", err);
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  const res = await api.get('garages/list/');
  const data = Array.isArray(res.data) ? res.data : res.data.results;
   
  const cities = new Set();
  data.forEach(g => {
    const parts = g.address.split(',');
    if (parts.length > 1) cities.add(parts[parts.length - 1].trim());
  });
  allAvailableCities.value = Array.from(cities).sort();

  fetchGarages();
});

const applyFilters = () => {
  activeFilters.value = {
    minPrice: draftMinPrice.value,
    maxPrice: draftMaxPrice.value,
    location: draftLocation.value,
    equipment: [...draftEquipment.value]
  };

  router.push({ 
    path: '/oferta', 
    query: draftLocation.value ? { search: draftLocation.value } : {} 
  });
};

const clearFilters = () => {
  draftMinPrice.value = 0;
  draftMaxPrice.value = 200;
  draftLocation.value = "";
  draftEquipment.value = [];
  applyFilters();
};

const toggleEquipment = (name) => {
  if (draftEquipment.value.includes(name)) {
    draftEquipment.value = draftEquipment.value.filter(item => item !== name);
  } else {
    draftEquipment.value.push(name);
  }
}

const openDetails = (garage) => {
  selectedGarage.value = garage;
  document.getElementById('details_modal').showModal();
}

const sliderTrackStyle = computed(() => {
  const percentage = (draftMaxPrice.value / 200) * 100;
  return { background: `linear-gradient(to right, white 0%, white ${percentage}%, rgb(75, 85, 99) ${percentage}%, rgb(75, 85, 99) 100%)` };
});

onMounted(fetchGarages);
watch(() => route.query.search, fetchGarages);

const fetchMetadata = async () => {
  try {
    const response = await api.get('garages/list/');
    const data = Array.isArray(response.data) ? response.data : (response.data.results || []);
    
    const cities = new Set();
    data.forEach(g => {
      const parts = g.address.split(',');
      if (parts.length > 1) {
        cities.add(parts[parts.length - 1].trim());
      }
    });
    allAvailableCities.value = Array.from(cities).sort();
  } catch (err) {
    console.error("Error fetching city list:", err);
  }
};

onMounted(() => {
  fetchMetadata(); 
  fetchGarages();  
});


</script>

<template>
  <div class="min-h-screen bg-slate-50 pb-20">
    
    <div class="container mx-auto px-4 py-8">
      
      <div class="flex flex-col md:flex-row justify-between items-center mb-10 border-b border-gray-200 pb-6">
        <div class="mb-4 md:mb-0 text-center md:text-left">
          <h1 class="text-4xl font-black text-slate-900 uppercase italic tracking-tighter">Full Offer</h1>
          <p class="text-gray-500 mt-2 font-bold tracking-widest uppercase text-xs">Find the perfect place to work</p>
        </div>
        
        <div>
          <button class="btn bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-xl hover:scale-105 transition-transform px-6 rounded-xl border-none font-bold uppercase italic" onclick="filter_modal.showModal()">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
            Filters
            <span v-if="activeFilters.equipment.length > 0 || activeFilters.location" class="badge badge-sm bg-white text-indigo-600 font-bold border-none">!</span>
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        
        <template v-if="loading">
          <div v-for="n in 8" :key="n" class="card bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-4">
             <div class="h-48 bg-slate-200 animate-pulse rounded-[2rem] mb-4"></div>
             <div class="h-6 bg-slate-200 rounded animate-pulse mb-3 w-3/4 mx-auto"></div>
             <div class="h-12 w-full bg-slate-100 rounded-xl animate-pulse mt-auto"></div>
          </div>
        </template>

        <template v-else>
          <div v-for="garage in filteredGarages" :key="garage.id" class="card bg-white rounded-[2.5rem] shadow-lg border border-slate-100 hover:shadow-2xl transition-all duration-300 group overflow-hidden">
            <figure class="h-56 relative bg-slate-100 overflow-hidden">
              <img 
                :src="garage.image || 'https://via.placeholder.com/600x400?text=Warsztat'" 
                class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
              />
              
              <div class="absolute top-4 right-4 flex flex-col items-end gap-2">
                <div class="bg-indigo-600 text-white px-4 py-1.5 rounded-xl font-black shadow-lg text-sm italic">
                  {{ garage.price_per_hour }} PLN/h
                </div>
               <div class="bg-green-500 text-white px-3 py-1 rounded-lg font-black text-[10px] uppercase tracking-wider shadow-[0_4px_10px_rgba(34,197,94,0.4)] border border-white/20">
                Day: {{ garage.price_per_day || (parseFloat(garage.price_per_hour) * 24).toFixed(2) }} PLN
              </div>
              </div>
            </figure>

            <div class="card-body p-6 text-center">
              <h2 class="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-1">{{ garage.name }}</h2>
              <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4 truncate">{{ garage.address }}</p>

              <div class="flex flex-wrap justify-center gap-2 mb-6 h-16 overflow-hidden content-start">
                <span v-for="eq in getGarageEquipment(garage).slice(0, 3)" :key="eq.id" class="badge bg-slate-100 text-slate-600 border-none font-bold text-[10px] uppercase p-3">
                  {{ eq.icon || '🔧' }} {{ eq.name }}
                </span>
                <span v-if="getGarageEquipment(garage).length > 3" class="badge bg-slate-50 text-slate-400 border-none text-[10px] p-3">
                  +{{ getGarageEquipment(garage).length - 3 }} more
                </span>
                <span v-if="getGarageEquipment(garage).length === 0" class="text-xs text-gray-300 italic">No equipment</span>
              </div>

              <div class="mt-auto">
                 <button 
                    @click="openDetails(garage)"
                    class="btn bg-slate-900 hover:bg-indigo-600 text-white border-none w-full h-12 rounded-xl font-black uppercase italic tracking-widest shadow-md transition-all"
                  >
                    Details
                  </button>
                
              </div>
            </div>
          </div>
        </template>
      </div>
      
      <div v-if="!loading && filteredGarages.length === 0" class="text-center py-20">
        <h3 class="text-2xl font-black text-gray-300 uppercase italic">No results</h3>
        <p class="text-gray-400 mt-2">Change filters to find a garage.</p>
        <button @click="clearFilters" class="btn btn-link text-indigo-600 no-underline mt-4">Clear filters</button>
      </div>

    </div>

    <dialog id="filter_modal" class="modal modal-bottom sm:modal-middle">
      <div class="modal-box bg-slate-800 text-white border border-slate-700 shadow-2xl p-6 md:p-8 rounded-3xl">
        <div class="flex justify-between items-center mb-6 border-b border-slate-600 pb-4">
          <h3 class="font-bold text-xl uppercase italic">Filtering</h3>
          <form method="dialog">
            <button class="btn btn-circle btn-ghost btn-sm text-gray-400 hover:text-white">✕</button>
          </form>
        </div>
        
        <div class="flex flex-col gap-6">
          <div class="form-control">
            <label class="label p-0 mb-2">
              <span class="label-text font-bold text-gray-200 text-xs uppercase tracking-wider">Location</span>
            </label>
            <select v-model="draftLocation" class="select select-bordered pl-4 bg-slate-700 text-white border-slate-600 focus:border-indigo-500 w-full rounded-xl">
              <option value="">All cities</option>
              <option v-for="loc in allAvailableCities" :key="loc" :value="loc">{{ loc }}</option>
            </select>
          </div>

          <div class="form-control">
            <label class="label p-0 mb-2 justify-between">
              <span class="label-text font-bold text-gray-200 text-xs uppercase tracking-wider">Maximum rate</span>
              <span class="label-text-alt font-black text-indigo-400 text-base">
                {{ draftMaxPrice >= 200 ? '200+ PLN/h' : `up to ${draftMaxPrice} PLN/h` }}
              </span>
            </label>
            <input 
              type="range" 
              min="0" 
              max="200" 
              v-model="draftMaxPrice"
              :style="sliderTrackStyle"
              class="range range-xs range-primary" 
            />
          </div>

          <div class="form-control">
            <p class="font-bold text-gray-200 text-xs uppercase tracking-wider mb-3">Required equipment</p>
            <div class="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2 custom-scroll">
              <label v-for="eqName in availableEquipmentOptions" :key="eqName" class="flex items-center gap-3 p-3 rounded-xl bg-slate-700/50 hover:bg-slate-700 cursor-pointer transition-colors border border-transparent hover:border-indigo-500/30">
                <input 
                  type="checkbox" 
                  class="checkbox checkbox-primary border-slate-500 checkbox-sm rounded-md" 
                  :checked="draftEquipment.includes(eqName)"
                  @change="toggleEquipment(eqName)"
                />
                <span class="text-sm font-medium text-gray-300 select-none">{{ eqName }}</span>
              </label>

              <div v-if="availableEquipmentOptions.length === 0" class="text-gray-500 text-sm italic">
                No equipment filters
              </div>
            </div>
          </div>
        </div>

        <div class="modal-action mt-8">
          <form method="dialog" class="w-full">
            <button @click="applyFilters" class="btn bg-indigo-600 hover:bg-indigo-700 text-white w-full border-none rounded-xl font-black uppercase italic shadow-lg">
              Apply filters
            </button>
          </form>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop"><button>close</button></form>
    </dialog>

    <dialog id="details_modal" class="modal modal-bottom sm:modal-middle">
      <div v-if="selectedGarage" class="modal-box bg-white text-slate-900 shadow-2xl p-0 rounded-[2.5rem] w-11/12 max-w-4xl overflow-hidden">
        
        <div class="relative h-64 sm:h-80">
          <img 
            :src="selectedGarage.image || 'https://via.placeholder.com/800x600?text=Garage'"
            class="w-full h-full object-cover" 
          />
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
          
          <form method="dialog">
             <button class="btn btn-circle btn-sm absolute right-4 top-4 bg-white/20 hover:bg-white/40 border-none text-black backdrop-blur">✕</button>
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
              <span v-for="eq in getGarageEquipment(selectedGarage)" :key="eq.id" class="badge badge-lg bg-white border border-slate-200 text-slate-600 font-bold p-4 rounded-xl shadow-sm">
                  {{ eq.icon || '🔧' }} {{ eq.name }}
              </span>
              <span v-if="getGarageEquipment(selectedGarage).length === 0" class="text-gray-400 italic text-sm">No equipment data.</span>
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
.custom-scroll::-webkit-scrollbar {
  width: 6px;
}
.custom-scroll::-webkit-scrollbar-track {
  background: #1e293b; 
}
.custom-scroll::-webkit-scrollbar-thumb {
  background: #475569; 
  border-radius: 10px;
}
.custom-scroll::-webkit-scrollbar-thumb:hover {
  background: #64748b; 
}
</style>