<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import api from '@/api';

// --- STANY UI ---
const isSidebarOpen = ref(false); 
const loading = ref(false);
const activeTab = ref('garages');

// --- DANE ---
const garages = ref([]);
const allEquipment = ref([]);
const users = ref([]);
const reservations = ref([]); 
const isModalOpen = ref(false);
const editId = ref(null);

// --- MODALE STANU (ALERTY/CONFIRMY) ---
const showSuccessModal = ref(false); // Toast sukcesu
const successMessage = ref('Operation completed successfully!');

const errorModal = ref({ open: false, title: 'Error', message: '' });
const confirmModal = ref({ open: false, title: '', message: '', onConfirm: null });

// --- KONFIGURACJA ---
const settings = ref({
  refund_limit_hours: 24,
  base_hour_price: 50,
  base_day_price: 350,
  max_active_reservations: 3,
  max_reservation_days: 7
});

// --- NOWE: LOGIKA KALENDARZA ADMINA ---
const isCalendarModalOpen = ref(false);
const calendarGarageId = ref(null); 
const calendarDate = ref(new Date().toISOString().split('T')[0]); 
const calendarBusyHours = ref([]); 
const calendarMonth = ref(new Date().getMonth());
const calendarYear = ref(new Date().getFullYear());
const monthAvailabilityMap = ref({}); // Przechowuje statusy dni: { '2025-05-01': 'full', ... }

// Helpery daty
const daysInMonth = computed(() => {
    const date = new Date(calendarYear.value, calendarMonth.value, 1);
    const days = [];
    while (date.getMonth() === calendarMonth.value) {
        days.push(new Date(date));
        date.setDate(date.getDate() + 1);
    }
    return days;
});

const monthName = computed(() => {
    return new Date(calendarYear.value, calendarMonth.value).toLocaleString('en-US', { month: 'long', year: 'numeric' });
});

const changeMonth = (delta) => {
    let newMonth = calendarMonth.value + delta;
    if (newMonth > 11) { calendarMonth.value = 0; calendarYear.value++; }
    else if (newMonth < 0) { calendarMonth.value = 11; calendarYear.value--; }
    else { calendarMonth.value = newMonth; }
    
    // Po zmianie miesiąca pobierz nowe statusy dni
    fetchMonthOverview();
};

const formatDateLocal = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// 1. Pobieranie szczegółów dla wybranego dnia (godziny)
const fetchAdminAvailability = async () => {
    if (!calendarGarageId.value || !calendarDate.value) return;
    try {
        const res = await api.get(`garages/list/${calendarGarageId.value}/check_availability/?date=${calendarDate.value}`);
        calendarBusyHours.value = res.data.busy_hours;
    } catch (e) {
        console.error("Błąd kalendarza:", e);
    }
};

// 2. Pobieranie statusów dla całego miesiąca (kolorki dni)
const fetchMonthOverview = async () => {
    if (!calendarGarageId.value) return;
    try {
        const res = await api.get(`garages/list/${calendarGarageId.value}/check_month_availability/?year=${calendarYear.value}&month=${calendarMonth.value + 1}`);
        monthAvailabilityMap.value = res.data;
    } catch (e) {
        console.error("Błąd pobierania miesiąca:", e);
    }
};

// Funkcja pomocnicza do ustalania klasy CSS dnia
const getDayClass = (date) => {
    const dStr = formatDateLocal(date);
    const isSelected = dStr === calendarDate.value;
    const status = monthAvailabilityMap.value[dStr] || 'free';

    // 1. Wybrany dzień zawsze fioletowy
    if (isSelected) return 'bg-indigo-600 text-white border-indigo-600 shadow-lg scale-105 z-20';

    // 2. Statusy zajętości
    if (status === 'full') return 'bg-red-600 text-white border-red-600 font-black'; // Ciemny czerwony (Full)
    if (status === 'partial') return 'bg-red-50 text-red-600 border-red-200 font-bold'; // Jasny czerwony (Partial)

    // 3. Domyślny (Wolny)
    return 'bg-white text-slate-700 border-slate-100 hover:border-indigo-200';
};

// Otwieranie kalendarza
const openCalendarModal = async () => {
    if (garages.value.length === 0) {
        try {
            const res = await api.get('garages/list/');
            garages.value = res.data;
        } catch(e) { console.error(e); }
    }
    
    if (garages.value.length > 0 && !calendarGarageId.value) {
        calendarGarageId.value = garages.value[0].id;
    }
    
    calendarDate.value = formatDateLocal(new Date()); 
    await fetchMonthOverview(); // Pobierz kolorki
    await fetchAdminAvailability(); // Pobierz godziny dla dzisiaj
    isCalendarModalOpen.value = true;
};

// Watchery
watch(calendarGarageId, () => {
    fetchMonthOverview();
    fetchAdminAvailability();
});

watch(calendarDate, () => {
    if (isCalendarModalOpen.value) fetchAdminAvailability();
});

// Oś czasu
const timelineHours = computed(() => {
    const hours = [];
    for (let i = 0; i < 24; i++) {
        hours.push({ 
            hour: i, 
            status: calendarBusyHours.value.includes(i) ? 'busy' : 'free' 
        });
    }
    return hours;
});
// ----------------------------------------

// --- HELPERY DO BŁĘDÓW I POPUPOW ---
const formatError = (err) => {
    if (err.response && err.response.data) {
        const data = err.response.data;
        if (typeof data === 'object' && !Array.isArray(data)) {
            return Object.entries(data)
                .map(([key, val]) => {
                    const keyMap = { username: 'Login', password: 'Password', email: 'Email', phone_number: 'Phone' };
                    const label = keyMap[key] || key;
                    const message = Array.isArray(val) ? val[0] : val;
                    return `${label}: ${message}`;
                })
                .join('\n');
        }
        return JSON.stringify(data);
    }
    return "An unexpected server error occurred.";
};

const triggerSuccess = (msg = 'Changes saved successfully!') => {
    successMessage.value = msg;
    showSuccessModal.value = true;
    setTimeout(() => { showSuccessModal.value = false; }, 3000);
};

const triggerError = (msg) => {
    errorModal.value = { open: true, title: 'A problem occurred', message: msg };
};

const triggerConfirm = (title, message, action) => {
    confirmModal.value = {
        open: true,
        title: title,
        message: message,
        onConfirm: async () => {
            await action();
            confirmModal.value.open = false;
        }
    };
};

// --- PAGINACJA ---
const currentPage = ref(1);
const itemsPerPage = 10;
const filterQuery = ref('');
const sortOption = ref('newest');

const sortOptions = computed(() => {
    if (activeTab.value === 'reservations') {
        return [
            { value: 'date_desc', label: 'Date (Newest first)' },
            { value: 'date_asc', label: 'Date (Oldest first)' },
            { value: 'id_desc', label: 'ID (Descending)' },
            { value: 'id_asc', label: 'ID (Ascending)' }
        ];
    }
    return [
        { value: 'id_desc', label: 'Added (Newest)' },
        { value: 'id_asc', label: 'Added (Oldest)' },
        { value: 'name_asc', label: activeTab.value === 'users' ? 'Login (A-Z)' : 'Name (A-Z)' },
        { value: 'name_desc', label: activeTab.value === 'users' ? 'Login (Z-A)' : 'Name (Z-A)' }
    ];
});

// --- API ACTIONS (LAZY LOADING) ---
const loadDataForTab = async (tab) => {
    loading.value = true;
    try {
        if (tab === 'garages') {
            const res = await api.get('garages/list/');
            garages.value = res.data;
            if (allEquipment.value.length === 0) allEquipment.value = (await api.get('garages/equipment/')).data;
        } else if (tab === 'users') {
            users.value = (await api.get('accounts/users/')).data;
        } else if (tab === 'reservations') {
            reservations.value = (await api.get('garages/reservations/')).data;
        } else if (tab === 'equipment') {
            allEquipment.value = (await api.get('garages/equipment/')).data;
        } else if (tab === 'settings') {
            const res = await api.get('garages/system-config/');
            if(res.data) settings.value = res.data;
        }
    } catch (e) { 
        console.error("Data loading error:", e);
        triggerError("Failed to fetch data.");
    } finally { 
        loading.value = false; 
    }
};

// --- WATCHER ---
watch(activeTab, (newTab) => {
    currentPage.value = 1;
    filterQuery.value = '';
    sortOption.value = sortOptions.value[0].value;
    isSidebarOpen.value = false;
    loadDataForTab(newTab);
});

const processedData = computed(() => {
    let data = [];
    if (activeTab.value === 'garages') data = [...garages.value];
    else if (activeTab.value === 'users') data = [...users.value];
    else if (activeTab.value === 'reservations') data = [...reservations.value];
    else if (activeTab.value === 'equipment') data = [...allEquipment.value];
    else return [];

    if (filterQuery.value) {
        const query = filterQuery.value.toLowerCase();
        data = data.filter(item => {
            if (activeTab.value === 'garages') return item.name.toLowerCase().includes(query) || item.address.toLowerCase().includes(query);
            if (activeTab.value === 'users') return item.username.toLowerCase().includes(query) || item.email.toLowerCase().includes(query) || (item.phone_number && item.phone_number.includes(query));
            if (activeTab.value === 'reservations') {
                const garageName = item.garage_details?.name?.toLowerCase() || '';
                const userName = item.user_name?.toLowerCase() || ''; 
                return String(item.id).includes(query) || garageName.includes(query) || userName.includes(query);
            }
            if (activeTab.value === 'equipment') return item.name.toLowerCase().includes(query);
            return false;
        });
    }

    data.sort((a, b) => {
        if (sortOption.value === 'id_desc') return (b.id || 0) - (a.id || 0);
        if (sortOption.value === 'id_asc') return (a.id || 0) - (b.id || 0);
        
        if (sortOption.value === 'date_desc') return new Date(b.start_time) - new Date(a.start_time);
        if (sortOption.value === 'date_asc') return new Date(a.start_time) - new Date(b.start_time);

        let nameA = '', nameB = '';
        if (activeTab.value === 'garages') { nameA = a.name; nameB = b.name; }
        else if (activeTab.value === 'users') { nameA = a.username; nameB = b.username; }
        else if (activeTab.value === 'equipment') { nameA = a.name; nameB = b.name; }
        
        if (sortOption.value === 'name_asc') return nameA.localeCompare(nameB);
        if (sortOption.value === 'name_desc') return nameB.localeCompare(nameA);
        
        return 0;
    });

    return data;
});

const paginatedData = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage;
    return processedData.value.slice(start, start + itemsPerPage);
});

const totalPages = computed(() => Math.ceil(processedData.value.length / itemsPerPage) || 1);
const nextPage = () => { if (currentPage.value < totalPages.value) currentPage.value++; };
const prevPage = () => { if (currentPage.value > 1) currentPage.value--; };

// --- FORMULARZE ---
const form = ref({ name: '', address: '', description: '', price_per_hour: 0, price_per_day: 0, equipment: [], image: null });
const userForm = ref({ username: '', email: '', first_name: '', last_name: '', role: 'client', is_active: true, password: '', phone_number: '' });
const equipmentForm = ref({ name: '', description: '' });

const tabTitle = computed(() => {
  const titles = { garages: 'Garages', equipment: 'Equipment', reservations: 'Reservations', users: 'Users', settings: 'Configuration' };
  return titles[activeTab.value] || 'Dashboard';
});

const addButtonLabel = computed(() => {
  const labels = { garages: 'GARAGE', users: 'USER', equipment: 'EQUIPMENT' };
  return labels[activeTab.value] || '';
});

const refreshCurrentTab = () => loadDataForTab(activeTab.value);

// --- AKCJE Z POTWIERDZENIAMI I POPUPAMI ---

const updateResStatus = async (id, newStatus) => {
  try { 
      await api.patch(`garages/reservations/${id}/`, { status: newStatus }); 
      refreshCurrentTab(); 
      triggerSuccess('Reservation status updated.');
  } catch (e) { 
      triggerError(formatError(e)); 
  }
};

const emergencyCancel = async (id) => {
    triggerConfirm(
        'Emergency Cancellation',
        'Are you sure you want to cancel this reservation in emergency mode? It may involve a refund.',
        async () => {
            try { 
                await api.post(`garages/reservations/${id}/emergency_cancel/`); 
                refreshCurrentTab(); 
                triggerSuccess('Reservation canceled in emergency mode.');
            } catch (e) { 
                triggerError(formatError(e)); 
            }
        }
    );
};

const isCancelModalOpen = ref(false);
const reservationToCancel = ref(null);
const cancelReason = ref('');

const openCancelModal = (res) => {
    reservationToCancel.value = res;
    cancelReason.value = '';
    isCancelModalOpen.value = true;
};

const confirmCancel = async () => {
    if (!reservationToCancel.value) return;
    try {
        await api.post(`garages/reservations/${reservationToCancel.value.id}/emergency_cancel/`, {
            reason: cancelReason.value
        });
        isCancelModalOpen.value = false;
        refreshCurrentTab();
        triggerSuccess('Reservation canceled and notification sent.');
    } catch (e) { 
        triggerError(formatError(e)); 
    }
};

const markOverstay = async (r) => {
    try {
        await api.post(`garages/reservations/${r.id}/mark_overstay/`, { overstayed: !r.overstayed });
        refreshCurrentTab();
    } catch (e) { 
        triggerError("Failed to change Overstay status."); 
    }
};

const deleteItemGeneric = (id, endpoint, itemName = 'this item') => {
    triggerConfirm(
        'Confirm deletion',
        `Are you sure you want to delete ${itemName}? This action cannot be undone.`,
        async () => {
            try {
                await api.delete(`${endpoint}${id}/`);
                refreshCurrentTab();
                triggerSuccess('Item deleted.');
            } catch (e) {
                triggerError(formatError(e));
            }
        }
    );
};

const deleteEquipment = (id) => deleteItemGeneric(id, 'garages/equipment/', 'this equipment item');
const deleteUser = (id) => deleteItemGeneric(id, 'accounts/users/', 'this user');
const deleteGarage = (id) => deleteItemGeneric(id, 'garages/list/', 'this garage');

const toggleUserStatus = async (user) => {
  try { 
      await api.patch(`accounts/users/${user.id}/`, { is_active: !user.is_active }); 
      refreshCurrentTab(); 
      triggerSuccess(`User ${user.is_active ? 'blocked' : 'activated'}.`);
  } catch (e) { 
      triggerError(formatError(e)); 
  }
};

const handleFile = (e) => { form.value.image = e.target.files[0]; };

const saveSettings = async () => {
  try {
    await api.post('garages/system-config/', settings.value);
    triggerSuccess('System settings saved.');
  } catch (e) { 
      triggerError(formatError(e)); 
  }
};

const handleGeneralSave = async () => {
  try {
    if (activeTab.value === 'users') {
        const dataToSend = { ...userForm.value };
        if (!dataToSend.password) delete dataToSend.password;
        if (editId.value) await api.put(`accounts/users/${editId.value}/`, dataToSend);
        else await api.post('accounts/register/', dataToSend);
    } else if (activeTab.value === 'equipment') {
        if (editId.value) await api.put(`garages/equipment/${editId.value}/`, equipmentForm.value);
        else await api.post('garages/equipment/', equipmentForm.value);
    } else if (activeTab.value === 'garages') {
        const fd = new FormData();
        fd.append('name', form.value.name);
        fd.append('address', form.value.address);
        fd.append('description', form.value.description);
        fd.append('price_per_hour', String(form.value.price_per_hour).replace(',', '.'));
        fd.append('price_per_day', String(form.value.price_per_day).replace(',', '.'));
        if (form.value.equipment) form.value.equipment.forEach(id => fd.append('equipment', id));
        if (form.value.image instanceof File) fd.append('image', form.value.image);

        if (editId.value) await api.put(`garages/list/${editId.value}/`, fd);
        else await api.post('garages/list/', fd);
    }
    isModalOpen.value = false;
    refreshCurrentTab();
    triggerSuccess(editId.value ? 'Changes saved.' : 'New item added.');
  } catch (err) { 
      triggerError(formatError(err)); 
  }
};

const openModal = (item = null) => {
  editId.value = item?.id || null;
  if (activeTab.value === 'users') {
    userForm.value = item ? { ...item, password: '' } : { username: '', email: '', first_name: '', last_name: '', role: 'client', is_active: true, password: '', phone_number: '' };
  } else if (activeTab.value === 'equipment') {
    equipmentForm.value = item ? { ...item } : { name: '', description: '' };
  } else {
    if (item) form.value = { ...item, image: null, equipment: item.equipment || [] };
    else form.value = { name: '', address: '', description: '', price_per_hour: settings.value.base_hour_price, price_per_day: settings.value.base_day_price, equipment: [], image: null };
  }
  isModalOpen.value = true;
};

onMounted(() => loadDataForTab(activeTab.value));
</script>

<template>
  <div class="flex h-screen bg-slate-100 text-slate-900 font-sans overflow-hidden" data-theme="light">
    
    <div v-if="isSidebarOpen" @click="isSidebarOpen = false" class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden transition-opacity"></div>

    <aside :class="['fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-white flex flex-col shadow-2xl transition-transform duration-300 ease-in-out lg:static lg:translate-x-0', isSidebarOpen ? 'translate-x-0' : '-translate-x-full']">
  <div class="p-8 border-b border-slate-800 flex justify-between items-center"><h2 class="text-2xl font-black italic text-indigo-500 tracking-tighter uppercase">Admin Panel</h2><button @click="isSidebarOpen = false" class="lg:hidden text-slate-400 hover:text-white">✕</button></div>
      <nav class="flex-1 p-6 space-y-3 overflow-y-auto">
        <button v-for="tab in ['garages', 'users', 'reservations', 'equipment', 'settings']" :key="tab" @click="activeTab = tab" :class="['w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-bold transition-all uppercase text-xs tracking-widest', activeTab === tab ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800']">
          {{ tab === 'garages' ? '🏠 Garages' : tab === 'users' ? '👥 Users' : tab === 'reservations' ? '📅 Reservations' : tab === 'equipment' ? '🛠️ Equipment' : '⚙️ Settings' }}
        </button>
      </nav>
    </aside>

    <main class="flex-1 flex flex-col min-w-0 bg-slate-100 relative">
      <div class="flex-1 overflow-y-auto p-4 lg:p-10">
        
        <header class="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-8 lg:mb-12 gap-6">
          <div class="flex items-center gap-4 w-full">
              <button @click="isSidebarOpen = true" class="lg:hidden btn btn-square btn-ghost text-slate-900"><span class="text-3xl">☰</span></button>
              <div><h1 class="text-3xl lg:text-5xl font-extrabold text-slate-900 tracking-tight">{{ tabTitle }}</h1><div class="h-1 w-16 lg:w-24 bg-indigo-600 rounded-full mt-3"></div></div>
          </div>
          
          <div class="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <button v-if="activeTab === 'reservations'" @click="openCalendarModal" class="btn btn-outline border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-600 hover:text-white lg:btn-lg px-8 lg:px-12 rounded-2xl font-black italic w-full lg:w-auto">
                  📅 CALENDAR VIEW
              </button>

              <button v-if="!['reservations', 'settings'].includes(activeTab)" class="btn btn-primary lg:btn-lg bg-indigo-600 hover:bg-indigo-700 text-white border-none shadow-2xl px-8 lg:px-12 rounded-2xl font-black italic w-full lg:w-auto" @click="openModal()">+ ADD {{ addButtonLabel }}</button>
          </div>
        </header>

        <div v-if="activeTab !== 'settings'" class="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm mb-8 flex flex-col md:flex-row gap-4 justify-between items-center">
            <div class="form-control w-full md:w-auto md:flex-1 md:max-w-md"><div class="input-group"><input v-model="filterQuery" type="text" placeholder="Search (Name, ID, Email...)" class="input input-bordered w-full rounded-xl bg-slate-50 font-bold placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-all" /></div></div>
            <div class="flex gap-4 w-full md:w-auto items-center justify-between md:justify-end flex-wrap">
                <div class="flex items-center gap-2 flex-1 md:flex-none"><span class="text-[10px] font-black uppercase text-slate-400 tracking-widest hidden sm:inline-block">Sort:</span><select v-model="sortOption" class="select select-bordered rounded-xl text-xs font-bold bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-200 pr-10 w-full md:w-auto"><option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option></select></div>
                <div class="badge badge-lg bg-slate-100 text-slate-500 font-bold border-none px-4 whitespace-nowrap">{{ processedData.length }} results</div>
            </div>
        </div>

        <div v-if="loading" class="flex justify-center py-20"><span class="loading loading-spinner loading-lg text-indigo-600"></span></div>

        <div v-else>
            <div v-if="activeTab === 'garages'" class="space-y-6">
                <div class="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-x-auto">
                  <table class="table w-full min-w-[800px]">
                    <thead><tr class="bg-slate-900 text-white"><th class="p-6 text-xs font-black uppercase tracking-widest">Facility</th><th class="text-xs font-black uppercase tracking-widest">Description and Location</th><th class="text-xs font-black uppercase tracking-widest whitespace-nowrap">Pricing (H/D)</th><th class="text-xs font-black uppercase tracking-widest text-center">Equipment</th><th class="text-right p-6 text-xs font-black uppercase tracking-widest">Actions</th></tr></thead>
                    <tbody class="divide-y divide-slate-100">
                      <tr v-for="g in paginatedData" :key="g.id" class="hover:bg-indigo-50/50 transition-colors h-24">
                        <td class="p-6 align-middle min-w-[200px]"><div class="flex items-center gap-4"><div class="avatar shadow-md shrink-0"><div class="w-16 h-16 rounded-2xl border-2 border-slate-50 overflow-hidden"><img :src="g.image || 'https://via.placeholder.com/150'" class="object-cover w-full h-full" /></div></div><div class="font-black text-slate-900 text-lg tracking-tighter uppercase leading-tight">{{ g.name }}</div></div></td>
                        <td class="align-middle min-w-[250px]"><div class="flex flex-col justify-center"><div class="font-bold text-slate-800 text-sm">{{ g.address }}</div><div class="text-xs text-slate-500 mt-1 line-clamp-1 italic">{{ g.description }}</div></div></td>
                        <td class="align-middle whitespace-nowrap"><div class="flex flex-col justify-center"><div class="text-indigo-600 font-black text-lg leading-none">{{ g.price_per_hour }} / {{ g.price_per_day }}</div><div class="text-xs text-slate-400 font-bold uppercase mt-1 tracking-widest">PLN</div></div></td>
                        <td class="text-center align-middle"><div class="flex flex-wrap justify-center gap-1 max-w-[200px] mx-auto"><span v-for="eqId in g.equipment" :key="eqId" class="badge badge-xs bg-slate-100 text-slate-500 border-none font-bold uppercase py-2 px-2 whitespace-nowrap">{{ (typeof eqId === 'object' ? eqId.name : allEquipment.find(e => String(e.id) === String(eqId))?.name) || 'Equipment' }}</span><span v-if="!g.equipment || g.equipment.length === 0" class="text-slate-300 italic text-[10px]">Empty</span></div></td>
                        <td class="text-right p-6 align-middle whitespace-nowrap"><div class="flex justify-end gap-2 items-center"><button class="btn btn-square bg-amber-100 hover:bg-amber-200 border-none font-bold shadow-sm" @click="openModal(g)">✎</button><button class="btn btn-square bg-red-100 hover:bg-red-200 border-none font-bold shadow-sm" @click="deleteGarage(g.id)">✕</button></div></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
            </div>

            <div v-if="activeTab === 'users'" class="space-y-6">
                <div class="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-x-auto">
                  <table class="table w-full min-w-[700px]">
                    <thead><tr class="bg-slate-900 text-white uppercase text-xs font-black"><th class="p-6">User</th><th>Role</th><th>Status</th><th>Phone</th><th class="text-right p-6">Actions</th></tr></thead>
                    <tbody class="divide-y divide-slate-100">
                      <tr v-for="u in paginatedData" :key="u.id" class="hover:bg-indigo-50/50 h-20">
                        <td class="p-6 min-w-[200px]"><div class="font-black text-slate-900 text-lg uppercase leading-none">{{ u.username }}</div><div class="text-xs opacity-50">{{ u.email }}</div><div v-if="u.first_name || u.last_name" class="text-[10px] text-indigo-500 font-bold mt-1">{{ u.first_name }} {{ u.last_name }}</div></td>
                        <td><span class="badge badge-outline font-bold uppercase text-[10px]">{{ u.role }}</span></td>
                        <td><div :class="['badge font-bold uppercase text-[10px]', u.is_active ? 'badge-success text-white' : 'badge-error text-white']">{{ u.is_active ? 'Active' : 'Blocked' }}</div></td>
                        <td class="font-mono text-xs font-bold text-slate-600">{{ u.phone_number || '-' }}</td>
                        <td class="text-right p-6 flex justify-end gap-2 items-center whitespace-nowrap"><button class="btn btn-sm btn-ghost font-bold uppercase text-[10px]" @click="toggleUserStatus(u)">{{ u.is_active ? 'Block' : 'Unblock' }}</button><button class="btn btn-square bg-amber-100 text-amber-700 border-none font-bold shadow-sm" @click="openModal(u)">✎</button><button class="btn btn-square bg-red-100 text-red-700 border-none font-bold shadow-sm" @click="deleteUser(u.id)">✕</button></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
            </div>

            <div v-if="activeTab === 'reservations'" class="space-y-6">
                <div class="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-x-auto">
                  <table class="table w-full min-w-[900px]">
                    <thead><tr class="bg-slate-900 text-white font-black uppercase text-xs"><th class="p-6">ID / Client</th><th>Garage</th><th class="whitespace-nowrap">Time Slot</th><th>Status</th><th class="text-center">Overstay</th><th class="text-right p-6">Actions</th></tr></thead>
                    <tbody class="divide-y divide-slate-100">
                      <tr v-for="r in paginatedData" :key="r.id" class="hover:bg-slate-50 h-24">
                        <td class="p-6 min-w-[150px]"><strong>#{{ r.id }}</strong><br/><span class="text-xs font-black uppercase text-slate-400">{{ r.user_name || 'User' }}</span></td>
                        <td class="font-bold text-slate-700 min-w-[150px]">{{ r.garage_details?.name || 'Deleted garage' }}</td>
                        <td class="text-xs whitespace-nowrap">{{ new Date(r.start_time).toLocaleString() }}<br/>{{ new Date(r.end_time).toLocaleString() }}</td>
                        <td><select :value="r.status" @change="updateResStatus(r.id, $event.target.value)" class="select select-bordered select-xs font-bold rounded-lg bg-slate-50 border-2"><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="cancelled">Canceled</option><option value="expired">Expired</option></select></td>
                        <td class="text-center">
                            <button 
                                @click="markOverstay(r)" 
                                :class="[
                                    'btn btn-xs w-32 font-black border-none transition-all duration-200 shadow-sm',
                                    r.overstayed 
                                        ? 'bg-red-600 hover:bg-red-700 text-white scale-105' 
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-400'
                                ]"
                            >
                                {{ r.overstayed ? '🚨 OVERSTAY' : 'OK' }}
                            </button>
                        </td>
                        <td class="text-right p-6 whitespace-nowrap"><button @click="openCancelModal(r)" class="btn btn-sm bg-red-50 text-red-600 border-2 border-red-200 hover:bg-red-600 hover:text-white hover:border-red-600 font-black rounded-xl shadow-sm uppercase text-[9px] transition-all duration-300 gap-2"><span>🚨</span> Cancel</button></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
            </div>

            <div v-if="activeTab === 'equipment'" class="space-y-6">
                <div class="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-x-auto">
                  <table class="table w-full min-w-[600px]">
                    <thead><tr class="bg-slate-900 text-white font-black uppercase text-xs"><th class="p-6">Equipment Name</th><th>Description</th><th class="text-right p-6">Actions</th></tr></thead>
                    <tbody class="divide-y divide-slate-100">
                      <tr v-for="eq in paginatedData" :key="eq.id" class="hover:bg-indigo-50/50 h-20">
                        <td class="p-6 font-black text-slate-900 text-lg uppercase min-w-[200px]">{{ eq.name }}</td>
                        <td class="text-sm text-slate-600 italic">{{ eq.description || 'No description' }}</td>
                        <td class="text-right p-6 flex justify-end gap-2 items-center whitespace-nowrap"><button class="btn btn-square bg-amber-100 text-amber-700 border-none font-bold shadow-sm" @click="openModal(eq)">✎</button><button class="btn btn-square bg-red-100 text-red-700 border-none font-bold shadow-sm" @click="deleteEquipment(eq.id)">✕</button></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
            </div>

            <div v-if="activeTab !== 'settings' && totalPages > 1" class="flex justify-center items-center gap-4 mt-8 pb-8">
                <button @click="prevPage" :disabled="currentPage === 1" class="btn btn-sm btn-ghost font-bold text-slate-500 disabled:text-slate-300">← Previous</button>
                <span class="text-xs font-black uppercase text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg">Page {{ currentPage }} of {{ totalPages }}</span>
                <button @click="nextPage" :disabled="currentPage === totalPages" class="btn btn-sm btn-ghost font-bold text-slate-500 disabled:text-slate-300">Next →</button>
            </div>
        </div>

        <div v-if="activeTab === 'settings'" class="max-w-4xl">
          <div class="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 p-6 lg:p-12 text-slate-900">
            <h2 class="text-2xl font-black uppercase italic mb-10 tracking-widest text-indigo-600">System Parameters</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div class="space-y-8">
                <h3 class="font-black text-xs uppercase text-slate-400 tracking-[0.2em] border-b pb-2">Reservation Policy</h3>
                <div class="flex flex-col gap-2">
                  <label class="font-black text-slate-500 uppercase text-[10px]">Free cancellation limit (Hours)</label>
                  <input v-model="settings.refund_limit_hours" type="number" class="input input-bordered border-2 font-bold h-12 rounded-xl px-4" />
                  <p class="text-[9px] text-slate-400 mt-1 italic font-bold">Time before reservation start when customer gets a full refund.</p>
                </div>
                
                <div class="flex flex-col gap-2">
                  <label class="font-black text-slate-500 uppercase text-[10px]">Max active reservations</label>
                  <input v-model="settings.max_active_reservations" type="number" class="input input-bordered border-2 font-bold h-12 rounded-xl px-4" />
                </div>
                <div class="flex flex-col gap-2">
                  <label class="font-black text-slate-500 uppercase text-[10px]">Max reservation length (days)</label>
                  <input v-model="settings.max_reservation_days" type="number" class="input input-bordered border-2 font-bold h-12 rounded-xl px-4" />
                </div>
              </div>
              <div class="space-y-8">
                <h3 class="font-black text-xs uppercase text-slate-400 tracking-[0.2em] border-b pb-2">Default Pricing</h3>
                <div class="grid grid-cols-2 gap-4">
                  <div class="flex flex-col gap-2">
                    <label class="font-black text-slate-500 uppercase text-[10px]">Price / Hour</label>
                    <div class="relative">
                        <input v-model="settings.base_hour_price" type="number" step="0.01" class="input input-bordered border-2 font-bold h-12 rounded-xl w-full pl-10 px-4" />
                        <span class="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">PLN</span>
                    </div>
                  </div>
                  <div class="flex flex-col gap-2">
                    <label class="font-black text-slate-500 uppercase text-[10px]">Price / Day</label>
                    <div class="relative">
                        <input v-model="settings.base_day_price" type="number" step="0.01" class="input input-bordered border-2 font-bold h-12 rounded-xl w-full pl-10 px-4" />
                        <span class="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">PLN</span>
                    </div>
                  </div>
                </div>
                <p class="text-[9px] text-slate-400 mt-2 italic font-bold text-right">Suggested pricing when creating new garages.</p>
              </div>
            </div>
            <div class="mt-16 flex justify-end">
              <button @click="saveSettings" class="btn btn-lg bg-indigo-600 hover:bg-indigo-700 text-white border-none shadow-xl px-16 rounded-2xl font-black uppercase tracking-widest text-xs w-full lg:w-auto">
                Apply New Parameters
              </button>
            </div>
          </div>
        </div>

      </div>
    </main>

    <div class="modal backdrop-blur-sm bg-slate-900/30" :class="{ 'modal-open': isCalendarModalOpen }" @click.self="isCalendarModalOpen = false">
        <div class="modal-box bg-white rounded-[2.5rem] p-0 overflow-hidden text-slate-900 w-11/12 max-w-4xl shadow-2xl flex flex-col h-[90vh]">
            <div class="bg-indigo-600 p-6 flex justify-between items-center text-white sticky top-0 z-10 shrink-0">
                <h3 class="text-xl font-black uppercase italic tracking-widest flex items-center gap-2">📅 Availability Preview</h3>
                <button @click="isCalendarModalOpen = false" class="text-xl font-bold">✕</button>
            </div>
            
            <div class="p-8 flex flex-col h-full overflow-hidden">
                <div class="flex flex-col sm:flex-row gap-6 mb-6 shrink-0">
                    <div class="flex-1">
                        <label class="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Select Garage</label>
                        <select v-model="calendarGarageId" class="select select-bordered w-full rounded-xl font-bold bg-slate-50 border-2">
                            <option v-for="g in garages" :key="g.id" :value="g.id">{{ g.name }}</option>
                        </select>
                    </div>
                    <div class="flex-1 flex justify-between items-end pb-1">
                        <button @click="changeMonth(-1)" class="btn btn-circle btn-sm btn-ghost">‹</button>
                        <span class="font-black text-xl uppercase italic text-slate-700">{{ monthName }}</span>
                        <button @click="changeMonth(1)" class="btn btn-circle btn-sm btn-ghost">›</button>
                    </div>
                </div>

                <div class="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-400 uppercase mb-2 shrink-0">
                    <span v-for="d in ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']" :key="d">{{ d }}</span>
                </div>
                
                <div class="grid grid-cols-7 gap-2 overflow-y-auto flex-1 mb-6">
                    <button 
                        v-for="date in daysInMonth" :key="date" 
                        @click="calendarDate = formatDateLocal(date)"
                        :class="[
                            'aspect-square rounded-xl flex flex-col items-center justify-center font-bold transition-all relative border-2',
                            getDayClass(date)
                        ]"
                    >
                        <span class="text-sm">{{ date.getDate() }}</span>
                    </button>
                </div>

                <div class="shrink-0 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <h4 class="text-xs font-black uppercase text-slate-400 mb-4 tracking-widest">Timeline: {{ calendarDate }}</h4>
                    <div class="flex w-full h-12 rounded-xl overflow-hidden border border-slate-200 shadow-inner bg-white relative">
                        <div v-for="h in timelineHours" :key="h.hour" 
                            :class="['flex-1 flex items-center justify-center border-r border-slate-100 last:border-none transition-all text-[9px] font-bold', 
                                h.status === 'busy' ? 'bg-red-500 text-white' : 'text-slate-300']"
                            :title="`${h.hour}:00 - ${h.status}`"
                        >
                            {{ h.hour }}
                        </div>
                    </div>
                    <div class="flex justify-center gap-6 mt-3">
                        <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-white border border-slate-300"></span><span class="text-[10px] font-bold text-slate-500 uppercase">Free</span></div>
                        <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-red-50"></span><span class="text-[10px] font-bold text-slate-500 uppercase">Partial</span></div>
                        <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-red-600"></span><span class="text-[10px] font-bold text-slate-500 uppercase">Full</span></div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal backdrop-blur-sm bg-slate-900/30" :class="{ 'modal-open': isModalOpen }" @click.self="isModalOpen = false">
      <div 
        :class="['modal-box bg-white rounded-[2.5rem] p-0 overflow-hidden text-slate-900 w-11/12 max-h-[90vh] flex flex-col shadow-2xl transition-all duration-300', 
                 activeTab === 'equipment' ? 'max-w-lg' : 'max-w-3xl']"
      >
        
        <div class="bg-slate-900 p-8 flex justify-between items-center text-white sticky top-0 z-10">
            <h3 class="text-2xl font-black uppercase italic tracking-widest">{{ editId ? 'Edit' : 'New Item' }}</h3>
            <button @click="isModalOpen = false" class="text-2xl font-bold">✕</button>
        </div>
        
        <div class="p-8 lg:p-12 overflow-y-auto flex-1">
            <form @submit.prevent="handleGeneralSave" id="modalForm" class="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <template v-if="activeTab === 'equipment'">
                <div class="md:col-span-2 flex flex-col gap-2">
                    <label class="font-black text-slate-400 uppercase text-[10px] tracking-widest">Equipment Name</label>
                    <input v-model="equipmentForm.name" type="text" class="input input-bordered border-2 font-bold rounded-xl h-12 px-4" required />
                </div>
                <div class="md:col-span-2 flex flex-col gap-2">
                    <label class="font-black text-slate-400 uppercase text-[10px] tracking-widest">Technical Description</label>
                    <textarea v-model="equipmentForm.description" class="textarea textarea-bordered border-2 font-medium h-32 rounded-xl pt-4 px-4"></textarea>
                </div>
              </template>
              
              <template v-if="activeTab === 'users'">
                <div class="flex flex-col gap-2">
                    <label class="font-black text-slate-400 uppercase text-[10px] tracking-widest">Login</label>
                    <input v-model="userForm.username" type="text" class="input input-bordered border-2 font-bold rounded-xl h-12 px-4" required :disabled="!!editId" />
                </div>
                <div class="flex flex-col gap-2">
                    <label class="font-black text-slate-400 uppercase text-[10px] tracking-widest">Email</label>
                    <input v-model="userForm.email" type="email" class="input input-bordered border-2 font-bold rounded-xl h-12 px-4" required />
                </div>
                <div class="flex flex-col gap-2">
                    <label class="font-black text-slate-400 uppercase text-[10px] tracking-widest">Phone</label>
                    <input v-model="userForm.phone_number" type="tel" class="input input-bordered border-2 font-bold rounded-xl h-12 px-4" placeholder="+48..." required />
                </div>
                <div class="flex flex-col gap-2">
                    <label class="font-black text-slate-400 uppercase text-[10px] tracking-widest">Role <span v-if="editId" class="text-slate-300 ml-1">(Locked)</span></label>
                    <select v-model="userForm.role" :disabled="!!editId" class="select select-bordered border-2 font-bold rounded-xl h-12 px-4 disabled:bg-slate-100 disabled:text-slate-400">
                        <option value="client">Client</option>
                        <option value="admin">Admin</option>
                    </select>
                </div>
                <div class="flex flex-col gap-2">
                    <label class="font-black text-slate-400 uppercase text-[10px] tracking-widest">First Name</label>
                    <input v-model="userForm.first_name" type="text" class="input input-bordered border-2 font-bold rounded-xl h-12 px-4" />
                </div>
                <div class="flex flex-col gap-2">
                    <label class="font-black text-slate-400 uppercase text-[10px] tracking-widest">Last Name</label>
                    <input v-model="userForm.last_name" type="text" class="input input-bordered border-2 font-bold rounded-xl h-12 px-4" />
                </div>
                <div class="md:col-span-2 flex flex-col gap-2">
                    <label class="font-black text-slate-400 uppercase text-[10px] tracking-widest">Password</label>
                    <input v-model="userForm.password" type="password" class="input input-bordered border-2 font-bold rounded-xl h-12 px-4" :required="!editId" autocomplete="new-password" :placeholder="editId ? 'Fill only if you want to change it' : ''" />
                </div>
              </template>
              
              <template v-if="activeTab === 'garages'">
                <div class="flex flex-col gap-2">
                    <label class="font-black text-slate-400 uppercase text-[10px] tracking-widest">Name</label>
                    <input v-model="form.name" type="text" class="input input-bordered border-2 font-bold rounded-xl h-12 px-4" required />
                </div>
                <div class="flex flex-col gap-2">
                    <label class="font-black text-slate-400 uppercase text-[10px] tracking-widest">Address</label>
                    <input v-model="form.address" type="text" class="input input-bordered border-2 font-bold rounded-xl h-12 px-4" required />
                </div>
                <div class="md:col-span-2 flex flex-col gap-2">
                    <label class="font-black text-slate-400 uppercase text-[10px] tracking-widest">Description</label>
                    <textarea v-model="form.description" class="textarea textarea-bordered border-2 font-medium h-24 rounded-xl pt-4 px-4" required></textarea>
                </div>
                <div class="flex flex-col gap-2">
                    <label class="font-black text-slate-400 uppercase text-[10px] tracking-widest">Price / H</label>
                    <div class="relative">
                        <input v-model="form.price_per_hour" type="number" step="0.01" class="input input-bordered border-2 font-bold rounded-xl h-12 w-full pl-12 px-4" required />
                        <span class="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">PLN</span>
                    </div>
                </div>
                <div class="flex flex-col gap-2">
                    <label class="font-black text-slate-400 uppercase text-[10px] tracking-widest">Price / Day</label>
                    <div class="relative">
                        <input v-model="form.price_per_day" type="number" step="0.01" class="input input-bordered border-2 font-bold rounded-xl h-12 w-full pl-12 px-4" required />
                        <span class="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">PLN</span>
                    </div>
                </div>
                <div class="md:col-span-2 flex flex-col gap-2">
                    <label class="font-black text-slate-400 uppercase text-[10px] tracking-widest">Equipment</label>
                    <div class="flex flex-wrap gap-3 p-4 bg-slate-50 border-2 border-slate-100 rounded-xl h-40 overflow-y-auto shadow-inner custom-scrollbar">
                        <label v-for="eq in allEquipment" :key="eq.id" class="flex items-center gap-3 bg-white px-4 py-3 rounded-xl border border-slate-200 cursor-pointer hover:border-indigo-600 transition-all shadow-sm select-none">
                            <input type="checkbox" :value="eq.id" v-model="form.equipment" class="checkbox checkbox-primary checkbox-sm border-2 rounded-md" />
                            <span class="text-[11px] font-black text-slate-700 uppercase tracking-wide">{{ eq.name }}</span>
                        </label>
                    </div>
                </div>
                <div class="md:col-span-2 flex flex-col gap-2">
                    <label class="font-black text-slate-400 uppercase text-[10px] tracking-widest">Image</label>
                    <input type="file" @change="handleFile" class="file-input file-input-bordered bg-slate-50 border-2 border-slate-200 rounded-xl h-12 w-full px-4" />
                </div>
              </template>

            </form>
        </div>

        <div class="p-6 border-t border-slate-100 bg-white flex justify-end items-center gap-4 shrink-0">
            <button type="button" class="btn btn-ghost text-slate-400 hover:bg-slate-100 font-bold uppercase text-xs h-14 px-6 rounded-2xl" @click="isModalOpen = false">Cancel</button>
            <button type="submit" form="modalForm" class="btn bg-indigo-600 hover:bg-indigo-700 text-white px-12 h-14 rounded-2xl font-black uppercase text-xs shadow-xl border-none">Save Changes</button>
        </div>

      </div>
    </div>

    <div class="modal backdrop-blur-sm bg-slate-900/30" :class="{ 'modal-open': isCancelModalOpen }" @click.self="isCancelModalOpen = false">
      <div class="modal-box bg-white max-w-md rounded-[2.5rem] p-0 overflow-hidden text-slate-900 shadow-2xl">
        <div class="bg-red-600 p-6 flex justify-between items-center text-white">
            <h3 class="text-xl font-black uppercase italic tracking-widest">Cancel Reservation</h3>
            <button @click="isCancelModalOpen = false" class="text-xl font-bold">✕</button>
        </div>
        <div class="p-8 flex flex-col gap-4">
            <p class="text-sm font-bold text-slate-500">Provide cancellation reason (it will be sent to the client):</p>
            <textarea v-model="cancelReason" class="textarea textarea-bordered border-2 font-medium h-32 rounded-xl pt-4 px-4 w-full" placeholder="e.g. Power outage in the garage..."></textarea>
            <div class="flex justify-end gap-3 mt-2">
                <button class="btn btn-ghost text-slate-400 font-bold uppercase text-xs h-12 rounded-xl" @click="isCancelModalOpen = false">Back</button>
                <button class="btn bg-red-600 hover:bg-red-700 text-white border-none font-bold uppercase text-xs h-12 px-6 rounded-xl shadow-lg" @click="confirmCancel">Confirm Cancellation</button>
            </div>
        </div>
      </div>
    </div>

    <div class="modal backdrop-blur-sm bg-slate-900/30" :class="{ 'modal-open': confirmModal.open }" @click.self="confirmModal.open = false">
      <div class="modal-box bg-white max-w-sm rounded-[2.5rem] p-8 text-center shadow-2xl">
        <h3 class="text-xl font-black uppercase italic text-slate-900 mb-2">{{ confirmModal.title }}</h3>
        <p class="text-sm text-slate-500 font-medium mb-6">{{ confirmModal.message }}</p>
        <div class="flex justify-center gap-3">
            <button class="btn btn-ghost text-slate-400 font-bold uppercase text-xs h-12 rounded-xl" @click="confirmModal.open = false">Cancel</button>
            <button class="btn bg-red-600 hover:bg-red-700 text-white border-none font-bold uppercase text-xs h-12 px-6 rounded-xl shadow-lg" @click="confirmModal.onConfirm">Confirm</button>
        </div>
      </div>
    </div>

    <div class="modal backdrop-blur-sm bg-slate-900/30" :class="{ 'modal-open': errorModal.open }" @click.self="errorModal.open = false">
      <div class="modal-box bg-white max-w-sm rounded-[2.5rem] p-8 text-center shadow-2xl border-4 border-red-50">
        <div class="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <span class="text-3xl">⚠️</span>
        </div>
        <h3 class="text-xl font-black uppercase italic text-slate-900 mb-2">{{ errorModal.title }}</h3>
        <p class="text-sm text-slate-500 font-bold mb-6 whitespace-pre-line">{{ errorModal.message }}</p>
        <button class="btn bg-slate-900 hover:bg-black text-white w-full h-12 rounded-xl font-bold uppercase text-xs" @click="errorModal.open = false">Understood</button>
      </div>
    </div>

    <Transition name="fade">
      <div v-if="showSuccessModal" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
        <div class="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-sm w-full text-center border-4 border-indigo-50 transform transition-all scale-100">
          <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
            <span class="text-4xl text-green-600 font-black">✓</span>
          </div>
          <h3 class="text-2xl font-black uppercase italic text-slate-900 mb-2 tracking-wide">Success!</h3>
          <p class="text-slate-500 font-bold text-sm mb-8 leading-relaxed">{{ successMessage }}</p>
          <button @click="showSuccessModal = false" class="btn btn-wide bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg">
            Great
          </button>
        </div>
      </div>
    </Transition>

  </div>
</template>

<style scoped>
.modal-box, input, textarea, select, main { color: #0f172a !important; }
td { vertical-align: middle !important; }

/* Custom Scrollbar */
.custom-scrollbar::-webkit-scrollbar { width: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>