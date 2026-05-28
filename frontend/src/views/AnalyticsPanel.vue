<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import axios from 'axios';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Line, Doughnut } from 'vue-chartjs';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend);

// --- ZMIENNE STANU ---
const loading = ref(false);
const activeTab = ref('dashboard');
const isSimulationMode = ref(false);

// Filtry Główne
const showFilters = ref(false);
const dateFrom = ref('');
const dateTo = ref('');
const selectedEquipment = ref('');
const equipmentList = ref([]);

// Zmienne do przechowywania zakresu dat z pliku CSV
const simulationDateFrom = ref('');
const simulationDateTo = ref('');

// --- ZMIENNE DO DRZEWA DECYZYJNEGO ---
const treeImage = ref(null);
const treeLoading = ref(false);

// --- ZMIENNE ML (PAGINACJA I SORTOWANIE) ---
const mlRules = ref([]);
const mlLoading = ref(false);
const mlMessage = ref('');
const mlPage = ref(1);
const mlItemsPerPage = 5;
const mlSortOrder = ref('confidence_desc'); // confidence_desc, confidence_asc, lift_desc

// --- TEKST ZAKRESU DAT (ZMODYFIKOWANY) ---
const periodLabel = computed(() => {
    if (isSimulationMode.value) {
        if (simulationDateFrom.value && simulationDateTo.value) {
            return `CSV File: ${simulationDateFrom.value} ➔ ${simulationDateTo.value}`;
        }
        return 'CSV File: Preview / Simulation Mode';
    }

    if (dateFrom.value && dateTo.value) {
        return `${dateFrom.value} ➔ ${dateTo.value}`;
    }
    if (dateFrom.value) {
        return `From: ${dateFrom.value}`;
    }
    if (dateTo.value) {
        return `To: ${dateTo.value}`;
    }
    return 'All available data';
});

// --- CUSTOM DROPDOWN (WYPOSAŻENIE) ---
const showEquipmentDropdown = ref(false);

const selectedEquipmentName = computed(() => {
    if (!selectedEquipment.value) return "All garages";
    const eq = equipmentList.value.find(e => e.id === selectedEquipment.value);
    return eq ? eq.name : "All garages";
});

const selectEquipment = (id) => {
    selectedEquipment.value = id;
    showEquipmentDropdown.value = false;
};

// --- LOGIKA RESETOWANIA FILTRÓW ---
const clearFilters = () => {
    dateFrom.value = '';
    dateTo.value = '';
    selectedEquipment.value = '';
    fetchAnalytics();
};

// --- LOGIKA POPUPA KALENDARZA ---
const showDatePicker = ref(false);
const pickerTarget = ref('');
const currentMonth = ref(new Date().getMonth());
const currentYear = ref(new Date().getFullYear());

const formatDateLocal = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const daysInMonth = computed(() => {
    const date = new Date(currentYear.value, currentMonth.value, 1);
    const days = [];
    let firstDayIndex = date.getDay() - 1; 
    if (firstDayIndex === -1) firstDayIndex = 6; 
    for (let i = 0; i < firstDayIndex; i++) { days.push(null); }
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

const openDatePicker = (target) => {
    pickerTarget.value = target;
    const currentDateStr = target === 'from' ? dateFrom.value : dateTo.value;
    const dateObj = currentDateStr ? new Date(currentDateStr) : new Date();
    currentMonth.value = dateObj.getMonth();
    currentYear.value = dateObj.getFullYear();
    showDatePicker.value = true;
};

const selectDate = (date) => {
    if (!date) return;
    const formatted = formatDateLocal(date);
    if (pickerTarget.value === 'from') {
        dateFrom.value = formatted;
        if (dateTo.value && new Date(dateTo.value) < date) { dateTo.value = ''; }
    } else {
        dateTo.value = formatted;
        if (dateFrom.value && new Date(dateFrom.value) > date) { dateFrom.value = formatted; }
    }
    showDatePicker.value = false;
};

// --- WYKRESY I DANE ---
const revenueChartData = ref({ labels: [], datasets: [] });
const popularityChartData = ref({ labels: [], datasets: [] });
const heatmapData = ref([]); 

const chartColors = [
    '#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', 
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
];

const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    cutout: '70%'
};

const popularityLegend = computed(() => {
    if (!popularityChartData.value.labels) return [];
    return popularityChartData.value.labels.map((label, index) => ({
        label: label,
        value: popularityChartData.value.datasets[0].data[index],
        color: chartColors[index % chartColors.length]
    }));
});

// Import/Export
const loadingML = ref(false);
const loadingHistory = ref(false);
const importing = ref(false);
const importMessage = ref('');
const importError = ref(false);
const fileInput = ref(null);

// --- SORTOWANIE I PAGINACJA ML (COMPUTED) ---
const processedMLRules = computed(() => {
    let rules = [...mlRules.value];
    
    // Sortowanie
    if (mlSortOrder.value === 'confidence_desc') {
        rules.sort((a, b) => b.confidence - a.confidence);
    } else if (mlSortOrder.value === 'confidence_asc') {
        rules.sort((a, b) => a.confidence - b.confidence);
    } else if (mlSortOrder.value === 'lift_desc') {
        rules.sort((a, b) => b.lift_score - a.lift_score);
    }
    
    return rules;
});

const paginatedMLRules = computed(() => {
    const start = (mlPage.value - 1) * mlItemsPerPage;
    return processedMLRules.value.slice(start, start + mlItemsPerPage);
});

const totalMLPages = computed(() => Math.ceil(processedMLRules.value.length / mlItemsPerPage) || 1);

const nextPageML = () => { if (mlPage.value < totalMLPages.value) mlPage.value++; };
const prevPageML = () => { if (mlPage.value > 1) mlPage.value--; };

// Reset paginacji przy zmianie sortowania
watch(mlSortOrder, () => { mlPage.value = 1; });

// --- API FETCH ---

const fetchEquipment = async () => {
    try {
        const token = localStorage.getItem('token');
        const res = await axios.get('http://localhost:8000/api/garages/equipment/', {
             headers: { 'Authorization': `Token ${token}` }
        });
        equipmentList.value = res.data;
    } catch (e) { console.error(e); }
};

const fetchAnalytics = async () => {
    loading.value = true;
    showFilters.value = false;
    isSimulationMode.value = false; 
    simulationDateFrom.value = '';
    simulationDateTo.value = '';

    try {
        const token = localStorage.getItem('token');
        const params = {};
        if (dateFrom.value) params.start_date = dateFrom.value;
        if (dateTo.value) params.end_date = dateTo.value;
        if (selectedEquipment.value) params.equipment_id = selectedEquipment.value;

        const res = await axios.get('http://localhost:8000/api/garages/analytics-data/', {
            headers: { 'Authorization': `Token ${token}` },
            params: params
        });

        revenueChartData.value = {
            labels: res.data.revenue.labels,
            datasets: [{
                label: 'Revenue (EUR)',
                backgroundColor: '#4F46E5',
                borderColor: '#4F46E5',
                data: res.data.revenue.data,
                tension: 0.3
            }]
        };

        popularityChartData.value = {
            labels: res.data.popularity.labels,
            datasets: [{
                backgroundColor: chartColors,
                data: res.data.popularity.data,
                borderWidth: 0
            }]
        };

        heatmapData.value = res.data.heatmap;

    } catch (err) {
        console.error("Analytics error:", err);
    } finally {
        loading.value = false;
    }
};

const fetchMLRules = async () => {
    mlLoading.value = true;
    mlMessage.value = '';
    mlPage.value = 1; // Reset paginacji
    try {
        const token = localStorage.getItem('token');
        const params = {};
        if (dateFrom.value) params.start_date = dateFrom.value;
        if (dateTo.value) params.end_date = dateTo.value;

        const res = await axios.get('http://localhost:8000/api/garages/ml-results/', {
            headers: { 'Authorization': `Token ${token}` },
            params: params
        });
        
        if (res.data.message) {
            mlMessage.value = res.data.message;
            mlRules.value = [];
        } else {
            mlRules.value = res.data;
        }
    } catch (err) {
            mlMessage.value = "ML error.";
    } finally {
        mlLoading.value = false;
    }
};

const handleMLSimFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    mlLoading.value = true;
    mlMessage.value = '';
    mlPage.value = 1; // Reset paginacji
    const formData = new FormData();
    formData.append('file', file);
    try {
        const token = localStorage.getItem('token');
        const res = await axios.post('http://localhost:8000/api/garages/ml-results/', formData, {
            headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'multipart/form-data' }
        });
        if (res.data.message) {
            mlMessage.value = res.data.message;
            mlRules.value = [];
        } else {
            mlRules.value = Array.isArray(res.data) ? res.data : res.data.rules;
        }

        if (res.data.is_simulation) {
            isSimulationMode.value = true;
        }
    } catch (err) {
        mlMessage.value = "ML simulation error.";
    } finally {
        mlLoading.value = false;
        event.target.value = '';
    }
};

// --- FUNKCJE DRZEWA DECYZYJNEGO ---
const fetchDecisionTree = async () => {
    treeLoading.value = true;
    try {
        const token = localStorage.getItem('token');
        const res = await axios.get('http://localhost:8000/api/garages/visualize-decision-tree/', {
            headers: { 'Authorization': `Token ${token}` }
        });
        treeImage.value = res.data.image;
    } catch (e) {
        console.error("Tree generation error", e);
        alert("Failed to generate tree (make sure scikit-learn and matplotlib are installed).");
    } finally {
        treeLoading.value = false;
    }
};

const handleTreeSimFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    treeLoading.value = true;
    const formData = new FormData();
    formData.append('file', file);
    try {
        const token = localStorage.getItem('token');
        const res = await axios.post('http://localhost:8000/api/garages/visualize-decision-tree/', formData, {
            headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'multipart/form-data' }
        });
        treeImage.value = res.data.image;
        isSimulationMode.value = true;
    } catch (e) {
        alert("Tree simulation error.");
    } finally {
        treeLoading.value = false;
        event.target.value = '';
    }
};

const exportDecisionTreeCSV = async () => {
    const filename = `training_data_tree_${getTodayDate()}.csv`;
    await downloadCSV('http://localhost:8000/api/garages/export-decision-tree/', filename);
};

const getTodayDate = () => new Date().toISOString().split('T')[0];

const downloadCSV = async (url, filename) => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.get(url, {
      responseType: 'blob',
      headers: { 'Authorization': `Token ${token}` }
    });
    const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = blobUrl;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error("Download error:", err);
    alert("An error occurred while downloading the file.");
  }
};

const exportML = async () => {
  loadingML.value = true;
  const filename = `ml_report_${getTodayDate()}.csv`;
  await downloadCSV('http://localhost:8000/api/garages/export/', filename);
  loadingML.value = false;
};

const exportHistory = async () => {
  loadingHistory.value = true;
  const filename = `reservation_history_${getTodayDate()}.csv`;
  await downloadCSV('http://localhost:8000/api/garages/export-history/', filename);
  loadingHistory.value = false;
};

const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    importing.value = true;
    importMessage.value = '';
    importError.value = false;
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const token = localStorage.getItem('token');
        const res = await axios.post('http://localhost:8000/api/garages/analyze-csv/', formData, {
            headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'multipart/form-data' }
        });
        
        revenueChartData.value = {
            labels: res.data.revenue.labels,
            datasets: [{
                label: 'Revenue (EUR)',
                backgroundColor: '#F59E0B', 
                borderColor: '#F59E0B',
                data: res.data.revenue.data,
                tension: 0.3
            }]
        };

        popularityChartData.value = {
            labels: res.data.popularity.labels,
            datasets: [{
                backgroundColor: chartColors,
                data: res.data.popularity.data,
                borderWidth: 0
            }]
        };

        heatmapData.value = res.data.heatmap;
        
        const labels = res.data.revenue.labels;
        if (labels && labels.length > 0) {
            const sortedLabels = [...labels].sort();
            simulationDateFrom.value = sortedLabels[0];
            simulationDateTo.value = sortedLabels[sortedLabels.length - 1];
        }

        isSimulationMode.value = true; 
        importMessage.value = "Data loaded from file (Preview Mode).";
        activeTab.value = 'dashboard'; 

    } catch (err) {
        importError.value = true;
        importMessage.value = err.response?.data?.error || "File analysis error.";
    } finally {
        importing.value = false;
        if (fileInput.value) fileInput.value.value = '';
    }
};

const getConfidenceBadgeClass = (colorClass) => {
    if (colorClass === 'green') return 'badge-success text-white';
    if (colorClass === 'blue') return 'badge-info text-white';
    return 'badge-warning text-white';
};

onMounted(() => {
    fetchEquipment();
    fetchAnalytics();
});

const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const hoursOfDay = Array.from({length: 24}, (_, i) => i);
const getHeatmapColor = (val) => {
    if (val === 0) return 'bg-gray-50';
    if (val < 5) return 'bg-indigo-100';
    if (val < 10) return 'bg-indigo-300';
    if (val < 20) return 'bg-indigo-500 text-white';
    return 'bg-indigo-700 text-white font-bold';
};
</script>

<template>
  <div class="min-h-screen bg-slate-50 pt-24 pb-12 px-4 select-none relative">
    
    <div v-if="isSimulationMode" class="fixed top-20 left-0 right-0 z-40 bg-amber-400 text-slate-900 px-4 py-3 shadow-md flex justify-between items-center animate-in slide-in-from-top-2">
        <div class="container mx-auto flex justify-between items-center max-w-7xl">
            <div class="flex items-center gap-3">
                <span class="text-2xl">⚠️</span>
                <div>
                    <p class="font-black uppercase text-xs tracking-widest">Preview / Simulation Mode</p>
                    <p class="text-xs font-bold opacity-80">Displayed data comes from CSV file. ML analysis and Tree run in test mode.</p>
                </div>
            </div>
            <button @click="fetchAnalytics(); treeImage=null; mlRules=[]" class="btn btn-sm bg-white border-none text-slate-800 font-bold hover:bg-slate-100 shadow-sm px-6 h-auto py-2">
                Back to Database
            </button>
        </div>
    </div>

    <div class="max-w-7xl mx-auto" :class="{'mt-16': isSimulationMode}">
      
      <div class="text-center mb-10">
        <h1 class="text-3xl md:text-4xl font-extrabold text-slate-800 tracking-tight">Analytics Center</h1>
        <p class="text-slate-500 font-medium mt-2 text-sm md:text-base">Business Intelligence Dashboard</p>
        
        <div class="mt-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 text-slate-600 text-xs md:text-sm font-bold border border-slate-200 shadow-sm">
            <span>🕒 Data range:</span>
            <span class="text-indigo-600">{{ periodLabel }}</span>
        </div>
      </div>

      <div class="flex flex-col md:flex-row justify-center gap-4 mb-8">
          <button @click="activeTab='dashboard'" :class="activeTab==='dashboard' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-600 hover:bg-slate-100'" class="px-6 md:px-8 py-3 rounded-xl font-black uppercase tracking-wider transition-all text-sm md:text-base">Dashboard</button>
          <button @click="activeTab='ml'" :class="activeTab==='ml' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-600 hover:bg-slate-100'" class="px-6 md:px-8 py-3 rounded-xl font-black uppercase tracking-wider transition-all text-sm md:text-base">ML Analysis</button>
          <button @click="activeTab='data'" :class="activeTab==='data' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-600 hover:bg-slate-100'" class="px-6 md:px-8 py-3 rounded-xl font-black uppercase tracking-wider transition-all text-sm md:text-base">Historical Data</button>
      </div>

      <div v-if="activeTab === 'dashboard'" class="space-y-8 animate-in fade-in zoom-in duration-300">
          
          <div class="flex justify-end" v-if="!isSimulationMode">
              <button @click="showFilters = true" class="btn bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-sm rounded-xl font-bold uppercase gap-2 w-full md:w-auto">
                  <span>📅</span> Filters
                  <span v-if="dateFrom || dateTo || selectedEquipment" class="badge badge-primary badge-xs">!</span>
              </button>
          </div>

          <Teleport to="body">
            <Transition name="modal">
                <div v-if="showFilters" class="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                    <div class="absolute inset-0 bg-slate-900/60 transition-opacity" @click="showFilters = false"></div>
                    
                    <div class="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-visible transform transition-all border border-slate-100 flex flex-col max-h-[90vh]">
                        
                        <div class="bg-indigo-600 px-6 py-4 flex justify-between items-center shrink-0 rounded-t-3xl">
                            <h3 class="font-black text-white uppercase tracking-wide flex items-center gap-2 text-sm md:text-base">
                                <span>🛠️</span> Data Scope
                            </h3>
                            <button @click="showFilters = false" class="text-white/80 hover:text-white transition-colors text-xl font-bold">✕</button>
                        </div>
                        
                        <div class="p-6 md:p-8 space-y-6 overflow-y-auto">
                            
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div class="form-control">
                                    <label class="label font-bold text-xs uppercase text-slate-500 mb-2 block ml-1">Date From</label>
                                    <div @click="openDatePicker('from')" class="w-full bg-white border border-slate-200 rounded-xl px-5 py-4 flex items-center gap-3 cursor-pointer hover:border-indigo-500 hover:shadow-sm transition-all group">
                                        <span class="text-slate-400 group-hover:text-indigo-500 transition-colors">📅</span>
                                        <span :class="dateFrom ? 'text-slate-800 font-bold' : 'text-slate-400 italic'">{{ dateFrom || 'Select...' }}</span>
                                    </div>
                                </div>
                                <div class="form-control">
                                    <label class="label font-bold text-xs uppercase text-slate-500 mb-2 block ml-1">Date To</label>
                                    <div @click="openDatePicker('to')" class="w-full bg-white border border-slate-200 rounded-xl px-5 py-4 flex items-center gap-3 cursor-pointer hover:border-indigo-500 hover:shadow-sm transition-all group">
                                        <span class="text-slate-400 group-hover:text-indigo-500 transition-colors">📅</span>
                                        <span :class="dateTo ? 'text-slate-800 font-bold' : 'text-slate-400 italic'">{{ dateTo || 'Select...' }}</span>
                                    </div>
                                </div>
                            </div>

                            <div class="form-control relative">
                                <label class="label font-bold text-xs uppercase text-slate-500 mb-2 block ml-1">Equipment</label>
                                
                                <div 
                                    @click="showEquipmentDropdown = !showEquipmentDropdown"
                                    class="w-full bg-white border border-slate-200 rounded-xl px-5 py-4 flex items-center justify-between cursor-pointer hover:border-indigo-500 hover:shadow-sm transition-all group z-20 relative"
                                >
                                    <span :class="selectedEquipment ? 'text-slate-800 font-bold' : 'text-slate-500 font-bold'">
                                        {{ selectedEquipmentName }}
                                    </span>
                                    <span class="text-slate-400 text-xs transform transition-transform duration-200" :class="showEquipmentDropdown ? 'rotate-180' : ''">▼</span>
                                </div>

                                <div v-if="showEquipmentDropdown" class="fixed inset-0 z-10" @click="showEquipmentDropdown = false"></div>

                                <Transition name="dropdown">
                                    <div v-if="showEquipmentDropdown" class="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-100 rounded-xl shadow-xl z-30 max-h-60 overflow-y-auto custom-scrollbar">
                                        <ul class="py-2">
                                            <li 
                                                @click="selectEquipment('')" 
                                                class="px-5 py-3 hover:bg-indigo-50 cursor-pointer font-bold text-slate-600 hover:text-indigo-600 transition-colors border-b border-slate-50 last:border-none text-sm"
                                            >
                                                All garages
                                            </li>
                                            <li 
                                                v-for="eq in equipmentList" 
                                                :key="eq.id" 
                                                @click="selectEquipment(eq.id)"
                                                class="px-5 py-3 hover:bg-indigo-50 cursor-pointer font-bold text-slate-600 hover:text-indigo-600 transition-colors border-b border-slate-50 last:border-none text-sm flex items-center justify-between"
                                            >
                                                {{ eq.name }}
                                                <span v-if="selectedEquipment === eq.id" class="text-indigo-600">✓</span>
                                            </li>
                                        </ul>
                                    </div>
                                </Transition>
                            </div>
                        </div>

                        <div class="p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row gap-3 shrink-0 rounded-b-3xl">
                            <button 
                                v-if="dateFrom || dateTo || selectedEquipment"
                                @click="clearFilters" 
                                class="py-3 px-4 bg-red-50 text-red-600 border border-red-100 font-bold uppercase rounded-xl hover:bg-red-100 transition-colors text-sm"
                            >
                                Clear
                            </button>
                            <button @click="showFilters = false" class="flex-1 py-3 px-4 bg-white border border-slate-200 text-slate-600 font-bold uppercase rounded-xl hover:bg-slate-100 transition-colors text-sm">
                                Cancel
                            </button>
                            <button @click="fetchAnalytics" class="flex-1 py-3 px-4 bg-indigo-600 text-white font-bold uppercase rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-indigo-300 transition-all transform active:scale-95 text-sm">
                                Apply
                            </button>
                        </div>
                    </div>
                </div>
            </Transition>
          </Teleport>

          <Teleport to="body">
            <Transition name="fade-scale">
                <div v-if="showDatePicker" class="fixed inset-0 z-[2000] flex items-center justify-center p-4">
                    <div class="absolute inset-0 bg-transparent transition-opacity" @click="showDatePicker = false"></div>

                    <div class="relative bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm border border-slate-200 animate-in zoom-in duration-200">
                        <div class="flex justify-between items-center mb-5">
                             <h3 class="font-black uppercase text-slate-800 text-base">
                                 Select Date <span class="text-indigo-600">{{ pickerTarget === 'from' ? '(Start)' : '(End)' }}</span>
                             </h3>
                             <button @click="showDatePicker = false" class="btn btn-sm btn-circle btn-ghost text-slate-500 hover:bg-slate-100">✕</button>
                        </div>

                        <div class="flex justify-between items-center mb-4 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                            <button @click="changeMonth(-1)" class="btn btn-sm btn-circle btn-ghost text-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50">‹</button>
                            <span class="font-black uppercase text-slate-800 tracking-wider text-sm">{{ monthName }}</span>
                            <button @click="changeMonth(1)" class="btn btn-sm btn-circle btn-ghost text-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50">›</button>
                        </div>

                        <div class="grid grid-cols-7 text-center mb-2">
                            <span v-for="d in ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']" :key="d" class="text-[10px] font-bold text-slate-400 uppercase">{{ d }}</span>
                        </div>
                        <div class="grid grid-cols-7 gap-1 text-center">
                            <button 
                                v-for="(date, i) in daysInMonth" :key="i" 
                                @click="date && selectDate(date)"
                                :disabled="!date"
                                :class="['w-full aspect-square rounded-xl flex items-center justify-center text-sm font-bold transition-all',
                                    !date ? 'opacity-0 cursor-default' : 
                                    (formatDateLocal(date) === (pickerTarget === 'from' ? dateFrom : dateTo)) 
                                        ? 'bg-indigo-600 text-white shadow-md scale-105' 
                                        : 'bg-white hover:bg-indigo-50 text-slate-700 border border-slate-200']"
                            >
                                {{ date ? date.getDate() : '' }}
                            </button>
                        </div>
                    </div>
                </div>
            </Transition>
          </Teleport>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div class="card bg-white p-6 rounded-3xl shadow-xl border border-indigo-50">
                  <h3 class="font-black text-lg text-slate-700 mb-4 uppercase">Revenue Over Time</h3>
                  <div class="h-64">
                      <Line v-if="revenueChartData.labels.length" :data="revenueChartData" :options="{responsive: true, maintainAspectRatio: false}" />
                      <div v-else class="h-full flex items-center justify-center text-slate-400 font-bold">No data</div>
                  </div>
              </div>

              <div class="card bg-white p-6 rounded-3xl shadow-xl border border-indigo-50 flex flex-col">
                  <h3 class="font-black text-lg text-slate-700 mb-4 uppercase">Popularity (Top 10)</h3>
                  <div class="flex-1 flex flex-col sm:flex-row items-center gap-6">
                      <div class="w-full sm:w-1/2 h-48 relative">
                          <Doughnut v-if="popularityChartData.labels.length" :data="popularityChartData" :options="doughnutOptions" />
                          <div v-else class="h-full flex items-center justify-center text-slate-400 font-bold">No data</div>
                          
                          <div v-if="popularityChartData.labels.length" class="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <span class="text-2xl font-black text-slate-300 opacity-20">TOP</span>
                          </div>
                      </div>

                      <div class="w-full sm:w-1/2">
                          <ul class="space-y-2">
                              <li v-for="(item, i) in popularityLegend" :key="i" class="flex items-center justify-between text-xs group cursor-default">
                                  <div class="flex items-center gap-2 overflow-hidden">
                                      <span class="w-3 h-3 rounded-full shrink-0" :style="{ backgroundColor: item.color }"></span>
                                      <span class="font-bold text-slate-600 truncate group-hover:text-slate-900 transition-colors" :title="item.label">{{ item.label }}</span>
                                  </div>
                                  <span class="font-black text-slate-800 bg-slate-100 px-2 py-1 rounded-md">{{ item.value }}</span>
                              </li>
                          </ul>
                      </div>
                  </div>
              </div>
          </div>

          <div class="card bg-white p-6 rounded-3xl shadow-xl border border-indigo-50 overflow-x-auto">
              <div class="mb-6">
                  <h3 class="font-black text-lg text-slate-700 uppercase">Occupancy Map</h3>
                  <p class="text-sm text-slate-500 mt-1 max-w-2xl">
                      Workshop traffic intensity visualization. <span class="font-bold text-indigo-600">Darker color</span> means higher occupancy.
                      Horizontal axis is <span class="font-bold">hours</span>, vertical axis is <span class="font-bold">days of week</span>.
                  </p>
              </div>
              
              <div class="min-w-[800px]">
                  <div class="grid grid-cols-[50px_repeat(24,_1fr)] gap-1 text-[10px] font-bold text-center">
                      <div class="text-slate-400">D/H</div>
                      <div v-for="h in hoursOfDay" :key="h" class="text-slate-400">{{ h }}</div>
                      
                      <template v-for="(day, dIndex) in daysOfWeek" :key="day">
                          <div class="text-slate-600 flex items-center justify-center">{{ day }}</div>
                          <div v-for="(count, hIndex) in heatmapData[dIndex]" :key="hIndex" 
                               :class="getHeatmapColor(count)" 
                               class="aspect-square flex items-center justify-center rounded-sm transition-all hover:scale-110 cursor-help"
                               :title="`Hour: ${hIndex}:00, Count: ${count}`">
                              {{ count > 0 ? count : '' }}
                          </div>
                      </template>
                  </div>
              </div>
          </div>
      </div>

      <div v-else-if="activeTab === 'ml'" class="space-y-8 animate-in fade-in zoom-in duration-300">
          <div class="card bg-white p-8 rounded-3xl shadow-xl border border-slate-200 text-center">
              <h2 class="text-2xl font-black text-indigo-900 uppercase mb-4">Association Rules (ML)</h2>
                <div class="flex flex-wrap justify-center gap-4">
                    <button @click="fetchMLRules" :disabled="mlLoading" class="btn bg-indigo-600 hover:bg-indigo-700 text-white border-none rounded-xl font-bold uppercase px-8">
                        {{ mlLoading ? 'Analyzing...' : 'Generate from Database' }}
                    </button>
                    <button @click="$refs.mlSimInput.click()" :disabled="mlLoading" class="btn btn-outline btn-secondary rounded-xl font-bold uppercase px-8">
                        📁 Analyze from file
                    </button>
                    <button @click="exportML" :disabled="loadingML" class="btn bg-white border-slate-300 text-slate-600 font-bold uppercase rounded-xl px-8 hover:bg-slate-50">
                        Download ML Report
                    </button>
                    <input type="file" ref="mlSimInput" class="hidden" accept=".csv" @change="handleMLSimFileUpload" />
                </div>
          </div>
          
          <div v-if="mlRules.length > 0">
              <div class="flex justify-end mb-4">
                  <div class="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200">
                      <span class="text-xs font-black uppercase text-slate-400">Sort by:</span>
                      <select v-model="mlSortOrder" class="select select-sm font-bold text-indigo-600 bg-white border-none outline-none focus:ring-0 cursor-pointer">
                          <option value="confidence_desc">Confidence (Highest)</option>
                          <option value="confidence_asc">Confidence (Lowest)</option>
                          <option value="lift_desc">Rule Strength (Lift)</option>
                      </select>
                  </div>
              </div>

              <div class="grid grid-cols-1 gap-4">
                  <div v-for="(rule, i) in paginatedMLRules" :key="i" class="card bg-white border-l-8 border-indigo-500 shadow-md p-6 flex flex-col md:flex-row items-center gap-6 hover:shadow-lg transition-shadow">
                      <div class="bg-indigo-50 p-4 rounded-full text-indigo-600 shrink-0"><span class="text-2xl">💡</span></div>
                      <div class="flex-1 text-center md:text-left">
                          <h3 class="font-bold text-slate-800 text-lg mb-1">{{ rule.przyczyna }} <span class="text-slate-400 mx-2">➞</span> <span class="text-indigo-600">{{ rule.skutek }}</span></h3>
                          <p class="text-slate-600 text-sm italic">"{{ rule.opis }}"</p>
                      </div>
                      <div class="text-center md:text-right min-w-[120px] shrink-0 mt-4 md:mt-0">
                          <div class="text-xs text-slate-400 uppercase font-bold mb-1">Confidence</div>
                          <div class="text-xl font-black text-slate-800">{{ rule.confidence }}%</div>
                          <div class="badge font-bold mt-2" :class="getConfidenceBadgeClass(rule.color_class)">{{ rule.sila }}</div>
                      </div>
                  </div>
              </div>

              <div v-if="totalMLPages > 1" class="flex justify-center items-center gap-4 mt-8 pb-8">
                <button @click="prevPageML" :disabled="mlPage === 1" class="btn btn-sm btn-ghost font-bold text-slate-500 disabled:text-slate-300">← Previous</button>
                <span class="text-xs font-black uppercase text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg">Page {{ mlPage }} of {{ totalMLPages }}</span>
                <button @click="nextPageML" :disabled="mlPage === totalMLPages" class="btn btn-sm btn-ghost font-bold text-slate-500 disabled:text-slate-300">Next →</button>
            </div>
          </div>
          <div v-else-if="mlMessage" class="text-center py-10 text-slate-400 font-bold">
              {{ mlMessage }}
          </div>

          <div class="mt-12">
                <div class="card bg-white p-8 rounded-3xl shadow-xl border border-slate-200 text-center">
                    <div class="p-4 bg-blue-50 text-blue-600 rounded-full mb-4 inline-flex mx-auto">
                        <span class="text-4xl">🌳</span>
                    </div>
                    <h2 class="text-2xl font-black text-slate-800 uppercase mb-2">Success Decision Tree</h2>
                    <p class="text-slate-500 mb-6 max-w-2xl mx-auto">
                        The model analyzes which factors (time of day, equipment) affect whether a reservation is <span class="font-bold text-indigo-600">Completed (Success)</span> or <span class="font-bold text-red-500">Canceled</span>.
                    </p>

                    <div class="flex flex-col md:flex-row justify-center gap-4 mb-8">
                        <button @click="fetchDecisionTree" :disabled="treeLoading" class="btn bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase rounded-xl px-8 shadow-lg shadow-blue-200">
                            {{ treeLoading ? 'Training...' : 'Generate from Database' }}
                        </button>
                        <button @click="$refs.treeSimInput.click()" :disabled="treeLoading" class="btn bg-amber-500 hover:bg-amber-600 text-white font-bold uppercase rounded-xl px-8 shadow-lg shadow-amber-200">
                            📁 Simulate from file
                        </button>
                        <input type="file" ref="treeSimInput" class="hidden" accept=".csv" @change="handleTreeSimFileUpload" />
                        <button @click="exportDecisionTreeCSV" class="btn bg-white border-slate-300 text-slate-600 font-bold uppercase rounded-xl px-8 hover:bg-slate-50">
                            Download Data (CSV)
                        </button>
                    </div>

                    <div v-if="treeImage" class="animate-in zoom-in duration-500 mt-4 border-2 border-dashed border-slate-200 rounded-xl p-4 bg-slate-50 overflow-auto">
                        <img :src="treeImage" alt="Decision Tree Visualization" class="mx-auto max-w-full rounded-lg shadow-sm" />
                        <p class="text-xs text-slate-400 mt-2 font-mono">Classification visualization: Completed vs Canceled</p>
                    </div>
                </div>
            </div>
      </div>

      <div v-else-if="activeTab === 'data'" class="animate-in fade-in zoom-in duration-300">
          <div class="card bg-white border border-slate-200 shadow-xl rounded-3xl p-8 flex flex-col gap-6 items-center text-center">
              <div class="p-4 bg-emerald-50 text-emerald-600 rounded-full mb-2"><span class="text-4xl">📂</span></div>
              <h2 class="text-2xl font-black text-slate-800 uppercase">History Management</h2>
              
              <div class="flex flex-col md:flex-row justify-center gap-4 w-full md:w-auto">
                  <button @click="exportHistory" :disabled="loadingHistory" class="btn bg-white border-slate-300 hover:bg-slate-50 text-slate-700 font-bold uppercase rounded-xl px-8 py-3 h-auto min-h-[3rem] shadow-sm w-full md:w-auto">
                      {{ loadingHistory ? 'Downloading...' : 'Export CSV' }}
                  </button>
                  <button @click="$refs.fileInput.click()" :disabled="importing" class="btn bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase rounded-xl shadow-lg shadow-emerald-200 px-8 py-3 h-auto min-h-[3rem] w-full md:w-auto">
                      {{ importing ? 'Uploading...' : 'Simulate from file' }}
                  </button>
              </div>
              <p class="text-xs text-slate-400 font-bold max-w-md">The "Simulate from file" function lets you upload data for analysis without saving it in the database.</p>
              
              <input type="file" ref="fileInput" class="hidden" accept=".csv" @change="handleFileUpload" />
              <p v-if="importMessage" :class="importError ? 'text-red-500' : 'text-green-600'" class="text-xs font-bold">{{ importMessage }}</p>
          </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: opacity 0.3s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-active .relative, .modal-leave-active .relative { transition: all 0.3s ease-out; }
.modal-enter-from .relative, .modal-leave-to .relative { transform: scale(0.95); opacity: 0; }

.fade-scale-enter-active, .fade-scale-leave-active { transition: all 0.2s ease; }
.fade-scale-enter-from, .fade-scale-leave-to { opacity: 0; transform: scale(0.9); }

.dropdown-enter-active, .dropdown-leave-active { transition: all 0.2s ease; max-height: 240px; opacity: 1; }
.dropdown-enter-from, .dropdown-leave-to { max-height: 0; opacity: 0; transform: translateY(-10px); }
</style>