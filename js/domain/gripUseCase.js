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
        return "Kekuatan genggaman seimbang dan normal. Lanjutkan aktivitas harian dan olahraga ringan secara rutin.";
    }
    
    const weakHand = rightGrip < leftGrip ? "kanan" : "kiri";
    
    if (asymmetryPercentage <= 30) {
        return `Disarankan melakukan latihan penguatan untuk tangan ${weakHand} yang terdeteksi lebih lemah, seperti meremas stress ball, latihan hand grip, atau wrist curls 3-5 kali per minggu.`;
    }
    
    return `KONSULTASI AHLI: Asimetri berat terdeteksi pada tangan ${weakHand}. Sangat disarankan untuk segera berkonsultasi ke dokter, fisioterapis, atau ahli terkait untuk penanganan tepat. Hindari aktivitas berat pada tangan tersebut.`;
}

export function getConclusion(gender, age, job, asymmetryPercentage) {
    if (!gender || !age || !job) return "Mohon lengkapi data Umur, Jenis Kelamin, dan Pekerjaan untuk melihat kesimpulan.";

    const genderStr = gender === 'L' ? 'Laki-laki' : (gender === 'P' ? 'Perempuan' : '-');
    
    let tingkat = "";
    if (asymmetryPercentage <= 20) tingkat = "Rendah";
    else if (asymmetryPercentage <= 30) tingkat = "Sedang";
    else tingkat = "Tinggi";

    return `Berdasarkan jenis kelamin ${genderStr}, usia ${age} tahun, dan jenis pekerjaan yang termasuk dalam kategori ${job}, tingkat asimetri dari hasil tersebut tergolong ${tingkat}.`;
}

export function getNormalGrip(age, gender) {
    const numAge = parseInt(age);
    if (!numAge) return 0;
    
    if (gender === 'L') {
        if (numAge < 12) return 17.5; // 10-11
        if (numAge < 14) return 25.3; // 12-13
        if (numAge < 16) return 36.4; // 14-15
        if (numAge < 18) return 42.5; // 16-17
        if (numAge < 20) return 45.6; // 18-19
        if (numAge < 25) return 46.7; // 20-24
        if (numAge < 30) return 47.6; // 25-29
        if (numAge < 35) return 45.9; // 30-34
        if (numAge < 40) return 45.7; // 35-39
        if (numAge < 45) return 45.4; // 40-44
        if (numAge < 50) return 44.6; // 45-49
        if (numAge < 55) return 41.8; // 50-54
        if (numAge < 60) return 39.6; // 55-59
        if (numAge < 65) return 39.1; // 60-64
        if (numAge < 70) return 36.1; // 65-69
        return 28.2; // 70-99
    } else if (gender === 'P') {
        if (numAge < 12) return 16.7;
        if (numAge < 14) return 19.5;
        if (numAge < 16) return 21.4;
        if (numAge < 18) return 23.1;
        if (numAge < 20) return 25.1;
        if (numAge < 25) return 28.4;
        if (numAge < 30) return 33.5;
        if (numAge < 35) return 28.4;
        if (numAge < 40) return 27.2;
        if (numAge < 45) return 25.8;
        if (numAge < 50) return 25.5;
        if (numAge < 55) return 25.0;
        if (numAge < 60) return 24.6;
        if (numAge < 65) return 24.1;
        if (numAge < 70) return 21.3;
        return 19.6;
    }
    
    // Default fallback if gender not specified or unknown
    if (numAge < 16) return 25;
    if (numAge < 26) return 40; 
    if (numAge < 41) return 45;
    if (numAge < 61) return 35;
    return 25; 
}
