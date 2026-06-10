import { listenToRealtime, listenToHistory, saveSession } from '../data/repository.js';
import { 
    calculateAsymmetryPercentage, 
    getIdentificationStatus, 
    getTreatmentRecommendation,
    getNormalGripByAge
} from '../domain/gripUseCase.js';

// Catatan: ESP32 mengirim data realtime ke path "patient_001". 
// Kita anggap ini sebagai "ID Channel Alat/Hardware Aktif"
const ESP32_CHANNEL = "patient_001"; 

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

// Fungsi Render Grafik (Chart.js)
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

// Fungsi Update Tabel & Panggil Render Grafik
function updateHistoryUI(historyData) {
    historyBody.innerHTML = '';
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

    renderChart(historyData);
}

// 1. Listen to Realtime Data dari Hardware
listenToRealtime(ESP32_CHANNEL, (data) => {
    currentRealtimeData.left = data.left_grip_kg || 0;
    currentRealtimeData.right = data.right_grip_kg || 0;

    elLeft.textContent = currentRealtimeData.left.toFixed(1);
    elRight.textContent = currentRealtimeData.right.toFixed(1);

    const MAX_GRIP = 100; 
    const leftRotation = Math.min((currentRealtimeData.left / MAX_GRIP) * 180 - 135, 45);
    const rightRotation = Math.min((currentRealtimeData.right / MAX_GRIP) * 180 - 135, 45);

    document.getElementById('gauge-fill-left').style.transform = `rotate(${leftRotation}deg)`;
    document.getElementById('gauge-fill-right').style.transform = `rotate(${rightRotation}deg)`;

    if (data.device_status === 'connected') {
        elConn.textContent = "Alat Terhubung";
        elConn.className = "status-badge connected";
    } else {
        elConn.textContent = "Alat Terputus";
        elConn.className = "status-badge disconnected";
    }

    const asymPercent = calculateAsymmetryPercentage(currentRealtimeData.right, currentRealtimeData.left);
    const idStatus = getIdentificationStatus(asymPercent);
    const treatment = getTreatmentRecommendation(currentRealtimeData.right, currentRealtimeData.left, asymPercent);

    elAsym.textContent = `${asymPercent}%`;
    elStatus.textContent = idStatus;
    elRecom.textContent = treatment;
});

// 2. Save Session Action (Menggunakan .onclick untuk membersihkan cache event listener)
btnSave.onclick = () => {
    const name = document.getElementById('patient-name').value.trim();
    const age = document.getElementById('patient-age').value.trim();
    const job = document.getElementById('patient-job').value.trim();

    // BLOKIR JIKA ADA FORM YANG KOSONG
    if (name === "" || age === "" || job === "") {
        alert("PERINGATAN: Nama, Umur, dan Pekerjaan TIDAK BOLEH KOSONG!");
        return; 
    }

    // MEMBUAT PATIENT ID DINAMIS (Contoh: "Budi Santoso" -> "patient_budi_santoso")
    // Ini menyelesaikan masalah ID yang hardcoded
    const dynamicPatientId = "patient_" + name.toLowerCase().replace(/[^a-z0-9]/g, '_');

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

    // Eksekusi penyimpanan ke ID Pasien yang spesifik
    saveSession(dynamicPatientId, payload)
        .then(() => {
            alert(`Sesi pengukuran berhasil disimpan ke rekam medis: ${name}`);
            
            // Kosongkan form kembali setelah sukses
            document.getElementById('patient-name').value = '';
            document.getElementById('patient-age').value = '';
            document.getElementById('patient-job').value = '';

            // Tampilkan grafik dan tabel HANYA untuk pasien yang bersangkutan
            listenToHistory(dynamicPatientId, updateHistoryUI);
        })
        .catch((error) => console.error("Gagal menyimpan:", error));
};
