export function calculateAsymmetryPercentage(rightGrip, leftGrip) {
    const r = parseFloat(rightGrip) || 0;
    const l = parseFloat(leftGrip) || 0;
    if (r === 0 && l === 0) return 0;
    return ((Math.abs(r - l) / Math.max(r, l)) * 100).toFixed(2);
}

export function getIdentificationStatus(asymmetryPercentage) {
    return asymmetryPercentage > 10 ? "Asimetris / Indikasi Cedera" : "Simetris / Normal";
}

export function getTreatmentRecommendation(rightGrip, leftGrip, asymmetryPercentage) {
    if (rightGrip === 0 && leftGrip === 0) return "Belum ada data genggaman.";
    if (asymmetryPercentage > 10) {
        return "Asimetri terdeteksi. Kurangi beban pada area dominan dan pertimbangkan fisioterapi ringan.";
    }
    return "Kekuatan seimbang. Pertahankan intensitas latihan Anda.";
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
