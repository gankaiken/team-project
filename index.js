import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dbPromise from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Gemini Client (Multi-Key/Model Rotation)
const geminiKeys = (process.env.GEMINI_API_KEYS || '').split(',').filter(Boolean);

const fallbackModels = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite"
];
let currentGeminiKeyIndex = 0;
const KEY_COOLDOWN_MS = 60 * 1000;
const keyHealth = geminiKeys.map(() => ({
    disabled: false,
    blockedUntil: 0,
    reason: ''
}));

const isKeyUsable = (index) => {
    const state = keyHealth[index];
    if (!state) return false;
    if (state.disabled) return false;
    if (state.blockedUntil && Date.now() < state.blockedUntil) return false;
    return true;
};

const markKeyDisabled = (index, reason) => {
    if (!keyHealth[index]) return;
    keyHealth[index].disabled = true;
    keyHealth[index].reason = reason || 'disabled';
};

const markKeyCooldown = (index, ms, reason) => {
    if (!keyHealth[index]) return;
    keyHealth[index].blockedUntil = Date.now() + ms;
    keyHealth[index].reason = reason || 'cooldown';
};

function getGeminiClientByIndex(index) {
    const key = geminiKeys[index % geminiKeys.length];
    if (!key) {
        throw new Error('No valid Gemini API key available.');
    }
    console.log(`[API Proxy] Attempt ${index + 1}: Using key ending ...${key.slice(-4)}`);
    return new GoogleGenAI({ apiKey: key });
}

function advanceKeyIndex() {
    currentGeminiKeyIndex = (currentGeminiKeyIndex + 1) % geminiKeys.length;
}

// Initialize Groq Client for Copilot Chat & Synthesis
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.use(cors());
// Increase limit for base64 image strings
app.use(express.json({ limit: '50mb' }));

const isValidLatitude = (v) => Number.isFinite(Number(v)) && Number(v) >= -90 && Number(v) <= 90;
const isValidLongitude = (v) => Number.isFinite(Number(v)) && Number(v) >= -180 && Number(v) <= 180;
const toFiniteNumber = (v, fallback = null) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
};
const toSafeString = (v, fallback = 'Not available') => {
    const s = typeof v === 'string' ? v.trim() : '';
    return s ? s : fallback;
};
const roundDistanceKm = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n * 10) / 10 : null;
};
const parseDistanceKm = (raw) => {
    if (raw == null) return null;
    if (Number.isFinite(Number(raw))) return roundDistanceKm(raw);
    const text = String(raw).toLowerCase();
    const match = text.match(/(\d+(\.\d+)?)\s*km/);
    if (match) return roundDistanceKm(match[1]);
    return null;
};
const degToRad = (deg) => (deg * Math.PI) / 180;
const haversineKm = (lat1, lon1, lat2, lon2) => {
    if (![lat1, lon1, lat2, lon2].every((v) => Number.isFinite(Number(v)))) return null;
    const R = 6371;
    const dLat = degToRad(lat2 - lat1);
    const dLon = degToRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(degToRad(lat1)) * Math.cos(degToRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return roundDistanceKm(R * c);
};
const isLikelyMapsUrl = (u) => {
    try {
        const parsed = new URL(String(u));
        return parsed.protocol.startsWith('http') && (parsed.hostname.includes('google.com') || parsed.hostname.includes('maps.'));
    } catch {
        return false;
    }
};
const buildGoogleMapsSearchUrl = ({ name = '', address = '', lat = null, lng = null }) => {
    if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
    }
    const q = `${name} ${address}`.trim();
    if (!q) return null;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
};
const normalizeClinicEntry = (raw, idx, userLat, userLng, sourceFallback = 'llm_generated') => {
    const lat = toFiniteNumber(raw?.latitude ?? raw?.lat, null);
    const lng = toFiniteNumber(raw?.longitude ?? raw?.lng ?? raw?.lon, null);
    const parsedDistance = parseDistanceKm(raw?.distance_km ?? raw?.distance);
    const computedDistance = (lat != null && lng != null) ? haversineKm(userLat, userLng, lat, lng) : null;
    const distance_km = parsedDistance != null ? parsedDistance : computedDistance;
    const name = toSafeString(raw?.name, '');
    const address = toSafeString(raw?.address, '');
    if (!name) return null;

    const maps_url_candidate = raw?.maps_url ?? raw?.mapsUrl ?? raw?.map_url ?? null;
    const maps_url = isLikelyMapsUrl(maps_url_candidate)
        ? String(maps_url_candidate)
        : buildGoogleMapsSearchUrl({ name, address, lat, lng });

    return {
        id: toSafeString(raw?.id, `clinic-${idx + 1}`),
        name,
        address: address || 'Not available',
        distance_km: distance_km ?? null,
        maps_url: maps_url || null,
        latitude: lat ?? null,
        longitude: lng ?? null,
        phone: toSafeString(raw?.phone, 'Not available'),
        hours: toSafeString(raw?.hours, 'Not available'),
        specialty: toSafeString(raw?.specialty, 'Dermatology'),
        source: toSafeString(raw?.source, sourceFallback),
        confidence: Number.isFinite(Number(raw?.confidence)) ? Math.max(0, Math.min(1, Number(raw.confidence))) : null
    };
};
const validateClinicSchema = (entry) => {
    if (!entry || typeof entry !== 'object') return false;
    if (!entry.id || !entry.name) return false;
    if (entry.distance_km != null && !Number.isFinite(Number(entry.distance_km))) return false;
    return true;
};
const formatClinicResponse = (status, clinics, message) => ({
    status,
    clinics,
    message
});
const fallbackClinicCatalog = [
    { name: 'Hospital Kuala Lumpur - Dermatology Clinic', address: 'Jalan Pahang, Kuala Lumpur', latitude: 3.1719, longitude: 101.7022, specialty: 'Dermatology', phone: 'Not available', hours: 'Not available', source: 'curated_fallback', confidence: 0.7 },
    { name: 'Hospital Sultanah Aminah - Dermatology', address: 'Jalan Persiaran Abu Bakar Sultan, Johor Bahru', latitude: 1.4556, longitude: 103.7578, specialty: 'Dermatology', phone: 'Not available', hours: 'Not available', source: 'curated_fallback', confidence: 0.7 },
    { name: 'Hospital Pulau Pinang - Dermatology Clinic', address: 'Jalan Residensi, George Town, Penang', latitude: 5.4176, longitude: 100.3103, specialty: 'Dermatology', phone: 'Not available', hours: 'Not available', source: 'curated_fallback', confidence: 0.7 },
    { name: 'Hospital Queen Elizabeth - Dermatology', address: 'Jalan Penampang, Kota Kinabalu, Sabah', latitude: 5.9442, longitude: 116.0873, specialty: 'Dermatology', phone: 'Not available', hours: 'Not available', source: 'curated_fallback', confidence: 0.68 },
    { name: 'Sarawak General Hospital - Dermatology', address: 'Jalan Hospital, Kuching, Sarawak', latitude: 1.5535, longitude: 110.3445, specialty: 'Dermatology', phone: 'Not available', hours: 'Not available', source: 'curated_fallback', confidence: 0.68 }
];
const getFallbackClinics = (userLat, userLng, maxCount = 5) => {
    const normalized = fallbackClinicCatalog
        .map((item, idx) => normalizeClinicEntry(item, idx, userLat, userLng, 'curated_fallback'))
        .filter(validateClinicSchema)
        .sort((a, b) => {
            const da = a.distance_km == null ? Number.POSITIVE_INFINITY : a.distance_km;
            const db = b.distance_km == null ? Number.POSITIVE_INFINITY : b.distance_km;
            return da - db;
        });
    return normalized.slice(0, maxCount);
};

const clampRisk = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
const confidenceLabelFromScore = (score) => {
    if (score >= 0.8) return 'High';
    if (score >= 0.6) return 'Medium';
    return 'Low';
};
const buildSupportBreakdown = ({ answersCount = 0, confidenceScore = 0.7 }) => {
    const answerFactor = Math.max(0, Math.min(1, answersCount / 9));
    const image = Math.round((0.45 + Math.max(0, (confidenceScore - 0.5) * 0.2)) * 100);
    const symptoms = Math.round((0.15 + answerFactor * 0.3) * 100);
    let context = 100 - image - symptoms;
    if (context < 5) context = 5;
    const total = image + symptoms + context;
    return {
        image: Math.round((image / total) * 100),
        symptoms: Math.round((symptoms / total) * 100),
        context: Math.round((context / total) * 100)
    };
};
const calculateEvidenceStrength = ({
    confidenceScore = 0.7,
    confidenceLabel = 'Medium',
    answersCount = 0,
    healthyHighConf = false,
    symptomConcernHigh = false,
    redFlagTriggered = false
}) => {
    const completeness = Math.max(0, Math.min(1, answersCount / 9));
    const contradiction = healthyHighConf && symptomConcernHigh;
    let score = 0;
    score += confidenceScore * 45;
    score += completeness * 25;
    score += healthyHighConf && !symptomConcernHigh ? 15 : 0;
    score += !healthyHighConf && symptomConcernHigh ? 10 : 0;
    score += redFlagTriggered ? 5 : 0;
    if (contradiction) score -= 20;
    if (confidenceLabel === 'Low') score -= 15;
    score = clampRisk(score);

    let evidence_strength = 'limited';
    let evidence_strength_label = 'Limited';
    if (score >= 75) {
        evidence_strength = 'strong';
        evidence_strength_label = 'Strong';
    } else if (score >= 55) {
        evidence_strength = 'moderate';
        evidence_strength_label = 'Moderate';
    } else if (score >= 35) {
        evidence_strength = 'early';
        evidence_strength_label = 'Early';
    }

    const evidence_drivers = [];
    if (confidenceLabel === 'High') evidence_drivers.push('High image confidence');
    if (completeness >= 0.7) evidence_drivers.push('Structured symptom inputs were complete');
    else if (completeness > 0) evidence_drivers.push('Partial symptom inputs available');
    else evidence_drivers.push('Image-dominant assessment (limited symptom input)');
    if (redFlagTriggered) evidence_drivers.push('Red-flag responses increased caution');
    if (contradiction) evidence_drivers.push('Image and symptom signals showed partial contradiction');

    let evidence_summary = 'The assessment should be interpreted cautiously due to weaker or incomplete signals.';
    if (evidence_strength === 'strong') evidence_summary = 'Multiple signals support this assessment.';
    if (evidence_strength === 'moderate') evidence_summary = 'The assessment is reasonably supported, with some uncertainty.';
    if (evidence_strength === 'early') evidence_summary = 'A possible pattern is emerging, but evidence is still early.';

    return {
        evidence_strength,
        evidence_strength_label,
        evidence_summary,
        evidence_drivers,
        contradictions_detected: contradiction,
        support_breakdown: buildSupportBreakdown({ answersCount, confidenceScore })
    };
};

const inferConditionLabel = (analysis = {}) => {
    const conditionRaw = `${analysis?.detectedConditionLabel || ''} ${analysis?.conditions?.[0]?.category || ''} ${analysis?.conditions?.[0]?.description || ''} ${analysis?.primaryInsight || ''}`.toLowerCase();
    if (conditionRaw.includes('acne') || conditionRaw.includes('pimple') || conditionRaw.includes('comedone') || conditionRaw.includes('blackhead')) return 'Likely Acne';
    if (conditionRaw.includes('eczema') || conditionRaw.includes('dermatitis') || conditionRaw.includes('irritation')) return 'Likely Eczema / Irritation';
    if (conditionRaw.includes('fungal') || conditionRaw.includes('ringworm') || conditionRaw.includes('tinea')) return 'Likely Fungal Infection';
    if (conditionRaw.includes('pigment') || conditionRaw.includes('melasma') || conditionRaw.includes('hyperpig')) return 'Likely Pigmentation Concern';
    if (conditionRaw.includes('rosacea') || conditionRaw.includes('redness')) return 'Likely Rosacea / Redness Pattern';
    if (conditionRaw.includes('psoriasis')) return 'Likely Psoriasis Pattern';
    if (conditionRaw.includes('normal') || conditionRaw.includes('healthy') || conditionRaw.includes('clear') || conditionRaw.includes('no visible')) return 'No significant skin disease detected';
    return analysis?.conditions?.[0]?.category || 'No significant skin disease detected';
};

const triageEngine = ({ analysis = {}, answers = [], redFlags = {} }) => {
    const byId = Object.fromEntries((answers || []).map((a) => [a.question_id, a]));
    const get = (id, fallback = 'not_sure') => byId[id]?.answer_value || fallback;

    const predicted_condition = inferConditionLabel(analysis);
    const confidence_score = Number(analysis?.conditions?.[0]?.confidence ?? 0.72);
    const confidence_label = confidenceLabelFromScore(confidence_score);
    const imageRisk = clampRisk(analysis?.suggestedRiskScore ?? analysis?.synthesis?.finalScore ?? 20);

    const durationScoreMap = { lt_24h: 10, '1_3d': 25, '4_7d': 50, gt_1w: 80, not_sure: 35 };
    const symptomScoreMap = { none: 10, slight_itch: 35, very_itchy: 65, painful: 70, both: 85, not_sure: 40 };
    const spreadScoreMap = { no_change: 10, slight_spread: 55, major_spread: 90, not_sure: 40 };
    const triggerScoreMap = { yes: 50, no: 15, not_sure: 30 };
    const historyScoreMap = { many_times: 70, once: 45, no: 20, not_sure: 35 };
    const conditionSpecificMap = { rare: 20, weekly: 45, frequent: 75, low: 20, moderate: 45, high: 70, yes: 55, no: 20, sometimes: 45, often: 75, not_sure: 35 };

    const symptomSeverity = symptomScoreMap[get('symptom_severity')] ?? 40;
    const duration = durationScoreMap[get('duration')] ?? 35;
    const spread = spreadScoreMap[get('spread_change')] ?? 40;
    const recurrenceTrigger = ((historyScoreMap[get('history')] ?? 35) * 0.6) + ((triggerScoreMap[get('new_triggers')] ?? 30) * 0.4);
    const conditionSpecific = conditionSpecificMap[get('condition_specific')] ?? 35;

    const computedRedFlags = {
        bleeding: get('redflag_bleeding', redFlags?.bleeding ? 'yes' : 'no') === 'yes',
        swelling_or_pus: get('redflag_swelling_pus', redFlags?.swelling_or_pus ? 'yes' : 'no') === 'yes',
        rapid_worsening_or_fever: get('redflag_rapid_worse_fever', redFlags?.rapid_worsening_or_fever ? 'yes' : 'no') === 'yes',
        severe_pain: get('symptom_severity') === 'painful' || get('symptom_severity') === 'both'
    };
    const red_flag_triggered = Object.values(computedRedFlags).some(Boolean);

    const refined_risk_score = clampRisk(
        (imageRisk * 0.5) +
        (((symptomSeverity * 0.7) + (conditionSpecific * 0.3)) * 0.2) +
        (duration * 0.15) +
        (spread * 0.1) +
        (recurrenceTrigger * 0.05)
    );

    let urgency_level = 'Low';
    const symptomConcernHigh = symptomSeverity >= 60 || spread >= 55 || duration >= 50;
    if (red_flag_triggered || refined_risk_score >= 70 || (confidence_label === 'Low' && symptomConcernHigh)) urgency_level = 'High';
    else if (refined_risk_score >= 40 || symptomConcernHigh) urgency_level = 'Moderate';

    const healthyHighConf = predicted_condition === 'No significant skin disease detected' && confidence_label === 'High';
    let triage_pathway = 'monitor';
    if (healthyHighConf && !symptomConcernHigh && !red_flag_triggered) triage_pathway = 'reassure';
    else if (red_flag_triggered || urgency_level === 'High') triage_pathway = 'seek_care';
    else if (refined_risk_score >= 45 || symptomSeverity >= 45 || conditionSpecific >= 45) triage_pathway = 'self_care';
    else triage_pathway = 'monitor';

    const recommendationByPathway = {
        reassure: {
            title: 'Reassure',
            text: 'No significant concern was detected. Continue routine skin care and monitor for unusual changes.',
            next: ['Maintain daily SPF and gentle cleansing.', 'Re-scan if a new visible change appears.']
        },
        monitor: {
            title: 'Monitor',
            text: 'This appears low concern at the moment. Recheck if symptoms spread, worsen, or persist.',
            next: ['Track changes for 3-7 days.', 'Repeat scan if no improvement.']
        },
        self_care: {
            title: 'Self-Care',
            text: 'This may be manageable with educational skin-care precautions. Avoid irritants and monitor response closely.',
            next: ['Avoid harsh exfoliants/new irritants.', 'Escalate if pain/spread increases.']
        },
        seek_care: {
            title: 'Seek Care',
            text: 'Your result suggests a higher level of concern. Professional medical review is recommended, especially if symptoms worsen or spread.',
            next: ['Arrange clinic/dermatology review soon.', 'Use in-app clinic finder for nearby options.']
        }
    };

    const reasoning_points = [];
    if (duration >= 50) reasoning_points.push('Longer symptom duration increased concern.');
    else reasoning_points.push('Short duration reduced urgency weighting.');
    if (symptomSeverity >= 60) reasoning_points.push('Symptom intensity increased severity weighting.');
    else reasoning_points.push('Milder symptoms reduced severity weighting.');
    if (spread >= 55) reasoning_points.push('Reported spread/change increased follow-up priority.');
    if (confidence_label === 'Low') reasoning_points.push('Low AI confidence required a more cautious triage path.');
    if (red_flag_triggered) reasoning_points.push('Red-flag symptoms triggered safer escalation.');

    const evidence = calculateEvidenceStrength({
        confidenceScore: confidence_score,
        confidenceLabel: confidence_label,
        answersCount: (answers || []).length,
        healthyHighConf,
        symptomConcernHigh,
        redFlagTriggered: red_flag_triggered
    });

    return {
        predicted_condition,
        confidence_score,
        confidence_label,
        refined_risk_score,
        urgency_level,
        triage_pathway,
        recommendation_title: recommendationByPathway[triage_pathway].title,
        recommendation_text: recommendationByPathway[triage_pathway].text,
        reasoning_points,
        red_flag_triggered,
        red_flag_details: computedRedFlags,
        suggested_next_actions: recommendationByPathway[triage_pathway].next,
        contributionBreakdown: {
            imageAnalysis: 50,
            symptomInputs: 30,
            contextualFactors: 20
        },
        ...evidence
    };
};

// ==========================================
// Analyze Resilience Layer (Live -> Cache -> Fallback)
// ==========================================
const ANALYSIS_CACHE_TTL_MS = Number(process.env.ANALYSIS_CACHE_TTL_MS || 10 * 60 * 1000);
const DEMO_MODE = String(process.env.DEMO_MODE || '').toLowerCase() === 'true';
const DEMO_FORCE_FALLBACK = String(process.env.DEMO_FORCE_FALLBACK || '').toLowerCase() === 'true';
const DEMO_SCENARIO = String(process.env.DEMO_SCENARIO || '').trim().toLowerCase();
const analysisCache = new Map();

const hashString = (text = '') => {
    let h = 0;
    for (let i = 0; i < text.length; i++) h = ((h << 5) - h) + text.charCodeAt(i);
    return Math.abs(h >>> 0);
};

const getAnalyzeCacheKey = ({ imageBase64 = '', icData = {} }) => {
    const ic = String(icData?.ic || '').trim();
    if (ic) return `ic:${ic}`;
    const demoProfile = `${icData?.age || 'na'}-${icData?.gender || 'na'}`;
    const imageFingerprint = `${String(imageBase64).slice(0, 48)}|${String(imageBase64).length}`;
    return `anon:${demoProfile}:${hashString(imageFingerprint) % 9973}`;
};

const pruneAnalysisCache = () => {
    const now = Date.now();
    for (const [key, item] of analysisCache.entries()) {
        if (!item?.timestamp || (now - item.timestamp) > ANALYSIS_CACHE_TTL_MS) analysisCache.delete(key);
    }
};

const getCachedAnalysis = (cacheKey) => {
    pruneAnalysisCache();
    const found = analysisCache.get(cacheKey);
    if (!found) return null;
    if ((Date.now() - found.timestamp) > ANALYSIS_CACHE_TTL_MS) {
        analysisCache.delete(cacheKey);
        return null;
    }
    return found.payload || null;
};

const setCachedAnalysis = (cacheKey, normalizedPayload) => {
    if (!cacheKey || !normalizedPayload) return;
    pruneAnalysisCache();
    analysisCache.set(cacheKey, {
        timestamp: Date.now(),
        payload: normalizedPayload
    });
};

const normalizeConditionCategory = (category, description) => {
    const merged = `${String(category || '').toLowerCase()} ${String(description || '').toLowerCase()}`;
    if (merged.includes('normal') || merged.includes('healthy') || merged.includes('clear') || merged.includes('no visible')) return 'Normal Tissue';
    if (merged.includes('acne') || merged.includes('pimple') || merged.includes('comedone') || merged.includes('blackhead') || merged.includes('whitehead')) return 'Acne';
    if (merged.includes('eczema') || merged.includes('dermatitis') || merged.includes('irritation') || merged.includes('rash') || merged.includes('dry')) return 'Eczema/Irritation';
    if (merged.includes('fungal') || merged.includes('ringworm') || merged.includes('tinea') || merged.includes('yeast')) return 'Fungal Infection';
    if (merged.includes('pigment') || merged.includes('melasma') || merged.includes('hyperpig') || merged.includes('dark spot')) return 'Pigmentation Concern';
    if (merged.includes('rosacea') || merged.includes('persistent redness') || merged.includes('flushing')) return 'Rosacea/Redness Pattern';
    if (merged.includes('psoriasis') || merged.includes('plaque')) return 'Psoriasis Pattern';
    if (merged.includes('uncertain') || merged.includes('inconclusive')) return 'Other/Uncertain';
    return String(category || 'Other/Uncertain');
};

const normalizeAnalyzeResult = (raw = {}, { analysisMode = 'live', demoSafe = false } = {}) => {
    const parsed = (raw && typeof raw === 'object') ? { ...raw } : {};
    const incomingConditions = Array.isArray(parsed.conditions) ? parsed.conditions : [];
    const conditions = incomingConditions.map((condition) => {
        const normalizedCategory = normalizeConditionCategory(condition?.category, condition?.description);
        const confidence = Number(condition?.confidence);
        const bounded = Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.72;
        let bbox = condition?.boundingBox;
        if (!Array.isArray(bbox) || bbox.length !== 4) bbox = [0.4, 0.4, 0.6, 0.6];
        bbox = bbox.map((v) => {
            const n = Number(v);
            if (!Number.isFinite(n)) return 0.5;
            return Math.max(0, Math.min(1, n));
        });
        return {
            category: normalizedCategory,
            confidence: Number(bounded.toFixed(2)),
            description: String(condition?.description || 'No significant abnormality highlighted.'),
            boundingBox: bbox
        };
    });

    const safeConditions = conditions.length ? conditions : [{
        category: 'Normal Tissue',
        confidence: 0.95,
        description: 'No distinct dermatological concerns identified in the visible skin region.',
        boundingBox: [0.4, 0.4, 0.6, 0.6]
    }];
    const primaryCategory = safeConditions[0]?.category || 'Normal Tissue';
    const isHealthy = primaryCategory === 'Normal Tissue';
    const suggestedRiskScore = clampRisk(parsed?.suggestedRiskScore ?? (isHealthy ? 12 : 38));

    return {
        person_detected: parsed?.person_detected !== false,
        good_angle: parsed?.good_angle !== false,
        conditions: safeConditions,
        signals: Array.isArray(parsed?.signals) ? parsed.signals.map((s) => String(s)).slice(0, 8) : (isHealthy ? ['clear texture', 'uniform tone'] : ['localized pattern']),
        primaryInsight: String(parsed?.primaryInsight || (isHealthy ? 'Scanning the face reveals no significant skin disease pattern.' : 'Scanning the face reveals a mild dermatology concern pattern.')),
        explanation: String(parsed?.explanation || (isHealthy ? 'The visible skin appears generally healthy with no distinct concerning lesions.' : 'Visible skin signals suggest a mild dermatological concern requiring monitoring.')),
        suggestedRiskScore,
        bodyPart: String(parsed?.bodyPart || 'head'),
        analysis_mode: analysisMode,
        demo_safe: Boolean(demoSafe)
    };
};

const buildFallbackScenario = (scenario = 'auto', icData = {}) => {
    const normalized = String(scenario || 'auto').toLowerCase();
    const age = Number(icData?.age);
    const resolvedScenario = normalized === 'auto'
        ? (Number.isFinite(age) && age <= 25 ? 'acne' : (Number.isFinite(age) && age >= 45 ? 'eczema' : 'healthy'))
        : normalized;

    if (resolvedScenario === 'eczema') {
        return {
            person_detected: true,
            good_angle: true,
            conditions: [{
                category: 'Eczema/Irritation',
                confidence: 0.74,
                description: 'Moderate irritation-like dryness and redness pattern.',
                boundingBox: [0.33, 0.28, 0.74, 0.72]
            }],
            signals: ['dry texture', 'localized redness'],
            primaryInsight: 'Scanning the face reveals a possible eczema-like irritation pattern.',
            explanation: 'Visible redness and texture dryness suggest moderate irritation requiring monitoring and follow-up.',
            suggestedRiskScore: 58,
            bodyPart: 'head'
        };
    }
    if (resolvedScenario === 'acne') {
        return {
            person_detected: true,
            good_angle: true,
            conditions: [{
                category: 'Acne',
                confidence: 0.82,
                description: 'Mild acne-like papules in the T-zone.',
                boundingBox: [0.36, 0.36, 0.68, 0.66]
            }],
            signals: ['papules', 'mild redness'],
            primaryInsight: 'Scanning the face reveals a mild acne-like concern.',
            explanation: 'Localized inflammatory markers are consistent with a mild acne-related pattern.',
            suggestedRiskScore: 41,
            bodyPart: 'head'
        };
    }
    return {
        person_detected: true,
        good_angle: true,
        conditions: [{
            category: 'Normal Tissue',
            confidence: 0.96,
            description: 'No visible dermatological concern identified.',
            boundingBox: [0.4, 0.4, 0.6, 0.6]
        }],
        signals: ['clear texture', 'uniform tone'],
        primaryInsight: 'Scanning the face reveals no significant skin disease detected.',
        explanation: 'The visible skin appears generally healthy with no distinct concerning lesions.',
        suggestedRiskScore: 12,
        bodyPart: 'head'
    };
};

const isRecoverableVisionError = (err) => {
    const status = Number(err?.status || 0);
    const text = String(err?.message || '').toLowerCase();
    if ([429, 503, 502, 504, 500, 404].includes(status)) return true;
    if (status === 403 && (text.includes('reported as leaked') || text.includes('permission_denied') || text.includes('forbidden'))) return true;
    if (status === 401) return true;
    if (text.includes('temporarily unavailable') || text.includes('cooldown') || text.includes('rate') || text.includes('timeout')) return true;
    return false;
};

// ==========================================
// GROQ AI ENDPOINTS
// ==========================================

// 1. Image Analysis (/api/analyze)
app.post('/api/analyze', async (req, res) => {
    const { imageBase64, icData } = req.body || {};
    if (!imageBase64) return res.status(400).json({ error: 'No image provided' });

    const cacheKey = getAnalyzeCacheKey({ imageBase64, icData });
    const forcedScenario = ['healthy', 'acne', 'eczema'].includes(DEMO_SCENARIO) ? DEMO_SCENARIO : 'auto';

    if (DEMO_MODE && DEMO_FORCE_FALLBACK) {
        const fallbackForced = normalizeAnalyzeResult(
            buildFallbackScenario(forcedScenario, icData),
            { analysisMode: 'fallback', demoSafe: true }
        );
        setCachedAnalysis(cacheKey, fallbackForced);
        return res.json(fallbackForced);
    }

    try {
        if (!geminiKeys.length) {
            throw Object.assign(new Error('Vision AI temporarily unavailable: missing GEMINI_API_KEYS'), { status: 503 });
        }

        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        const mimeType = imageBase64.match(/^data:(image\/\w+);base64,/)?.[1] || "image/jpeg";
        const demoContext = icData ? `The patient is a ${icData.age} year old ${icData.gender}. Keep this demographic context in mind for baseline dermatological risks (like hormonal distributions, age spots, melanoma curves).` : '';

        const prompt = `
            ${demoContext}
            As a dermatology screening assistant, analyze this skin image. 
            Identify potential conditions, detected signals (like redness, scaling), and provide a preliminary risk assessment.
            In addition, map the exact body part shown in the image to ONE of the following precise string values: 'head', 'neck', 'shoulderL', 'shoulderR', 'chest', 'abdomen', 'pelvis', 'upperArmL', 'upperArmR', 'forearmL', 'forearmR', 'handL', 'handR', 'thighL', 'thighR', 'shinL', 'shinR', 'footL', 'footR'.
            If it's the face, you MUST use 'head'.
            
            CRITICAL VALIDATION INSTRUCTIONS:
            1. Verify if a person/skin is clearly visible in the image. Set "person_detected" to true or false.
            2. If evaluating the face, determine if it is reasonably well-centered and not completely obscured/cut off. Set "good_angle" to true or false. If not a face, evaluate the general clarity of the body part.
            
            SPATIAL TRACKING:
            For each condition detected, provide a "boundingBox" array: [ymin, xmin, ymax, xmax] mapping to the physical location in the image. Values must be normalized floats between 0.0 and 1.0, where [0,0] is top-left and [1,1] is bottom-right.
            
            IMPORTANT MEDICAL ACCURACY:
            This is NOT a medical diagnosis. DO NOT hallucinate conditions.
            - Use balanced classification. Do NOT default to acne unless visual evidence supports acne patterns.
            - Choose condition category from this controlled list only:
              ["Acne","Eczema/Irritation","Fungal Infection","Pigmentation Concern","Rosacea/Redness Pattern","Psoriasis Pattern","Normal Tissue","Other/Uncertain"]
            - If evidence is weak or unclear, use "Other/Uncertain" with lower confidence instead of forcing "Acne".
            - For healthy or near-normal skin, use "Normal Tissue" and low risk (5-20).
            - Use moderate/high risk only when strong visible concern exists.
            - CRITICAL: In the "primaryInsight" field, explicitly state the scanned body part and main finding.
            - CRITICAL UI RULE: NEVER return an empty "conditions" array. If no distinct abnormality is visible, return "Normal Tissue" with a centered bounding box (e.g. [0.4, 0.4, 0.6, 0.6]) and low risk.
            
            Return ONLY a valid JSON object in exactly this format, nothing else. If person_detected is false, you may omit bounding boxes but keep the JSON structure intact:
            {
              "person_detected": true,
              "good_angle": true,
              "conditions": [
                { "category": "Eczema/Irritation", "confidence": 0.78, "description": "Mild localized irritation pattern", "boundingBox": [0.45, 0.45, 0.55, 0.55] }
              ],
              "signals": ["localized redness", "mild texture change"],
              "primaryInsight": "Scanning the face reveals a mild irritation-like pattern.",
              "explanation": "Visible localized redness and slight texture variation suggest irritation.",
              "suggestedRiskScore": 28,
              "bodyPart": "head"
            }
        `;

        let response = null;
        let lastErr = null;
        const startIndex = currentGeminiKeyIndex;
        const usableKeyIndexes = [];
        for (let i = 0; i < geminiKeys.length; i++) {
            const idx = (startIndex + i) % geminiKeys.length;
            if (isKeyUsable(idx)) usableKeyIndexes.push(idx);
        }
        if (!usableKeyIndexes.length) {
            throw Object.assign(new Error('Vision AI temporarily unavailable: all keys are blocked, leaked, or cooling down.'), { status: 503 });
        }

        retryLoop:
        for (let attempt = 0; attempt < usableKeyIndexes.length; attempt++) {
            const keyIndex = usableKeyIndexes[attempt];
            const ai = getGeminiClientByIndex(keyIndex);

            for (const modelName of fallbackModels) {
                try {
                    console.log(`[API Proxy] Attempt ${attempt + 1}/${usableKeyIndexes.length}: Trying model ${modelName} with key ending ...${geminiKeys[keyIndex].slice(-4)}`);
                    response = await ai.models.generateContent({
                        model: modelName,
                        contents: [
                            {
                                role: "user",
                                parts: [
                                    { text: prompt },
                                    { inlineData: { mimeType: mimeType, data: base64Data } }
                                ]
                            }
                        ],
                        config: { temperature: 0.1, responseMimeType: "application/json" }
                    });
                    currentGeminiKeyIndex = (keyIndex + 1) % geminiKeys.length;
                    break retryLoop;
                } catch (err) {
                    lastErr = err;
                    if (err?.status === 429) {
                        console.warn(`[API Proxy] Rate limit (429) on model ${modelName} with key ending ...${geminiKeys[keyIndex].slice(-4)}. Trying next key...`);
                        markKeyCooldown(keyIndex, KEY_COOLDOWN_MS, 'rate_limited');
                        continue retryLoop;
                    } else if (err?.status === 403 && String(err?.message || '').toLowerCase().includes('reported as leaked')) {
                        console.warn(`[API Proxy] Key ending ...${geminiKeys[keyIndex].slice(-4)} is leaked/blocked (403). Removing from rotation.`);
                        markKeyDisabled(keyIndex, 'leaked');
                        continue retryLoop;
                    } else if (err?.status === 401 || err?.status === 403) {
                        console.warn(`[API Proxy] Auth error (${err.status}) with key ending ...${geminiKeys[keyIndex].slice(-4)}. Removing from rotation.`);
                        markKeyDisabled(keyIndex, 'auth_error');
                        continue retryLoop;
                    } else if (err?.status === 404 || err?.status === 503 || err?.status === 400 || err?.status === 500) {
                        console.warn(`[API Proxy] Model ${modelName} unavailable (${err.status}), trying next model...`);
                        continue;
                    } else {
                        console.warn(`[API Proxy] Unexpected error on model ${modelName} (status ${err?.status}):`, err.message);
                        continue retryLoop;
                    }
                }
            }
        }

        if (!response) throw lastErr || Object.assign(new Error('Vision AI unavailable'), { status: 503 });

        const rawJson = typeof response.text === 'function' ? response.text() : response.text;
        const parsed = JSON.parse(rawJson);
        const normalized = normalizeAnalyzeResult(parsed, { analysisMode: 'live', demoSafe: false });
        setCachedAnalysis(cacheKey, normalized);
        console.log("VISION AI PARSED JSON:", JSON.stringify(normalized, null, 2));
        return res.json(normalized);
    } catch (err) {
        console.error("Analysis Error:", err);
        if (isRecoverableVisionError(err)) {
            const cached = getCachedAnalysis(cacheKey);
            if (cached) {
                return res.status(200).json({
                    ...cached,
                    analysis_mode: 'cached',
                    demo_safe: true
                });
            }

            const autoScenario = ['healthy', 'acne', 'eczema'].includes(forcedScenario) ? forcedScenario : 'auto';
            const fallback = normalizeAnalyzeResult(
                buildFallbackScenario(autoScenario, icData),
                { analysisMode: 'fallback', demoSafe: true }
            );
            setCachedAnalysis(cacheKey, fallback);
            return res.status(200).json(fallback);
        }

        return res.status(500).json({
            error: 'Vision AI analysis could not be completed.',
            details: 'Unexpected non-recoverable analysis error.'
        });
    }
});
app.post('/api/chat', async (req, res) => {
    try {
        const { messages, context, language } = req.body || {};
        if (!Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({
                status: 'error',
                reply: 'Please send a message so I can help explain your latest result.',
                language: 'English',
                source_context_used: false,
                error_message: 'No messages provided'
            });
        }

        const safeContext = context && typeof context === 'object' ? context : {};
        const requestedLanguageRaw = String(language || safeContext.languagePreference || 'English').toLowerCase();
        const languageLabel =
            requestedLanguageRaw.includes('malay') || requestedLanguageRaw.includes('melayu') ? 'Melayu'
                : requestedLanguageRaw.includes('chinese') || requestedLanguageRaw.includes('mandarin') ? 'Chinese'
                    : 'English';
        const source_context_used = Object.keys(safeContext).length > 0;
        const contextSummary = {
            detected_condition: safeContext.detectedConditionLabel || safeContext.condition || 'Not available',
            confidence_label: safeContext.confidenceLabel || 'Not available',
            urgency_level: safeContext.urgencyLevel || 'Not available',
            triage_pathway: safeContext.triagePathway || 'Not available',
            recommendation_text: safeContext.recommendationText || 'Not available',
            reasoning_points: Array.isArray(safeContext.reasoningPoints) ? safeContext.reasoningPoints : []
        };

        const languageRule =
            languageLabel === 'Melayu'
                ? 'Respond only in Bahasa Melayu, naturally and clearly.'
                : languageLabel === 'Chinese'
                    ? 'Respond only in Simplified Chinese, naturally and clearly.'
                    : 'Respond only in English, naturally and clearly.';

        const systemInstruction = `
            You are DermaAI Copilot, an educational dermatology screening support assistant for facial skin concerns.
            ${languageRule}

            Core behavior:
            1. Stay grounded in the provided latest result context.
            2. Explain triage and next steps clearly in non-alarmist language.
            3. Keep responses concise, practical, and medically responsible.
            4. Never claim definitive diagnosis, never prescribe medication, never provide unsafe certainty.
            5. Encourage professional review when urgency is moderate/high, symptoms worsen, or user is worried.
            6. If context is missing, acknowledge limitation and ask the user to return to Results.
            7. End with one focused follow-up question when helpful.

            Latest result context:
            ${JSON.stringify(contextSummary)}

            Safety note to reflect when relevant:
            "This is educational support and does not replace professional medical diagnosis."
        `;

        const formattedMessages = [
            { role: "system", content: systemInstruction },
            ...messages
                .filter((m) => m && typeof m.text === 'string' && m.text.trim().length > 0)
                .map((m) => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }))
        ];

        const response = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: formattedMessages,
            temperature: 0.35,
            max_tokens: 512,
        });

        const reply = response?.choices?.[0]?.message?.content?.trim();
        if (!reply) {
            const fallbackReply =
                languageLabel === 'Melayu'
                    ? 'Saya boleh bantu terangkan keputusan dan langkah seterusnya, tetapi jawapan penuh tidak tersedia sekarang. Sila semak panel cadangan atau dapatkan nasihat profesional jika gejala bertambah teruk.'
                    : languageLabel === 'Chinese'
                        ? '我可以帮助解释你的结果和下一步建议，但目前无法完整回答。请先查看建议面板；如果症状加重，请尽快咨询专业医生。'
                        : 'I can help explain your result and next steps, but I cannot answer fully right now. Please review the recommendation panel, and seek professional care if symptoms worsen.';
            return res.json({
                status: 'fallback',
                reply: fallbackReply,
                language: languageLabel,
                source_context_used,
                error_message: 'Empty model reply'
            });
        }

        return res.json({
            status: 'success',
            reply,
            language: languageLabel,
            source_context_used,
            error_message: null
        });
    } catch (err) {
        console.error("Chat Error:", err);
        const reqLanguage = String(req.body?.language || req.body?.context?.languagePreference || 'English').toLowerCase();
        const languageLabel =
            reqLanguage.includes('malay') || reqLanguage.includes('melayu') ? 'Melayu'
                : reqLanguage.includes('chinese') || reqLanguage.includes('mandarin') ? 'Chinese'
                    : 'English';
        const fallbackReply =
            languageLabel === 'Melayu'
                ? 'Saya boleh bantu terangkan keputusan anda, tetapi sambungan Copilot sedang terganggu. Cuba lagi sebentar lagi.'
                : languageLabel === 'Chinese'
                    ? '我可以帮助解释你的结果，但 Copilot 连接暂时不稳定。请稍后再试。'
                    : 'I can help explain your result, but Copilot is temporarily unstable. Please try again shortly.';
        res.status(200).json({
            status: 'fallback',
            reply: fallbackReply,
            language: languageLabel,
            source_context_used: !!req.body?.context,
            error_message: 'Failed to generate chat response'
        });
    }
});

// 2. Structured Triage Engine (/api/triage)
app.post('/api/triage', async (req, res) => {
    try {
        const { analysis, answers, redFlags } = req.body || {};
        if (!analysis) return res.status(400).json({ error: 'Missing analysis payload' });
        const triage = triageEngine({ analysis, answers: answers || [], redFlags: redFlags || {} });
        res.json({
            ...triage,
            timestamp: new Date().toISOString(),
            disclaimer: 'This assessment is AI-assisted and intended for educational support. It does not replace professional medical diagnosis or treatment.'
        });
    } catch (err) {
        console.error("Triage Error:", err);
        res.status(500).json({ error: 'Failed to generate triage decision' });
    }
});

// 2.5 Structured Copilot Refinement (/api/copilot-refine)
app.post('/api/copilot-refine', async (req, res) => {
    try {
        const { analysis, answers } = req.body || {};
        if (!analysis) return res.status(400).json({ error: 'Missing analysis payload' });
        if (!Array.isArray(answers) || answers.length === 0) return res.status(400).json({ error: 'Missing structured answers' });

        const triage = triageEngine({ analysis, answers, redFlags: {} });
        const finalScore = triage.refined_risk_score;
        const riskLevel = triage.urgency_level;
        const refinedExplanation = `Initial image analysis suggested ${triage.predicted_condition}. Structured symptom inputs refined the triage to ${triage.triage_pathway.toUpperCase()} with ${riskLevel.toUpperCase()} care urgency (${finalScore}%).`;
        const recommendations = [triage.recommendation_text, ...(triage.suggested_next_actions || [])];

        res.json({
            finalScore,
            riskLevel,
            refinedExplanation,
            recommendations,
            whyChanged: triage.reasoning_points,
            confidenceNote: 'This refined result combines image analysis with user-reported symptoms and is educational, not diagnostic.',
            detectedConditionLabel: triage.predicted_condition,
            contributionBreakdown: triage.contributionBreakdown,
            evidence_strength: triage.evidence_strength,
            evidence_strength_label: triage.evidence_strength_label,
            evidence_summary: triage.evidence_summary,
            evidence_drivers: triage.evidence_drivers,
            contradictions_detected: triage.contradictions_detected,
            support_breakdown: triage.support_breakdown,
            triage,
            answerSummary: answers.map((a) => ({
                question_id: a.question_id,
                question_text: a.question_text,
                answer_value: a.answer_value,
                answer_label: a.answer_label,
                condition_context: a.condition_context
            })),
            conditionContext: triage.predicted_condition,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error("Copilot Refine Error:", err);
        res.status(500).json({ error: 'Failed to refine structured assessment' });
    }
});

// 2.5 Nearby Clinics (/api/clinics)
app.post('/api/clinics', async (req, res) => {
    try {
        const { lat, lng } = req.body || {};
        const userLat = toFiniteNumber(lat, null);
        const userLng = toFiniteNumber(lng, null);
        if (!isValidLatitude(userLat) || !isValidLongitude(userLng)) {
            return res.status(400).json({
                error: 'Valid latitude/longitude required',
                ...formatClinicResponse('fallback', [], 'Invalid location input.')
            });
        }

        const prompt = `
            You are a local healthcare directory assistant.
            The user is currently at Latitude: ${userLat}, Longitude: ${userLng}.
            
            First, determine the EXACT city/town/area of these coordinates. Then, identify 5 REAL, VERIFIED dermatology clinics, skin specialists, or hospitals with dermatology departments that exist in that specific city or its immediate surrounding area.
            
            CRITICAL RULES:
            - Only return clinics that ACTUALLY EXIST. Do NOT invent or hallucinate clinic names.
            - Prefer well-known, established clinics and hospitals.
            - Include the full street address for each clinic.
            - For maps_url, use the format: "https://www.google.com/maps/search/?api=1&query=CLINIC_NAME+ADDRESS".
            - distance_km must be a number (or null if unknown).
            
            Return ONLY a valid JSON object with a "clinics" key containing an array. Each item must use this schema:
            {
              "clinics": [
                {
                  "id": "string",
                  "name": "Clinic Full Name",
                  "address": "Full street address, City, State",
                  "distance_km": 3.2,
                  "maps_url": "https://www.google.com/maps/search/?api=1&query=Clinic+Full+Name+City",
                  "latitude": 3.139,
                  "longitude": 101.6869,
                  "phone": "string or Not available",
                  "hours": "string or Not available",
                  "specialty": "Dermatology",
                  "source": "llm_generated",
                  "confidence": 0.8
                }
              ]
            }
        `;

        const response = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1,
            max_tokens: 600,
            response_format: { type: "json_object" }
        });

        const rawJson = response.choices[0]?.message?.content || '{"clinics":[]}';
        let parsed = JSON.parse(rawJson);
        const rawClinics = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed?.clinics)
                ? parsed.clinics
                : [];

        const normalized = rawClinics
            .map((entry, idx) => normalizeClinicEntry(entry, idx, userLat, userLng, 'llm_generated'))
            .filter(validateClinicSchema);

        if (normalized.length === 0) {
            const fallback = getFallbackClinics(userLat, userLng);
            return res.json(formatClinicResponse('fallback', fallback, 'Limited clinic information available for this location. Showing fallback suggestions.'));
        }

        if (normalized.length < 3) {
            const fallback = getFallbackClinics(userLat, userLng);
            const existingNames = new Set(normalized.map((c) => c.name.toLowerCase()));
            const merged = [...normalized];
            fallback.forEach((c) => {
                if (merged.length >= 5) return;
                if (!existingNames.has(c.name.toLowerCase())) merged.push(c);
            });
            return res.json(formatClinicResponse('partial', merged, 'Partial clinic data returned. Some entries use fallback sources.'));
        }

        return res.json(formatClinicResponse('success', normalized.slice(0, 5), 'Clinics retrieved successfully.'));
    } catch (err) {
        console.error("Clinics Error:", err);
        const { lat, lng } = req.body || {};
        const userLat = toFiniteNumber(lat, 3.139);
        const userLng = toFiniteNumber(lng, 101.6869);
        const fallback = getFallbackClinics(userLat, userLng);
        res.status(200).json(formatClinicResponse('fallback', fallback, 'Clinic service degraded. Showing fallback suggestions.'));
    }
});

// 3. Final Risk Synthesis (/api/synthesize)
app.post('/api/synthesize', async (req, res) => {
    try {
        const { imageScore, metadata, chatHistory } = req.body;

        const demoInfo = metadata?.icData ? `Patient Profile: ${metadata.icData.age}yo ${metadata.icData.gender}.` : '';

        const synthesisPrompt = `
            Calculate a final risk probability (0-100) based on:
            1. Image Analysis Score: ${imageScore}
            2. Medical/Lifestyle Metadata: ${JSON.stringify(metadata)}
            3. ${demoInfo}
            4. Chat interactions: ${JSON.stringify(chatHistory || [])}
            
            CRITICAL RULES:
            - The "Image Analysis Score" is the baseline. 
            - If the Image Analysis Score is low (e.g. < 40) due to common blemishes or acne, DO NOT artificially inflate the finalScore. Keep it low (similar to the image score) unless the Chat interactions reveal severe, life-threatening symptoms.
            - Do not hallucinate high risks for young healthy adults with acne.
            
            Output ONLY a JSON object: { "finalScore": 15, "insight": "Reasoning..." }
        `;

        const response = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: synthesisPrompt }],
            temperature: 0.2,
            max_tokens: 150,
            response_format: { type: "json_object" }
        });

        const rawJson = response.choices[0]?.message?.content || '{"finalScore": 50, "insight": "Unable to compute."}';
        const parsed = JSON.parse(rawJson);
        res.json(parsed);

    } catch (err) {
        console.error("Synthesis Error:", err);
        res.status(500).json({ error: 'Failed to synthesize data' });
    }
});

// ==========================================
// LEGACY CRUD ENDPOINTS
// ==========================================

// Create (Store arbitrary data)
app.post('/api/data', async (req, res) => {
    try {
        const { body } = req;
        const db = await dbPromise;

        // In SQLite/Postgres wrapper we serialize JSON payloads to strings
        const jsonData = JSON.stringify(body);
        const newRecord = await db.insert(jsonData);

        if (newRecord && newRecord.data) {
            newRecord.data = JSON.parse(newRecord.data);
        }

        res.status(201).json(newRecord);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error while saving data' });
    }
});

// Read All
app.get('/api/data', async (req, res) => {
    try {
        const db = await dbPromise;
        const allData = await db.getAll();

        // Parse the stored JSON strings back into objects structure
        const parsed = allData.map(row => ({
            ...row,
            data: JSON.parse(row.data)
        }));

        res.json(parsed);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error while fetching data' });
    }
});

// Read One by ID
app.get('/api/data/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const db = await dbPromise;
        const data = await db.getById(id);

        if (!data) {
            return res.status(404).json({ error: 'Data not found' });
        }

        data.data = JSON.parse(data.data);
        res.json(data);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error while fetching specific data' });
    }
});

// Update
app.put('/api/data/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { body } = req;
        const db = await dbPromise;

        const jsonData = JSON.stringify(body);
        const updateData = await db.update(id, jsonData);

        if (!updateData) {
            return res.status(404).json({ error: 'Data not found' });
        }

        if (updateData && updateData.data) {
            updateData.data = JSON.parse(updateData.data);
        }

        res.json(updateData);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error while updating data' });
    }
});

// Delete
app.delete('/api/data/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const db = await dbPromise;
        const changes = await db.deleteData(id);

        if (changes === 0) {
            return res.status(404).json({ error: 'Data not found' });
        }

        res.json({ message: 'Data deleted successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error while deleting data' });
    }
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
    // Check if dist was uploaded in the same folder (friendly for manual drag-and-drop)
    const distPath = fs.existsSync(path.join(__dirname, 'dist'))
        ? path.join(__dirname, 'dist')
        : path.join(__dirname, '../dist');

    app.use(express.static(distPath));

    // React Router catch-all
    app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} `);
});
