import { 
    calculateAsymmetryPercentage, 
    getIdentificationStatus, 
    getTreatmentRecommendation 
} from "../domain/gripUseCase.js";

import { 
    listenToRealtime, 
    saveSession, 
    listenToHistory 
} from "../data/repository.js";

// DOM Elements
const patientIdInput = document.getElementById("patient-id");
const patientNameInput = document.getElementById("patient-name");
const patientAgeInput = document.getElementById("patient-age");
const patientJobInput = document.getElementById("patient-job");
const btnSaveSession = document.getElementById("btn-save-session");

const connectionStatusWrapper = document.getElementById("connection-status");
const connectionStatusText = connectionStatusWrapper.querySelector(".status-text");

const leftValueEl = document.getElementById("left-value");
const rightValueEl = document.getElementById("right-value");

const asymmetryValueEl = document.getElementById("asymmetry-value");
const statusBadgeEl = document.getElementById("status-badge");
const recommendationTextEl = document.getElementById("recommendation-text");

const historyBodyEl = document.getElementById("history-body");

// State
let currentPatientId = "";
let currentLeftGrip = 0;
let currentRightGrip = 0;
let currentAsymmetry = 0;
let currentStatus = "";

let realtimeUnsubscribe = null;
let historyUnsubscribe = null;

// Initialize
function init() {
    btnSaveSession.addEventListener("click", handleSaveSession);
    patientIdInput.addEventListener("change", handlePatientIdChange);
    
    // Auto-connect with default ID on load
    handlePatientIdChange();
}

// Handle Patient ID change to reconnect streams
function handlePatientIdChange() {
    const newPatientId = patientIdInput.value.trim();
    if (!newPatientId) return;

    if (currentPatientId === newPatientId) return; // No change

    // Cleanup previous listeners if any
    if (realtimeUnsubscribe) realtimeUnsubscribe();
    if (historyUnsubscribe) historyUnsubscribe();

    currentPatientId = newPatientId;

    // Start listening to real-time data
    realtimeUnsubscribe = listenToRealtime(currentPatientId, updateRealtimeUI);
    
    // Start listening to history data
    historyUnsubscribe = listenToHistory(currentPatientId, updateHistoryTable);
}

// Update UI with real-time data
function updateRealtimeUI(data) {
    if (!data) return;

    currentLeftGrip = data.left_grip_kg || 0;
    currentRightGrip = data.right_grip_kg || 0;
    const deviceStatus = data.device_status || "disconnected";

    // Update Gauges
    leftValueEl.textContent = currentLeftGrip.toFixed(1);
    rightValueEl.textContent = currentRightGrip.toFixed(1);

    // Update Status Indicator
    if (deviceStatus === "connected") {
        connectionStatusText.textContent = "Connected";
        connectionStatusWrapper.className = "connection-status connected";
    } else {
        connectionStatusText.textContent = "Disconnected";
        connectionStatusWrapper.className = "connection-status";
    }

    // Process Business Logic
    currentAsymmetry = calculateAsymmetryPercentage(currentRightGrip, currentLeftGrip);
    currentStatus = getIdentificationStatus(currentAsymmetry);
    const recommendation = getTreatmentRecommendation(currentRightGrip, currentLeftGrip, currentAsymmetry);

    // Update Analysis UI
    asymmetryValueEl.textContent = `${currentAsymmetry.toFixed(1)}%`;
    statusBadgeEl.textContent = currentStatus;
    
    if (currentAsymmetry > 10) {
        statusBadgeEl.className = "stat-value badge warning";
    } else {
        statusBadgeEl.className = "stat-value badge normal";
    }

    recommendationTextEl.textContent = recommendation;
}

// Save Session Handler
async function handleSaveSession(e) {
    e.preventDefault();

    if (!currentPatientId) {
        alert("ID Pasien tidak boleh kosong.");
        return;
    }

    const patientData = {
        name: patientNameInput.value.trim(),
        age: parseInt(patientAgeInput.value.trim(), 10) || 0,
        job: patientJobInput.value.trim()
    };

    if (!patientData.name) {
        alert("Harap lengkapi nama pasien.");
        return;
    }

    const sessionData = {
        timestamp: Date.now(),
        patient: patientData,
        left_grip_kg: currentLeftGrip,
        right_grip_kg: currentRightGrip,
        asymmetry_percentage: currentAsymmetry,
        status: currentStatus
    };

    try {
        btnSaveSession.disabled = true;
        btnSaveSession.textContent = "Menyimpan...";
        await saveSession(currentPatientId, sessionData);
        // Optional: show a small toast or just reset button text
    } catch (error) {
        console.error("Error saving session:", error);
        alert("Gagal menyimpan sesi. Periksa koneksi Anda.");
    } finally {
        btnSaveSession.disabled = false;
        btnSaveSession.textContent = "Simpan Sesi";
    }
}

// Update History Table UI
function updateHistoryTable(historyData) {
    if (!historyData || historyData.length === 0) {
        historyBodyEl.innerHTML = `<tr><td colspan="6" class="text-center">Belum ada riwayat data.</td></tr>`;
        return;
    }

    historyBodyEl.innerHTML = ""; // Clear existing rows

    historyData.forEach(record => {
        const date = new Date(record.timestamp);
        const formattedDate = `${date.toLocaleDateString('id-ID')} ${date.toLocaleTimeString('id-ID')}`;
        const patientName = record.patient?.name || "-";
        
        const tr = document.createElement("tr");
        
        // Status formatting
        const isWarning = record.asymmetry_percentage > 10;
        const statusColor = isWarning ? "var(--warning-color)" : "var(--primary-color)";
        const statusHtml = `<span style="color: ${statusColor}; font-weight: 600;">${record.status}</span>`;

        tr.innerHTML = `
            <td>${formattedDate}</td>
            <td>${patientName}</td>
            <td>${record.right_grip_kg.toFixed(1)}</td>
            <td>${record.left_grip_kg.toFixed(1)}</td>
            <td>${record.asymmetry_percentage.toFixed(1)}%</td>
            <td>${statusHtml}</td>
        `;
        historyBodyEl.appendChild(tr);
    });
}

// Boot up
init();
