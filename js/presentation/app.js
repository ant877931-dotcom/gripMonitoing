import { listenToRealtime, listenToHistory, saveSession } from '../data/repository.js';
import { 
    calculateAsymmetryPercentage, 
    getIdentificationStatus, 
    getTreatmentRecommendation,
    getNormalGripByAge
} from '../domain/gripUseCase.js';

const PATIENT_ID = "patient_001";
let currentRealtimeData = { left: 0, right: 0 };
let gripChartInstance = null;

// DOM Elements
const elLeft = document.getElementById('val-left');
const elRight = document.getElementById('val-right');
const elAsym = document.getElementById('val-asymmetry');
const elStatus = document.getElementById('val-status');
const elRecom = document.getElementById('val-recommendation');
const elConn = document.getElementById('connection-status');
const btnSave = document.getElementById('btn-save');
const historyBody = document.getElementById('history-body');

// Chart Render Function
function renderChart(historyData) {
    const ctx = document.getElementById('historyChart').getContext('2d');
    if (gripChartInstance) gripChartInstance.destroy();

    const labels = [];
    const leftData = [];
    const rightData = [];
    const baselineData = [];

    historyData.forEach(record => {
        const d = new Date(record.timestamp);
        labels.push(`${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`);
        leftData.push(record.left_grip_kg);
        rightData.push(record.right_grip_kg);
        const age = record.patient_info?.age || 20;
        baselineData.push(getNormalGripByAge(age));
    });

    gripChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'Tangan Kiri (Kg)', data: leftData, borderColor: '#1976D2', backgroundColor: 'rgba(25, 118, 210, 0.1)', borderWidth: 2, tension: 0.3, fill: true },
                { label: 'Tangan Kanan (Kg)', data: rightData, borderColor: '#2E7D32', backgroundColor: 'rgba(46, 125, 50, 0.1)', borderWidth: 2, tension: 0.3, fill: true },
                { label: 'Standar Normal Umur (Kg)', data: baselineData, borderColor: '#000000', borderWidth: 2, borderDash: [5, 5], fill: false, pointRadius: 0 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

// 1. Listen to Realtime Data
// Ganti blok listenToRealtime di dalam js/presentation/app.js

listenToRealtime(PATIENT_ID, (data) => {
    currentRealtimeData.left = data.left_grip_kg || 0;
    currentRealtimeData.right = data.right_grip_kg || 0;

    // 1. Update Teks Nilai
    elLeft.textContent = currentRealtimeData.left.toFixed(1);
    elRight.textContent = currentRealtimeData.right.toFixed(1);

    // 2. Kalkulasi Rotasi Speedometer (Asumsi nilai maksimal alat adalah 100 Kg)
    const MAX_GRIP = 100; // Ubah angka ini jika spesifikasi maksimal load cell Anda berbeda
    
    // Formula CSS: -135deg (0%) sampai 45deg (100%) = Rentang 180 derajat
    const leftRotation = Math.min((currentRealtimeData.left / MAX_GRIP) * 180 - 135, 45);
    const rightRotation = Math.min((currentRealtimeData.right / MAX_GRIP) * 180 - 135, 45);

    // 3. Aplikasikan Animasi CSS
    document.getElementById('gauge-fill-left').style.transform = `rotate(${leftRotation}deg)`;
    document.getElementById('gauge-fill-right').style.transform = `rotate(${rightRotation}deg)`;

    // 4. Update Status Koneksi
    if (data.device_status === 'connected') {
        elConn.textContent = "Alat Terhubung";
        elConn.className = "status-badge connected";
    } else {
        elConn.textContent = "Alat Terputus";
        elConn.className = "status-badge disconnected";
    }

    // 5. Update Analisis Asimetri
    const asymPercent = calculateAsymmetryPercentage(currentRealtimeData.right, currentRealtimeData.left);
    const idStatus = getIdentificationStatus(asymPercent);
    const treatment = getTreatmentRecommendation(currentRealtimeData.right, currentRealtimeData.left, asymPercent);

    elAsym.textContent = `${asymPercent}%`;
    elStatus.textContent = idStatus;
    elRecom.textContent = treatment;
});

// 2. Listen to History Data & Update Table/Chart
listenToHistory(PATIENT_ID, (historyData) => {
    historyBody.innerHTML = '';
    
    // Sort descending (terbaru di atas) untuk tabel
    const sortedData = [...historyData].sort((a, b) => b.timestamp - a.timestamp);
    
    sortedData.forEach(item => {
        const d = new Date(item.timestamp);
        const timeStr = `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()} ${d.getHours()}:${d.getMinutes()}`;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${timeStr}</td>
            <td>${item.left_grip_kg}</td>
            <td>${item.right_grip_kg}</td>
            <td>${item.asymmetry_percentage}%</td>
            <td>${item.status}</td>
        `;
        historyBody.appendChild(tr);
    });

    // Render chart menggunakan data ascending (waktu normal kiri ke kanan)
    renderChart(historyData);
});

// 3. Save Session Action
btnSave.addEventListener('click', () => {
    // Ambil nilai dan gunakan trim() untuk menghapus spasi kosong di awal/akhir
    const name = document.getElementById('patient-name').value.trim();
    const age = document.getElementById('patient-age').value.trim();
    const job = document.getElementById('patient-job').value.trim();

    // --- BLOK VALIDASI FORM ---
    if (!name || !age || !job) {
        alert("Peringatan: Mohon lengkapi data Nama, Umur, dan Pekerjaan sebelum menyimpan sesi!");
        return; // Hentikan proses eksekusi di sini, jangan lanjut ke Firebase
    }
    // --------------------------

    const asymPercent = calculateAsymmetryPercentage(currentRealtimeData.right, currentRealtimeData.left);
    const idStatus = getIdentificationStatus(asymPercent);

    const payload = {
        patient_info: { name, age, job },
        left_grip_kg: currentRealtimeData.left,
        right_grip_kg: currentRealtimeData.right,
        asymmetry_percentage: parseFloat(asymPercent),
        status: idStatus,
        timestamp: Date.now()
    };

    saveSession(PATIENT_ID, payload)
        .then(() => {
            alert("Data sesi pengukuran berhasil disimpan!");
            
            // Opsional UX: Kosongkan form kembali setelah data berhasil disimpan
            document.getElementById('patient-name').value = '';
            document.getElementById('patient-age').value = '';
            document.getElementById('patient-job').value = '';
        })
        .catch((error) => {
            console.error("Gagal menyimpan:", error);
            alert("Terjadi kesalahan saat menyimpan data ke server.");
        });
});
