export function calculateAsymmetryPercentage(rightGrip, leftGrip) {
    const r = parseFloat(rightGrip) || 0;
    const l = parseFloat(leftGrip) || 0;
    if (r === 0 && l === 0) return 0;
    return ((Math.abs(r - l) / Math.max(r, l)) * 100).toFixed(2);
}

export function getIdentificationStatus(asymmetryPercentage) {
    if (asymmetryPercentage <= 10) return "Simetris / Normal";
    if (asymmetryPercentage <= 20) return "Asimetris Ringan";
    if (asymmetryPercentage <= 30) return "Asimetris Sedang";
    return "Asimetris Berat";
}

export function getTreatmentRecommendation(rightGrip, leftGrip, asymmetryPercentage) {
    if (rightGrip === 0 && leftGrip === 0) return "Belum ada data genggaman aktif.";
    
    if (asymmetryPercentage <= 10) {
        return "Kekuatan genggaman seimbang dan normal. Pertahankan kontinuitas aktivitas fisik Anda.";
    }
    
    const weakHand = rightGrip < leftGrip ? "kanan" : "kiri";
    
    if (asymmetryPercentage <= 30) {
        return `Asimetri ${asymmetryPercentage <= 20 ? 'ringan' : 'sedang'} terdeteksi. Lakukan latihan untuk penguatan pada bagian tangan ${weakHand} yang lemah.`;
    }
    
    return `Asimetri berat terdeteksi pada tangan ${weakHand}. Dianjurkan ke dokter atau klinik yang menangani bidang ini.`;
}

export function getNormalGripByAge(age) {
    const numAge = parseInt(age);
    if (!numAge || numAge < 10) return 15; 
    if (numAge >= 10 && numAge <= 15) return 25;
    if (numAge >= 16 && numAge <= 25) return 40; 
    if (numAge >= 26 && numAge <= 40) return 45;
    if (numAge >= 41 && numAge <= 60) return 35;
    return 25; 
}
