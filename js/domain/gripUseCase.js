/**
 * Pure business logic for the Hand Grip Monitoring System
 */

/**
 * Calculates the asymmetry percentage between right and left grip strengths.
 * @param {number} right - Right hand grip strength in kg
 * @param {number} left - Left hand grip strength in kg
 * @returns {number} Asymmetry percentage
 */
export function calculateAsymmetryPercentage(right, left) {
    // Avoid division by zero if both are 0
    if (right === 0 && left === 0) return 0;
    
    const asymmetry = (Math.abs(right - left) / Math.max(right, left)) * 100;
    return parseFloat(asymmetry.toFixed(2));
}

/**
 * Identifies the status based on the asymmetry percentage.
 * @param {number} asymmetryPercentage - The calculated asymmetry percentage
 * @returns {string} Status classification
 */
export function getIdentificationStatus(asymmetryPercentage) {
    if (asymmetryPercentage > 10) {
        return "Asimetris / Indikasi Cedera";
    }
    return "Simetris / Normal";
}

/**
 * Generates a dynamic treatment recommendation.
 * @param {number} right - Right hand grip strength
 * @param {number} left - Left hand grip strength
 * @param {number} asymmetryPercentage - The calculated asymmetry percentage
 * @returns {string} Treatment recommendation
 */
export function getTreatmentRecommendation(right, left, asymmetryPercentage) {
    if (right === 0 && left === 0) {
        return "Menunggu data genggaman untuk memberikan rekomendasi.";
    }
    
    if (asymmetryPercentage > 10) {
        const dominant = right > left ? "Kanan" : "Kiri";
        const weaker = right < left ? "Kanan" : "Kiri";
        return `Asimetri terdeteksi (${asymmetryPercentage}%). Kurangi beban pada area dominan (${dominant}) dan pertimbangkan fisioterapi untuk tangan ${weaker}.`;
    }
    
    return "Kekuatan normal dan simetris, pertahankan intensitas latihan Anda saat ini.";
}
