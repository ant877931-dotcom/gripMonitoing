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

export function listenToAllHistory(callback) {
    const historyRef = ref(db, `monitoring/history`);
    onValue(historyRef, (snapshot) => {
        const allHistoryData = [];
        if (snapshot.exists()) {
            snapshot.forEach((patientNode) => {
                const patientId = patientNode.key;
                patientNode.forEach((recordNode) => {
                    allHistoryData.push({ 
                        id: recordNode.key, 
                        db_patient_id: patientId, 
                        ...recordNode.val() 
                    });
                });
            });
        }
        callback(allHistoryData);
    });
}

export function saveSession(patientId, data) {
    const historyRef = ref(db, `monitoring/history/${patientId}`);
    const newSessionRef = push(historyRef);
    return set(newSessionRef, data);
}

export function clearRealtimeData(patientId) {
    const realtimeRef = ref(db, `monitoring/realtime/${patientId}`);
    return set(realtimeRef, {
        left_grip_kg: 0,
        right_grip_kg: 0,
        device_status: "connected",
        last_updated: Date.now()
    });
}
