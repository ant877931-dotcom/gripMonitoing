import { listenToRealtime, listenToAllHistory, saveSession, clearRealtimeData } from '../data/repository.js';
import { 
    calculateAsymmetryPercentage, 
    getIdentificationStatus, 
    getTreatmentRecommendation,
    getNormalGrip
} from '../domain/gripUseCase.js';

const HARDWARE_CHANNEL = "patient_001"; 
let currentRealtimeData = { left: 0, right: 0 };

// VARIABEL BARU: Menyimpan angka tertinggi (Peak Hold)
let peakData = { left: 0, right: 0 }; 

let globalHistoryData = [];
let currentSearchId = ""; 

// ---> INI BARIS YANG SEMPAT HILANG <---
let gripChartInstance = null; 

const elLeft = document.getElementById('val-left');
const elRight = document.getElementById('val-right');
const elAsym = document.getElementById('val-asymmetry');
const elStatus = document.getElementById('val-status');
const elRecom = document.getElementById('val-recommendation');
const elConn = document.getElementById('connection-status');
const btnSave = document.getElementById('btn-save');
const btnResetWeb = document.getElementById('btn-reset-web');
const historyBody = document.getElementById('history-body');

function renderChart(historyData) {
    const ctx = document.getElementById('historyChart').getContext('2d');
    
    // Sekarang tidak akan error lagi di baris ini
    if (gripChartInstance) gripChartInstance.destroy();

    const labels = [];
    const leftData = [];
    const rightData = [];
    const baselineData = [];

    const ascData = [...historyData].sort((a, b) => a.timestamp - b.timestamp);

    ascData.forEach(record => {
        const d = new Date(record.timestamp);
        labels.push(`${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`);
        leftData.push(record.left_grip_kg);
        rightData.push(record.right_grip_kg);
        const age = record.patient_info?.age || 20;
        const gender = record.patient_info?.gender || 'L';
        baselineData.push(getNormalGrip(age, gender));
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
        options: { responsive: true, maintainAspectRatio: false, plugins: { tooltip: { mode: 'index', intersect: false } } }
    });
}

function updateHistoryUI(historyData) {
    historyBody.innerHTML = '';
    if(historyData.length === 0) {
        historyBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #666666;">Belum ada data riwayat.</td></tr>`;
        if (gripChartInstance) gripChartInstance.destroy();
        return;
    }

    const sortedData = [...historyData].sort((a, b) => b.timestamp - a.timestamp);
    
    sortedData.forEach(item => {
        const d = new Date(item.timestamp);
        const timeStr = `${d.getDate()}/${d.getMonth()+1} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
        const pName = item.patient_info?.name || "Anonim";
        const genderVal = item.patient_info?.gender;
        let genderStr = "-";
        if(genderVal === 'L') genderStr = "Laki-laki";
        else if (genderVal === 'P') genderStr = "Perempuan";
        
        const tr = document.createElement('tr');
        tr.setAttribute('data-name', pName.toLowerCase());
        
        tr.innerHTML = `
            <td>${timeStr}</td>
            <td><strong>${pName}</strong></td>
            <td>${genderStr}</td>
            <td>${item.left_grip_kg.toFixed(1)}</td>
            <td>${item.right_grip_kg.toFixed(1)}</td>
            <td>${item.asymmetry_percentage}%</td>
            <td><span style="color: ${item.asymmetry_percentage > 10 ? '#D32F2F':'#2E7D32'}; font-weight: bold;">${item.status}</span></td>
        `;
        historyBody.appendChild(tr);
    });

    renderChart(historyData);
}

function renderFilteredData() {
    let filtered = globalHistoryData;
    
    if (currentSearchId !== "") {
        filtered = filtered.filter(item => item.db_patient_id === currentSearchId);
    }
    
    const nameToken = document.getElementById('filter-table-name').value.toLowerCase();
    if (nameToken !== "") {
        filtered = filtered.filter(item => {
            const pName = (item.patient_info?.name || "anonim").toLowerCase();
            return pName.includes(nameToken);
        });
    }
    
    updateHistoryUI(filtered);
}

function resetDashboardUI() {
    peakData.left = 0;
    peakData.right = 0;
    
    elLeft.textContent = "0.0";
    elRight.textContent = "0.0";
    document.getElementById('gauge-fill-left').style.transform = `rotate(-135deg)`;
    document.getElementById('gauge-fill-right').style.transform = `rotate(-135deg)`;
    elAsym.textContent = "0%";
    elStatus.textContent = "-";
    elRecom.textContent = "Belum ada data genggaman aktif.";
}

listenToAllHistory((data) => {
    globalHistoryData = data;
    renderFilteredData();
});

listenToRealtime(HARDWARE_CHANNEL, (data) => {
    currentRealtimeData.left = data.left_grip_kg || 0;
    currentRealtimeData.right = data.right_grip_kg || 0;

    if (currentRealtimeData.left > peakData.left) peakData.left = currentRealtimeData.left;
    if (currentRealtimeData.right > peakData.right) peakData.right = currentRealtimeData.right;

    elLeft.textContent = peakData.left.toFixed(1);
    elRight.textContent = peakData.right.toFixed(1);

    const MAX_GRIP = 100; 
    const leftRot = Math.min((peakData.left / MAX_GRIP) * 180 - -135 - 270, 45);
    const rightRot = Math.min((peakData.right / MAX_GRIP) * 180 - -135 - 270, 45);

    document.getElementById('gauge-fill-left').style.transform = `rotate(${leftRot}deg)`;
    document.getElementById('gauge-fill-right').style.transform = `rotate(${rightRot}deg)`;

    if (data.device_status === 'connected') {
        elConn.textContent = "Alat Terhubung"; elConn.className = "status-badge connected";
    } else {
        elConn.textContent = "Alat Terputus"; elConn.className = "status-badge disconnected";
    }

    const asym = calculateAsymmetryPercentage(peakData.right, peakData.left);
    elAsym.textContent = `${asym}%`;
    elStatus.textContent = getIdentificationStatus(asym);
    elRecom.textContent = getTreatmentRecommendation(peakData.right, peakData.left, asym);
});

btnResetWeb.onclick = () => {
    if(confirm("Apakah Anda yakin ingin membatalkan angka saat ini dan mengulang pengukuran?")) {
        resetDashboardUI();
        clearRealtimeData(HARDWARE_CHANNEL).catch(err => console.error(err));
    }
};

btnSave.onclick = () => {
    const rawId = document.getElementById('patient-id').value.trim();
    const name = document.getElementById('patient-name').value.trim();
    const age = document.getElementById('patient-age').value.trim();
    const gender = document.getElementById('patient-gender').value.trim();
    const job = document.getElementById('patient-job').value.trim();

    if (rawId === "" || name === "" || age === "" || gender === "" || job === "") {
        alert("PERINGATAN: ID Pasien, Nama, Umur, Jenis Kelamin, dan Pekerjaan wajib diisi!");
        return; 
    }

    const cleanPatientId = rawId.replace(/\s+/g, '_').toLowerCase();
    const asym = calculateAsymmetryPercentage(peakData.right, peakData.left);

    const payload = {
        patient_info: { name, age, gender, job },
        left_grip_kg: peakData.left,
        right_grip_kg: peakData.right,
        asymmetry_percentage: parseFloat(asym),
        status: getIdentificationStatus(asym),
        timestamp: Date.now()
    };

    saveSession(cleanPatientId, payload)
        .then(() => {
            alert(`Sesi berhasil disimpan ke rekam medis ID: ${rawId}`);
            
            document.getElementById('patient-id').value = '';
            document.getElementById('patient-name').value = '';
            document.getElementById('patient-age').value = '';
            document.getElementById('patient-gender').value = '';
            document.getElementById('patient-job').value = '';
            
            resetDashboardUI();
            clearRealtimeData(HARDWARE_CHANNEL).catch(err => console.error(err));
            
            document.getElementById('search-db-id').value = "";
            document.getElementById('filter-table-name').value = "";
            currentSearchId = ""; 
            renderFilteredData();
        })
        .catch((err) => console.error("Gagal menyimpan data:", err));
};

document.getElementById('btn-search-db').onclick = () => {
    const targetId = document.getElementById('search-db-id').value.trim();
    
    if (targetId === "") {
        currentSearchId = "";
        renderFilteredData();
        return;
    }
    
    const cleanSearchId = targetId.replace(/\s+/g, '_').toLowerCase();
    const dataExists = globalHistoryData.some(item => item.db_patient_id === cleanSearchId);
    
    if (!dataExists) {
        alert(`Data riwayat untuk ID Pasien "${targetId}" tidak ditemukan! Menampilkan semua data...`);
        document.getElementById('search-db-id').value = ""; 
        currentSearchId = ""; 
    } else {
        currentSearchId = cleanSearchId;
    }
    
    renderFilteredData();
};

document.getElementById('filter-table-name').addEventListener('input', function() {
    renderFilteredData();
});
