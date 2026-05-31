import { db } from "../core/firebase-config.js";
import { ref, onValue, push, set } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

export function listenToRealtime(patientId, callback) {
    const realtimeRef = ref(db, `monitoring/realtime/${patientId}`);
    return onValue(realtimeRef, (snapshot) => {
        if (snapshot.exists()) {
            callback(snapshot.val());
        }
    });
}

export function listenToHistory(patientId, callback) {
    const historyRef = ref(db, `monitoring/history/${patientId}`);
    return onValue(historyRef, (snapshot) => {
        const historyData = [];
        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
                historyData.push({
                    id: childSnapshot.key,
                    ...childSnapshot.val()
                });
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
