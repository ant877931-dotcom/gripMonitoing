import { db } from '../core/firebase-config.js';
import { ref, onValue, push, set } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

export function listenToRealtime(patientId, callback) {
    const realtimeRef = ref(db, `monitoring/realtime/${patientId}`);
    onValue(realtimeRef, (snapshot) => {
        if (snapshot.exists()) {
            callback(snapshot.val());
        } else {
            callback({ right_grip_kg: 0, left_grip_kg: 0, device_status: "disconnected" });
        }
    });
}

export function listenToHistory(patientId, callback) {
    const historyRef = ref(db, `monitoring/history/${patientId}`);
    onValue(historyRef, (snapshot) => {
        const historyData = [];
        if (snapshot.exists()) {
            snapshot.forEach((child) => {
                historyData.push({ id: child.key, ...child.val() });
            });
        }
        callback(historyData);
    });
}

export function saveSession(patientId, data) {
    const historyRef = ref(db, `monitoring/history/${patientId}`);
    const newSessionRef = push(historyRef);
    return set(newSessionRef, data);
}
