import { listenToRealtime, listenToHistory, saveSession } from '../data/repository.js';
import { 
    calculateAsymmetryPercentage, 
    getIdentificationStatus, 
    getTreatmentRecommendation,
    getNormalGripByAge
} from '../domain/gripUseCase.js';

const HARDWARE_CHANNEL = "patient_001"; 
let currentRealtimeData = { left: 0, right: 0 };
let gripChartInstance = null;

// DOM Binding Elements
const elLeft = document.getElementById('val-left');
const elRight = document.getElementById('val-right');
const elAsym = document.getElementById('val-asymmetry');
const elStatus = document.getElementById('val-status');
const elRecom = document.getElementById('val-recommendation');
const elConn = document.getElementById('connection-status');
const btnSave = document.getElementById('btn-save');
const historyBody = document.getElementById('history-body');

// Render Engine untuk Chart.js
function renderChart(historyData) {
    const ctx = document.getElementById('historyChart').getContext('2d');
    if (gripChartInstance) gripChartInstance.destroy();

    const labels = [];
    const leftData = [];
    const rightData = [];
    const baselineData = [];

    // Mengambil data riwayat urut waktu normal (kiri ke kanan)
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
                { label: 'Tangan Kiri (Kg)', data: leftData, borderColor: '#1976D2', backgroundColor: 'rgba(25, 118, 210, 0.05)', borderWidth: 2, tension: 0.3, fill: true },
                { label: 'Tangan Kanan (Kg)', data: rightData, borderColor: '#2E7D32', backgroundColor: 'rgba(46, 125, 50, 0.05)', borderWidth: 2, tension: 0.3, fill: true },
                { label: 'Standar Umur (Kg)', data: baselineData, borderColor: '#121212', borderWidth: 1.5, borderDash: [6, 6], fill: false, pointRadius: 0 }
            ]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { tooltip: { mode: 'index', intersect: false } }
        }
    });
}

// Handler Pembaruan UI Tabel
function updateHistoryUI(historyData) {
    historyBody.innerHTML = '';
    if(historyData.length === 0) {
        historyBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #666666;">Tidak ada rekam medis untuk ID pasien ini.</td></tr>`;
        if (gripChartInstance) gripChartInstance.destroy();
        return;
    }

    // Urutkan descending (terbaru di atas) untuk interface tabel
    const sortedData = [...historyData].sort((a, b) => b.timestamp - a.timestamp);
    
    sortedData.forEach(item => {
        const d = new Date(item.timestamp);
        const timeStr = `${d.getDate()}/${d.getMonth()+1} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
        const pName = item.patient_info?.name || "Anonim";
        
        const tr = document.createElement('tr');
        tr.setAttribute('data-name', pName.toLowerCase()); // Menyimpan token nama untuk filter lokal
        
        tr.innerHTML = `
            <td>${timeStr}</td>
            <td><strong>${pName}</strong></td>
            <td>${item.left_grip_kg.toFixed(1)}</td>
            <td>${item.right_grip_kg.toFixed(1)}</td>
            <td>${item.asymmetry_percentage}%</td>
            <td><span style="color: ${item.asymmetry_percentage > 10 ? '#D32F2F':'#2E7D32'}; font-weight: bold;">${item.status}</span></td>
        `;
        historyBody.appendChild(tr);
    });

    renderChart(historyData);
}

// 1. Sinkronisasi Data Real-time & Speedometer Meteran
listenToRealtime(HARDWARE_CHANNEL, (data) => {
    currentRealtimeData.left = data.left_grip_kg || 0;
    currentRealtimeData.right = data.right_grip_kg || 0;

    elLeft.textContent = currentRealtimeData.left.toFixed(1);
    elRight.textContent = currentRealtimeData.right.toFixed(1);

    // Animasi Speedometer Berdasarkan Batas Atas Beban (Max 100Kg)
    const MAX_GRIP = 100; 
    const leftRot = Math.min((currentRealtimeData.left / MAX_GRIP) * 180 - -135 - 270, 45);
    const rightRot = Math.min((currentRealtimeData.right / MAX_GRIP) * 180 - -135 - 270, 45);

    document.getElementById('gauge-fill-left').style.transform = `rotate(${leftRot}deg)`;
    document.getElementById('gauge-fill-right').style.transform = `rotate(${rightRot}deg)`;

    if (data.device_status === 'connected') {
        elConn.textContent = "Alat Terhubung"; elConn.className = "status-badge connected";
    } else {
        elConn.textContent = "Alat Terputus"; elConn.className = "status-badge disconnected";
    }

    const asym = calculateAsymmetryPercentage(currentRealtimeData.right, currentRealtimeData.left);
    elAsym.textContent = `${asym}%`;
    elStatus.textContent = getIdentificationStatus(asym);
    elRecom.textContent = getTreatmentRecommendation(currentRealtimeData.right, currentRealtimeData.left, asym);
});

// 2. Aksi Tombol Simpan Sesi (Dengan Validasi Lapisan Formulir)
btnSave.onclick = () => {
    const rawId = document.getElementById('patient-id').value.trim();
    const name = document.getElementById('patient-name').value.trim();
    const age = document.getElementById('patient-age').value.trim();
    const job = document.getElementById('patient-job').value.trim();

    // BLOKIR JIKA FORMULIR KOSONG
    if (rawId === "" || name === "" || age === "" || job === "") {
        alert("PERINGATAN: ID Pasien, Nama, Umur, dan Pekerjaan wajib diisi lengkap sebelum menyimpan data!");
        return; 
    }

    const cleanPatientId = rawId.replace(/\s+/g, '_').toLowerCase();
    const asym = calculateAsymmetryPercentage(currentRealtimeData.right, currentRealtimeData.left);

    const payload = {
        patient_info: { name, age, job },
        left_grip_kg: currentRealtimeData.left,
        right_grip_kg: currentRealtimeData.right,
        asymmetry_percentage: parseFloat(asym),
        status: getIdentificationStatus(asym),
        timestamp: Date.now()
    };

    saveSession(cleanPatientId, payload)
        .then(() => {
            alert(`Sesi berhasil disimpan ke ID: ${rawId}`);
            // Kosongkan form kembali
            document.getElementById('patient-id').value = '';
            document.getElementById('patient-name').value = '';
            document.getElementById('patient-age').value = '';
            document.getElementById('patient-job').value = '';
            
            // Tampilkan manifes riwayat untuk pasien bersangkutan
            listenToHistory(cleanPatientId, updateHistoryUI);
        })
        .catch((err) => console.error("Gagal melakukan transmisi data:", err));
};

// 3. Fitur Pencarian Database Melalui ID Pasien
document.getElementById('btn-search-db').onclick = () => {
    const targetId = document.getElementById('search-db-id').value.trim();
    if (targetId === "") {
        alert("Silakan masukkan ID Pasien terlebih dahulu.");
        return;
    }
    const cleanSearchId = targetId.replace(/\s+/g, '_').toLowerCase();
    listenToHistory(cleanSearchId, updateHistoryUI);
};

// 4. Fitur Penapis (Filtering) Lokal Berdasarkan Karakter Nama
document.getElementById('filter-table-name').addEventListener('keyup', function(e) {
    const token = e.target.value.toLowerCase();
    const rows = historyBody.getElementsByTagName('tr');

    for (let i = 0; i < rows.length; i++) {
        const rowName = rows[i].getAttribute('data-name');
        if(!rowName) continue; // Abaikan jika baris kosong bawaan
        
        if (rowName.includes(token)) {
            rows[i].style.display = "";
        } else {
            rows[i].style.display = "none";
        }
    }
});
