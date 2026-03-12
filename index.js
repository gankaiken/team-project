import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dbPromise from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Initialize OpenAI Client (Multi-Key Rotation) — using GPT-5-nano
const openAIKeys = (process.env.OPENAI_API_KEYS || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-5-nano';
const OPENAI_VISION_MODEL = process.env.OPENAI_VISION_MODEL || 'gpt-5-mini';
let currentOpenAIKeyIndex = 0;
const KEY_COOLDOWN_MS = 60 * 1000;
const openAIKeyHealth = openAIKeys.map(() => ({
    disabled: false,
    blockedUntil: 0,
    reason: ''
}));

const isOpenAIKeyUsable = (index) => {
    const state = openAIKeyHealth[index];
    if (!state) return false;
    if (state.disabled) return false;
    if (state.blockedUntil && Date.now() < state.blockedUntil) return false;
    return true;
};

const markOpenAIKeyDisabled = (index, reason) => {
    if (!openAIKeyHealth[index]) return;
    openAIKeyHealth[index].disabled = true;
    openAIKeyHealth[index].reason = reason || 'disabled';
};

const markOpenAIKeyCooldown = (index, ms, reason) => {
    if (!openAIKeyHealth[index]) return;
    openAIKeyHealth[index].blockedUntil = Date.now() + ms;
    openAIKeyHealth[index].reason = reason || 'cooldown';
};

const extractFirstJsonObject = (input = '') => {
    const text = String(input || '').trim();
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start >= 0 && end > start) {
            const slice = text.slice(start, end + 1);
            try {
                return JSON.parse(slice);
            } catch {
                return null;
            }
        }
        return null;
    }
};

const callOpenAIChatWithRotation = async ({
    model = OPENAI_CHAT_MODEL,
    messages = [],
    temperature = 0.3,
    maxTokens = 512,
    responseFormatJson = false
} = {}) => {
    if (!openAIKeys.length) {
        throw Object.assign(new Error('No valid OpenAI API key available.'), { status: 503 });
    }

    const usableKeyIndexes = [];
    for (let i = 0; i < openAIKeys.length; i++) {
        const idx = (currentOpenAIKeyIndex + i) % openAIKeys.length;
        if (isOpenAIKeyUsable(idx)) usableKeyIndexes.push(idx);
    }
    if (!usableKeyIndexes.length) {
        throw Object.assign(new Error('OpenAI temporarily unavailable: all keys are blocked, leaked, or cooling down.'), { status: 503 });
    }

    let lastErr = null;
    for (let attempt = 0; attempt < usableKeyIndexes.length; attempt++) {
        const keyIndex = usableKeyIndexes[attempt];
        const key = openAIKeys[keyIndex];
        try {
            console.log(`[OpenAI Proxy] Attempt ${attempt + 1}/${usableKeyIndexes.length}: Using key ending ...${key.slice(-4)} model ${model}`);
            const payload = {
                model,
                messages,
                max_completion_tokens: maxTokens
            };
            // gpt-5-nano only supports default temperature (1), so omit it for that model
            if (!model.startsWith('gpt-5')) payload.temperature = temperature;
            // gpt-5-nano may not support response_format, skip it for gpt-5 models
            if (responseFormatJson && !model.startsWith('gpt-5')) payload.response_format = { type: 'json_object' };

            const apiRes = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${key}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!apiRes.ok) {
                const errText = await apiRes.text();
                const err = Object.assign(new Error(errText || `OpenAI error ${apiRes.status}`), { status: apiRes.status });
                throw err;
            }

            const data = await apiRes.json();
            console.log('[OpenAI Raw Response]', JSON.stringify({
                finish_reason: data?.choices?.[0]?.finish_reason,
                refusal: data?.choices?.[0]?.message?.refusal,
                content_length: data?.choices?.[0]?.message?.content?.length,
                content_preview: String(data?.choices?.[0]?.message?.content || '').slice(0, 200)
            }));
            // gpt-5-nano may use refusal field or have content in a different location
            const content = data?.choices?.[0]?.message?.content
                || data?.choices?.[0]?.text
                || '';
            if (data?.choices?.[0]?.message?.refusal) {
                throw Object.assign(new Error(`OpenAI refused: ${data.choices[0].message.refusal}`), { status: 422 });
            }
            if (!content || !String(content).trim()) {
                console.error('[OpenAI] Full raw response:', JSON.stringify(data, null, 2));
                throw Object.assign(new Error('OpenAI returned empty content'), { status: 502 });
            }
            currentOpenAIKeyIndex = (keyIndex + 1) % openAIKeys.length;
            return {
                content: String(content),
                raw: data
            };
        } catch (err) {
            lastErr = err;
            const lower = String(err?.message || '').toLowerCase();
            if (err?.status === 429) {
                markOpenAIKeyCooldown(keyIndex, KEY_COOLDOWN_MS, 'rate_limited');
                continue;
            }
            if (err?.status === 403 && lower.includes('leaked')) {
                markOpenAIKeyDisabled(keyIndex, 'leaked');
                continue;
            }
            if (err?.status === 401 || err?.status === 403) {
                markOpenAIKeyDisabled(keyIndex, 'auth_error');
                continue;
            }
            if ([500, 502, 503, 504].includes(Number(err?.status || 0))) {
                markOpenAIKeyCooldown(keyIndex, Math.max(15000, Math.floor(KEY_COOLDOWN_MS / 2)), 'server_error');
                continue;
            }
            continue;
        }
    }

    throw lastErr || Object.assign(new Error('OpenAI unavailable'), { status: 503 });
};



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
const clinicDistanceValue = (entry) => (Number.isFinite(Number(entry?.distance_km)) ? Number(entry.distance_km) : Number.POSITIVE_INFINITY);
const dedupeClinics = (clinics = []) => {
    const seen = new Set();
    return clinics.filter((entry) => {
        const key = `${String(entry?.name || '').trim().toLowerCase()}|${String(entry?.address || '').trim().toLowerCase()}`;
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};
const hasReliableClinicCoordinates = (entry) => Number.isFinite(Number(entry?.latitude)) && Number.isFinite(Number(entry?.longitude));


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
    const conditionRaw = `${analysis?.detectedConditionLabel || ''} ${analysis?.conditions?.[0]?.category || ''} ${analysis?.conditions?.[0]?.description || ''} ${analysis?.primaryInsight || ''} ${analysis?.visualPatternSummary || ''}`.toLowerCase();
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
    const rankUrgency = (value = 'Low') => (value === 'High' ? 3 : value === 'Moderate' ? 2 : 1);
    const coalesceUrgency = (a = 'Low', b = 'Low') => (rankUrgency(a) >= rankUrgency(b) ? a : b);

    const predicted_condition = inferConditionLabel(analysis);
    const primaryCategory = String(analysis?.conditions?.[0]?.category || '').toLowerCase();
    const primarySeverity = String(analysis?.conditions?.[0]?.severity || '').toLowerCase();
    const visualSummary = String(analysis?.visualPatternSummary || '').toLowerCase();
    const visibilityQuality = String(analysis?.visibility_quality || '').toLowerCase();
    const confidence_score = Number(analysis?.conditions?.[0]?.confidence ?? 0.72);
    const confidence_label = confidenceLabelFromScore(confidence_score);
    const imageRisk = clampRisk(analysis?.suggestedRiskScore ?? analysis?.synthesis?.finalScore ?? 20);
    const uncertaintyLevel = String(analysis?.uncertainty_level || '').toLowerCase();

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
    if (uncertaintyLevel === 'high' && urgency_level === 'Low') urgency_level = 'Moderate';

    const healthyHighConf = predicted_condition === 'No significant skin disease detected' && confidence_label === 'High';
    const likelyMild = primarySeverity === 'low' || primarySeverity === 'mild' || imageRisk < 45;
    const likelyModerateInflammatory = primarySeverity === 'moderate' || primarySeverity === 'high' || imageRisk >= 50 || symptomConcernHigh;
    const weakVisualEvidence =
        confidence_label === 'Low' ||
        uncertaintyLevel === 'high' ||
        visibilityQuality === 'poor' ||
        visibilityQuality === 'fair';
    const uncertainSignal =
        primaryCategory.includes('other/uncertain') ||
        uncertaintyLevel === 'high' ||
        visibilityQuality === 'poor' ||
        visualSummary.includes('limited') ||
        visualSummary.includes('uncertain') ||
        visualSummary.includes('insufficient') ||
        ((primaryCategory.includes('fungal') || primaryCategory.includes('psoriasis')) && weakVisualEvidence);
    const normalSignal =
        primaryCategory.includes('normal tissue') ||
        predicted_condition.toLowerCase().includes('no significant skin disease detected') ||
        visualSummary.includes('no strong visible abnormality') ||
        visualSummary.includes('no obvious visible');
    const pigmentationSignal =
        primaryCategory.includes('pigment') ||
        predicted_condition.toLowerCase().includes('pigment') ||
        visualSummary.includes('pigmentation');
    const irritationSignal =
        primaryCategory.includes('eczema') ||
        primaryCategory.includes('irritation') ||
        primaryCategory.includes('rosacea') ||
        visualSummary.includes('redness') ||
        visualSummary.includes('flaking') ||
        visualSummary.includes('dryness');
    const inflammatoryFromIrritation =
        irritationSignal && (symptomSeverity >= 60 || spread >= 55 || duration >= 50 || recurrenceTrigger >= 55);
    const inflammatorySignal =
        (primaryCategory.includes('psoriasis') && !weakVisualEvidence) ||
        (primaryCategory.includes('fungal') && !weakVisualEvidence) ||
        (primaryCategory.includes('acne') && likelyModerateInflammatory) ||
        inflammatoryFromIrritation ||
        (visualSummary.includes('inflammatory') && likelyModerateInflammatory);
    const cosmeticSignal =
        pigmentationSignal ||
        (primaryCategory.includes('acne') && likelyMild) ||
        (visualSummary.includes('texture') && likelyMild);

    let concernFamily = 'uncertain_needs_review';
    if (normalSignal && !uncertainSignal) concernFamily = 'clear_preventive';
    else if (uncertainSignal) concernFamily = 'uncertain_needs_review';
    else if (inflammatorySignal) concernFamily = 'inflammatory_concern';
    else if (irritationSignal) concernFamily = 'irritation_sensitivity';
    else if (cosmeticSignal) concernFamily = 'cosmetic_mild';

    const familyDefaults = {
        clear_preventive: {
            refinedAssessment: 'No strong visible abnormality was detected. Continue preventive skin-health care and monitor for new changes.',
            urgency: 'Low',
            pathway: 'reassure',
            recommendation: {
                title: 'Reassure',
                text: 'Maintain routine skincare and daily sun protection. Re-scan if any new visible changes appear.',
                next: ['Use broad-spectrum SPF daily.', 'Continue gentle cleansing and hydration.', 'Re-scan if new spots, redness, or texture changes appear.']
            },
            evidenceFloor: 'early',
            familyReasoning: 'Image-stage pattern appears clear/preventive with no strong visible concern.'
        },
        cosmetic_mild: {
            refinedAssessment: 'A mild cosmetic-pattern concern is likely. This is commonly related to sun exposure, natural skin-tone variation, or mild breakout texture.',
            urgency: 'Low',
            pathway: 'self_care',
            recommendation: {
                title: 'Self-Care',
                text: 'Use preventive skincare and monitor for changes in color, shape, spread, or persistence.',
                next: ['Use daily broad-spectrum SPF.', 'Avoid harsh irritants/new strong actives.', 'Track pattern changes over 1-2 weeks.']
            },
            evidenceFloor: 'moderate',
            familyReasoning: 'Pattern maps to mild/cosmetic concern family with preventive follow-up guidance.'
        },
        irritation_sensitivity: {
            refinedAssessment: 'An irritation/sensitivity-like pattern is present. Symptom-guided monitoring and gentle skin-barrier care are recommended.',
            urgency: 'Moderate',
            pathway: 'monitor',
            recommendation: {
                title: 'Monitor',
                text: 'This looks irritation-sensitive rather than emergency-level. Protect the skin barrier and monitor progression closely.',
                next: ['Pause new harsh products/exfoliants.', 'Use gentle cleanser + moisturizer.', 'Escalate to care if symptoms spread, worsen, or persist.']
            },
            evidenceFloor: 'early',
            familyReasoning: 'Pattern aligns with irritation/sensitivity family (redness, flaking, or itch-linked signals).'
        },
        inflammatory_concern: {
            refinedAssessment: 'An inflammatory-pattern concern is likely and requires closer follow-up, especially if symptoms are active or persistent.',
            urgency: 'Moderate',
            pathway: 'self_care',
            recommendation: {
                title: 'Self-Care',
                text: 'Use cautious supportive care and monitor closely; seek professional review if symptoms continue to worsen.',
                next: ['Avoid picking/scratching and irritating products.', 'Monitor spread, pain, and persistence over days.', 'Use clinic review if worsening or persistent.']
            },
            evidenceFloor: 'early',
            familyReasoning: 'Pattern maps to inflammatory concern family from visible and symptom signals.'
        },
        uncertain_needs_review: {
            refinedAssessment: 'Visual evidence is limited or ambiguous. Use cautious follow-up and consider re-scan with better lighting/angle.',
            urgency: 'Moderate',
            pathway: 'monitor',
            recommendation: {
                title: 'Monitor',
                text: 'This result is uncertainty-aware and should not be interpreted as strong reassurance. Re-scan and monitor symptoms.',
                next: ['Improve lighting and camera angle, then re-scan.', 'Monitor for spread, pain, or persistent change.', 'Seek care sooner if red-flag symptoms appear.']
            },
            evidenceFloor: 'limited',
            familyReasoning: 'Image and/or symptom inputs were insufficient or conflicting, so uncertainty-aware guidance is used.'
        }
    };

    const defaultPack = familyDefaults[concernFamily] || familyDefaults.uncertain_needs_review;
    let finalPredictedCondition = predicted_condition;
    if (concernFamily === 'clear_preventive') finalPredictedCondition = 'No significant visible concern';
    if (concernFamily === 'cosmetic_mild' && pigmentationSignal) finalPredictedCondition = 'Mild Pigmentation Concern';

    const riskBandByFamily = {
        clear_preventive: [8, 28],
        cosmetic_mild: [20, 40],
        irritation_sensitivity: [30, 60],
        inflammatory_concern: [42, 78],
        uncertain_needs_review: [24, 58]
    };
    const [riskMin, riskMax] = riskBandByFamily[concernFamily] || [20, 65];
    let finalRiskScore = clampRisk(Math.min(Math.max(refined_risk_score, riskMin), riskMax));
    let finalUrgency = coalesceUrgency(defaultPack.urgency, urgency_level);
    let finalPathway = defaultPack.pathway;
    if (finalUrgency === 'High') finalPathway = 'seek_care';
    else if (concernFamily === 'inflammatory_concern' && finalUrgency === 'Moderate') finalPathway = 'self_care';
    else if (concernFamily === 'irritation_sensitivity' && finalUrgency === 'Moderate') finalPathway = 'monitor';

    if (red_flag_triggered) {
        finalUrgency = 'High';
        finalPathway = 'seek_care';
        finalRiskScore = clampRisk(Math.max(finalRiskScore, 68));
    }

    let recommendation = {
        title: defaultPack.recommendation.title,
        text: defaultPack.recommendation.text,
        next: [...defaultPack.recommendation.next]
    };

    if (finalPathway === 'seek_care') {
        recommendation = {
            title: 'Seek Care',
            text: 'Higher-concern or red-flag signals were detected. Professional medical review is recommended.',
            next: ['Arrange clinic/dermatology review soon.', 'Use the in-app clinic finder for nearby options.', 'Seek urgent care if symptoms rapidly worsen.']
        };
    }

    if (pigmentationSignal && !red_flag_triggered) {
        recommendation = {
            title: 'Self-Care',
            text: 'Mild pigmentation variation may relate to sun exposure or natural skin-tone variation. Use sun protection and monitor color, shape, or spread changes.',
            next: ['Use broad-spectrum SPF daily.', 'Monitor changes in color, shape, or spread.', 'Seek review if pigmentation changes rapidly.']
        };
        finalUrgency = 'Low';
        finalPathway = 'self_care';
        finalRiskScore = clampRisk(Math.min(Math.max(finalRiskScore, 22), 38));
    }

    const reasoning_points = [];
    reasoning_points.push(`Concern-family mapping: ${concernFamily.replace(/_/g, ' ')}.`);
    reasoning_points.push(defaultPack.familyReasoning);
    if (duration >= 50) reasoning_points.push('Longer symptom duration increased concern.');
    else reasoning_points.push('Short duration reduced urgency weighting.');
    if (symptomSeverity >= 60) reasoning_points.push('Symptom intensity increased severity weighting.');
    else reasoning_points.push('Milder symptoms reduced severity weighting.');
    if (spread >= 55) reasoning_points.push('Reported spread/change increased follow-up priority.');
    if (confidence_label === 'Low') reasoning_points.push('Low AI confidence required a more cautious triage path.');
    if (analysis?.visualPatternSummary) reasoning_points.push(`Visual pattern summary: ${analysis.visualPatternSummary}`);
    if (uncertaintyLevel === 'high') reasoning_points.push('Image-stage uncertainty was high, so follow-up caution was increased.');
    if (red_flag_triggered) reasoning_points.push('Red-flag symptoms triggered safer escalation.');

    const evidence = calculateEvidenceStrength({
        confidenceScore: confidence_score,
        confidenceLabel: confidence_label,
        answersCount: (answers || []).length,
        healthyHighConf,
        symptomConcernHigh,
        redFlagTriggered: red_flag_triggered
    });
    const finalEvidence = { ...evidence };
    if (concernFamily === 'cosmetic_mild' && (visibilityQuality === 'good' || visibilityQuality === 'excellent')) {
        finalEvidence.evidence_strength = 'moderate';
        finalEvidence.evidence_strength_label = 'Moderate';
        finalEvidence.evidence_summary = 'Image quality and visible pattern consistency support a mild cosmetic concern interpretation.';
    }
    if (concernFamily === 'clear_preventive' && confidence_label === 'High' && (visibilityQuality === 'good' || visibilityQuality === 'excellent')) {
        finalEvidence.evidence_strength = finalEvidence.evidence_strength === 'strong' ? 'strong' : 'moderate';
        finalEvidence.evidence_strength_label = finalEvidence.evidence_strength === 'strong' ? 'Strong' : 'Moderate';
        finalEvidence.evidence_summary = 'Clear visual signals support a preventive interpretation with no strong visible concern.';
    }
    if (concernFamily === 'uncertain_needs_review') {
        finalEvidence.evidence_strength = visibilityQuality === 'poor' || uncertaintyLevel === 'high' ? 'limited' : 'early';
        finalEvidence.evidence_strength_label = finalEvidence.evidence_strength === 'limited' ? 'Limited' : 'Early';
        finalEvidence.evidence_summary = 'Evidence is uncertain or incomplete, so this output is exploratory and should be interpreted cautiously.';
    }

    const refinedAssessment = (() => {
        if (concernFamily === 'cosmetic_mild' && pigmentationSignal) {
            return 'Mild pigmentation variation may be related to sun exposure or natural skin-tone variation. This is low urgency and suited for preventive monitoring.';
        }
        if (concernFamily === 'clear_preventive') {
            return 'No strong visible concern was detected. Preventive skin-health guidance is provided to maintain stability and monitor for changes.';
        }
        return `${defaultPack.refinedAssessment} This interpretation combines image signals, Copilot answers, and triage safety logic.`;
    })();

    return {
        predicted_condition: finalPredictedCondition,
        confidence_score,
        confidence_label,
        refined_risk_score: finalRiskScore,
        urgency_level: finalUrgency,
        triage_pathway: finalPathway,
        recommendation_title: recommendation.title,
        recommendation_text: recommendation.text,
        refined_assessment: refinedAssessment,
        concern_family: concernFamily,
        family_reasoning: defaultPack.familyReasoning,
        family_default_action: defaultPack.recommendation.text,
        reasoning_points,
        red_flag_triggered,
        red_flag_details: computedRedFlags,
        suggested_next_actions: recommendation.next,
        contributionBreakdown: {
            imageAnalysis: 50,
            symptomInputs: 30,
            contextualFactors: 20
        },
        ...finalEvidence
    };
};

// ==========================================
// Analyze Resilience Layer (Live -> Cache -> Fallback)
// ==========================================
const ANALYSIS_CACHE_TTL_MS = Number(process.env.ANALYSIS_CACHE_TTL_MS || 10 * 60 * 1000);
const DEMO_MODE = String(process.env.DEMO_MODE || '').toLowerCase() === 'true';
const DEMO_FORCE_FALLBACK = String(process.env.DEMO_FORCE_FALLBACK || '').toLowerCase() === 'true';
const DEMO_SCENARIO = String(process.env.DEMO_SCENARIO || '').trim().toLowerCase();
const ANALYZE_PROMPT_VERSION = 'v2.2-derm-sensitive';
const analysisCache = new Map();

const hashString = (text = '') => {
    let h = 0;
    for (let i = 0; i < text.length; i++) h = ((h << 5) - h) + text.charCodeAt(i);
    return Math.abs(h >>> 0);
};

const buildImageEntropyFingerprint = (imageBase64 = '') => {
    const raw = String(imageBase64 || '');
    if (!raw) return 'empty';
    const len = raw.length;
    const start = raw.slice(0, 96);
    const midStart = Math.max(0, Math.floor(len / 2) - 48);
    const mid = raw.slice(midStart, midStart + 96);
    const end = raw.slice(Math.max(0, len - 96));
    let sampled = '';
    const step = Math.max(1, Math.floor(len / 40));
    for (let i = 0; i < len; i += step) sampled += raw[i];
    return `${len}|${hashString(start)}|${hashString(mid)}|${hashString(end)}|${hashString(sampled)}`;
};

const getAnalyzeCacheKey = ({ imageBase64 = '', icData = {} }) => {
    const ic = String(icData?.ic || '').trim();
    if (ic) return `ic:${ic}`;
    const demoProfile = `${icData?.age || 'na'}-${icData?.gender || 'na'}`;
    const imageFingerprint = buildImageEntropyFingerprint(String(imageBase64 || ''));
    return `anon:${demoProfile}:${hashString(imageFingerprint) % 999983}`;
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
    if (merged.includes('no clear') || merged.includes('limited evidence') || merged.includes('insufficient') || merged.includes('uncertain') || merged.includes('ambiguous')) return 'Other/Uncertain';
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

const faceZonesFromBBox = (bbox = []) => {
    if (!Array.isArray(bbox) || bbox.length !== 4) return [];
    const [ymin, xmin, ymax, xmax] = bbox.map((v) => Number(v));
    if (![ymin, xmin, ymax, xmax].every((v) => Number.isFinite(v))) return [];
    const x = (xmin + xmax) / 2;
    const y = (ymin + ymax) / 2;
    const zones = [];
    if (y < 0.35) zones.push('Forehead');
    if (x < 0.38 && y >= 0.3 && y <= 0.72) zones.push('Left Cheek');
    if (x > 0.62 && y >= 0.3 && y <= 0.72) zones.push('Right Cheek');
    if (x >= 0.42 && x <= 0.58 && y >= 0.35 && y <= 0.68) zones.push('Nose');
    if (y > 0.68) zones.push('Chin/Jawline');
    return zones.length ? zones : ['Central Face'];
};

const inferPatternLabel = ({ category = '', description = '', signals = [] }) => {
    const merged = `${String(category).toLowerCase()} ${String(description).toLowerCase()} ${(signals || []).join(' ').toLowerCase()}`;
    if (merged.includes('acne') || merged.includes('papule') || merged.includes('pimple') || merged.includes('comedone')) return 'acne_like_breakout_pattern';
    if (merged.includes('red') || merged.includes('irrit') || merged.includes('erythema') || merged.includes('rosacea')) return 'redness_irritation_pattern';
    if (merged.includes('dry') || merged.includes('flaky') || merged.includes('scale') || merged.includes('eczema')) return 'dryness_flaking_pattern';
    if (merged.includes('pigment') || merged.includes('dark spot') || merged.includes('hyperpig')) return 'pigmentation_irregularity_pattern';
    if (merged.includes('inflam') || merged.includes('lesion') || merged.includes('texture')) return 'inflammatory_texture_pattern';
    if (merged.includes('uncertain') || merged.includes('insufficient') || merged.includes('limited')) return 'uncertain_visual_evidence';
    if (merged.includes('normal') || merged.includes('healthy') || merged.includes('no visible')) return 'no_strong_visible_abnormality';
    return 'uncertain_visual_evidence';
};

const normalizeAnalyzeResult = (raw = {}, {
    analysisMode = 'live',
    demoSafe = false,
    fallbackUsed = false,
    uncertaintyReason = '',
    source = 'openai'
} = {}) => {
    const parsed = (raw && typeof raw === 'object') ? { ...raw } : {};
    const incomingConditions = Array.isArray(parsed.conditions) ? parsed.conditions : [];
    const rawConditionLabels = incomingConditions.map((c) => String(c?.category || '')).filter(Boolean);
    const conditions = incomingConditions.map((condition) => {
        const normalizedCategory = normalizeConditionCategory(condition?.category, condition?.description);
        const confidence = Number(condition?.confidence);
        const bounded = Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.72;
        const severityRaw = String(condition?.severity || '').toLowerCase();
        const severity = ['low', 'mild', 'moderate', 'high'].includes(severityRaw)
            ? (severityRaw === 'low' ? 'mild' : severityRaw)
            : (bounded >= 0.82 ? 'moderate' : bounded >= 0.62 ? 'mild' : 'low');
        const validZones = ['forehead','left_cheek','right_cheek','nose','chin','jawline_left','jawline_right','T_zone','upper_lip','under_eyes','left_temple','right_temple','neck','full_face'];
        const rawZone = String(condition?.affected_zone || condition?.affectedZone || '').toLowerCase().replace(/\s+/g, '_');
        const affected_zone = validZones.includes(rawZone) ? rawZone : 'full_face';
        let bbox = condition?.boundingBox;
        if (!Array.isArray(bbox) || bbox.length !== 4) bbox = null;
        else bbox = bbox.map((v) => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.5; });
        return {
            category: normalizedCategory,
            confidence: Number(bounded.toFixed(2)),
            description: String(condition?.description || 'No significant abnormality highlighted.'),
            severity,
            affected_zone,
            boundingBox: bbox
        };
    });

    // Enforce max 2 conditions
    if (conditions.length > 2) {
        conditions.length = 2;
    }

    const personDetected = parsed?.person_detected !== false;
    const goodAngle = parsed?.good_angle !== false;
    const visibilityIncoming = String(parsed?.visibility_quality || '').toLowerCase();
    const visibility_quality = ['poor', 'fair', 'good', 'excellent'].includes(visibilityIncoming)
        ? visibilityIncoming
        : (!personDetected ? 'poor' : (!goodAngle ? 'fair' : 'good'));
    const screening_confidence_raw = Number(parsed?.screening_confidence);
    const screening_confidence = Number.isFinite(screening_confidence_raw)
        ? Math.max(0, Math.min(1, screening_confidence_raw))
        : (visibility_quality === 'poor' ? 0.35 : visibility_quality === 'fair' ? 0.55 : 0.78);
    const uncertaintyIncoming = String(parsed?.uncertainty_level || '').toLowerCase();
    const uncertainty_level = ['low', 'moderate', 'high'].includes(uncertaintyIncoming)
        ? uncertaintyIncoming
        : (visibility_quality === 'poor' ? 'high' : visibility_quality === 'fair' ? 'moderate' : 'low');
    const shouldForceUncertain = !personDetected || visibility_quality === 'poor';
    const incomingPrimaryCategory = String(conditions?.[0]?.category || '').toLowerCase();
    const incomingPrimaryConfidence = Number(conditions?.[0]?.confidence ?? screening_confidence);
    const rawInsight = String(parsed?.primaryInsight || '').toLowerCase();
    const normalCandidate =
        incomingPrimaryCategory.includes('normal tissue') ||
        incomingPrimaryCategory.includes('healthy') ||
        rawInsight.includes('generally normal tissue') ||
        rawInsight.includes('generally healthy') ||
        rawInsight.includes('no obvious visible skin concern');

    // Check if the AI actually detected a real non-normal, non-uncertain condition
    const hasRealFindings = conditions.some(c => {
        const cat = String(c?.category || '').toLowerCase();
        return !cat.includes('normal') && !cat.includes('healthy') && !cat.includes('uncertain') && !cat.includes('other');
    });

    const allowHealthyReassurance =
        !shouldForceUncertain &&
        normalCandidate &&
        Number.isFinite(incomingPrimaryConfidence) &&
        incomingPrimaryConfidence >= 0.75 &&
        screening_confidence >= 0.65 &&
        goodAngle;
    const shouldDowngradeHealthyToUncertain = normalCandidate && !allowHealthyReassurance;

    // CRITICAL: Never override real detected conditions (acne, eczema, etc.)
    // Only force uncertain when no real findings exist AND quality is truly bad
    const effectiveForceUncertain = (shouldForceUncertain || shouldDowngradeHealthyToUncertain) && !hasRealFindings;

    const safeConditions = effectiveForceUncertain
        ? [{
            category: 'Other/Uncertain',
            confidence: Number(Math.min(0.62, screening_confidence).toFixed(2)),
            severity: 'low',
            description: shouldDowngradeHealthyToUncertain
                ? 'Visible signal appears low concern, but evidence is not strong enough for confident healthy reassurance.'
                : 'Insufficient visual evidence for a strong dermatology screening conclusion.',
            affected_zone: 'full_face'
        }]
        : (conditions.length ? conditions : [{
            category: 'Other/Uncertain',
            confidence: Number(Math.min(0.62, screening_confidence).toFixed(2)),
            severity: 'low',
            description: 'No strong visible abnormality was detected, but evidence is limited.',
            affected_zone: 'full_face'
        }]);
    const primaryCategory = safeConditions[0]?.category || 'Normal Tissue';
    const isHealthy = primaryCategory === 'Normal Tissue';
    const suggestedRiskScore = clampRisk(parsed?.suggestedRiskScore ?? (effectiveForceUncertain ? 30 : (isHealthy ? 14 : 42)));

    const healthyReasons = [
        'skin tone appears relatively even',
        'no strong inflammatory lesion is visible',
        'no obvious flaking/redness/pigmentation abnormality is seen',
        'image clarity is sufficient for a basic visual screening'
    ];
    const healthyExplanationDefault = `Healthy-screening rationale: ${healthyReasons.join('; ')}.`;
    const uncertaintyText = uncertaintyReason || (effectiveForceUncertain
        ? (shouldDowngradeHealthyToUncertain
            ? 'Low-concern visual appearance was detected, but confidence/quality was insufficient for a reliable healthy conclusion.'
            : 'Image quality or angle is insufficient for strong reassurance.')
        : '');
    const zones = [...new Set(safeConditions.map((c) => c?.affected_zone || 'full_face').filter(z => z !== 'full_face'))];
    const patternType = inferPatternLabel({
        category: safeConditions[0]?.category,
        description: safeConditions[0]?.description,
        signals: parsed?.signals || []
    });
    const visualPatternSummaryDefault = (() => {
        if (effectiveForceUncertain) return 'Visual evidence is limited and uncertain for reliable pattern-level screening.';
        if (patternType === 'no_strong_visible_abnormality') return 'No strong visible abnormality detected on the scanned face region.';
        if (patternType === 'acne_like_breakout_pattern') return `Mild acne-like breakout pattern detected${zones.length ? ` around ${zones.slice(0, 2).join(' and ')}` : ''}.`;
        if (patternType === 'redness_irritation_pattern') return `Mild redness/irritation pattern detected${zones.length ? ` across ${zones.slice(0, 2).join(' and ')}` : ''}.`;
        if (patternType === 'dryness_flaking_pattern') return `Dryness/flaking-like pattern detected${zones.length ? ` in ${zones.slice(0, 2).join(' and ')}` : ''}.`;
        if (patternType === 'pigmentation_irregularity_pattern') return `Pigmentation irregularity-like pattern detected${zones.length ? ` around ${zones.slice(0, 2).join(' and ')}` : ''}.`;
        return 'Visible skin-pattern signals were detected but remain pattern-level and non-diagnostic.';
    })();

    return {
        person_detected: personDetected,
        good_angle: goodAngle,
        conditions: safeConditions,
        signals: Array.isArray(parsed?.signals) ? parsed.signals.map((s) => String(s)).slice(0, 10) : (isHealthy ? ['uniform tone', 'no strong inflammatory lesion'] : ['localized pattern']),
        primaryInsight: String((effectiveForceUncertain
            ? 'Visual evidence is limited; no strong abnormality is visible, but confidence is insufficient for a strong reassurance result.'
            : isHealthy
                ? 'No obvious visible skin concern detected on the scanned face region.'
                : (parsed?.primaryInsight || 'The scanned face region shows visible skin-concern patterns requiring follow-up.'))),
        explanation: String(parsed?.explanation || (effectiveForceUncertain
            ? `Screening uncertainty: ${uncertaintyText || 'Low clarity, angle, or visibility limited reliable interpretation.'}`
            : isHealthy
                ? healthyExplanationDefault
                : 'Image-stage output reflects visible skin-pattern findings (location, intensity, uncertainty), not a definitive diagnosis.')),
        suggestedRiskScore,
        bodyPart: String(parsed?.bodyPart || 'head'),
        visualPatternSummary: String(parsed?.visualPatternSummary || visualPatternSummaryDefault),
        detected_pattern_type: patternType,
        affected_zones: zones,
        screening_confidence: Number(screening_confidence.toFixed(2)),
        visibility_quality,
        uncertainty_level,
        analysis_mode: analysisMode,
        demo_safe: Boolean(demoSafe),
        fallback_used: Boolean(fallbackUsed),
        prompt_version: ANALYZE_PROMPT_VERSION,
        normalized_from: source,
        raw_condition_labels: rawConditionLabels,
        uncertainty_reason: uncertaintyText || undefined
    };
};

const buildFallbackScenario = (scenario = 'auto', icData = {}, entropySeed = '') => {
    const normalized = String(scenario || 'auto').toLowerCase();
    const age = Number(icData?.age);
    let resolvedScenario = normalized;
    if (normalized === 'auto') {
        if (Number.isFinite(age) && age <= 25) resolvedScenario = 'acne';
        else if (Number.isFinite(age) && age >= 45) resolvedScenario = 'eczema';
        else {
            const hashed = hashString(String(entropySeed || Date.now()));
            const bucket = hashed % 100;
            resolvedScenario = bucket < 55 ? 'acne' : bucket < 90 ? 'eczema' : 'healthy';
        }
    }

    if (resolvedScenario === 'eczema') {
        return {
            person_detected: true,
            good_angle: true,
            conditions: [{
                category: 'Eczema/Irritation',
                confidence: 0.74,
                description: 'Moderate irritation-like dryness and redness pattern.',
                affected_zone: 'left_cheek'
            }],
            signals: ['dry texture', 'localized redness'],
            primaryInsight: 'Scanning the face reveals a possible eczema-like irritation pattern.',
            explanation: 'Visible redness and dryness/flaking-like texture suggest an irritation-like visual pattern requiring follow-up.',
            visualPatternSummary: 'Moderate irritation-like redness and dryness pattern on central face.',
            suggestedRiskScore: 58,
            bodyPart: 'head',
            screening_confidence: 0.66,
            visibility_quality: 'good',
            uncertainty_level: 'moderate'
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
                affected_zone: 'T_zone'
            }],
            signals: ['papules', 'mild redness'],
            primaryInsight: 'Scanning the face reveals a mild acne-like concern.',
            explanation: 'Localized papule-like inflammatory markers are visually consistent with a mild acne-like breakout pattern.',
            visualPatternSummary: 'Mild acne-like breakout pattern in lower central face.',
            suggestedRiskScore: 41,
            bodyPart: 'head',
            screening_confidence: 0.72,
            visibility_quality: 'good',
            uncertainty_level: 'low'
        };
    }
    return {
        person_detected: true,
        good_angle: true,
        conditions: [{
            category: 'Normal Tissue',
            confidence: 0.9,
            description: 'No obvious dermatological concern identified with adequate visual clarity.',
            affected_zone: 'full_face'
        }],
        signals: ['uniform skin tone', 'no strong inflammatory lesion'],
        primaryInsight: 'No obvious visible skin concern detected on the scanned face region.',
        explanation: 'Healthy-screening rationale: skin tone appears relatively even; no strong inflammatory lesion is visible; no obvious flaking/redness/pigmentation abnormality is seen; image clarity is sufficient for a basic visual screening.',
        visualPatternSummary: 'No strong visible abnormality detected.',
        suggestedRiskScore: 14,
        bodyPart: 'head',
        screening_confidence: 0.78,
        visibility_quality: 'good',
        uncertainty_level: 'low'
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
            buildFallbackScenario(forcedScenario, icData, cacheKey),
            {
                analysisMode: 'fallback',
                demoSafe: true,
                fallbackUsed: true,
                uncertaintyReason: 'Fallback forced by demo configuration.',
                source: 'forced_demo_fallback'
            }
        );
        setCachedAnalysis(cacheKey, fallbackForced);
        return res.json(fallbackForced);
    }

    try {
        if (!openAIKeys.length) {
            throw Object.assign(new Error('Vision AI temporarily unavailable: missing OpenAI API keys'), { status: 503 });
        }

        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        const mimeType = imageBase64.match(/^data:(image\/\w+);base64,/)?.[1] || "image/jpeg";
        const demoContext = icData ? `Patient: ${icData.age}yo ${icData.gender}.` : '';

        const systemPrompt = `You are DermaAI, a clinical-grade dermatology visual screening AI. You analyze skin/face photos and return structured JSON findings.

RULES:
- Be thorough: examine every visible skin region (forehead, cheeks, nose, chin, jawline, neck if visible).
- Report every obvious or concerning abnormalities. Max. 4 conditions. 
- For each finding, specify the affected_zone as one of: "forehead", "left_cheek", "right_cheek", "nose", "chin", "jawline_left", "jawline_right", "T_zone", "upper_lip", "under_eyes", "left_temple", "right_temple", "neck", "full_face".
- Pick the zone that BEST matches where the issue is physically located on the face.
- Confidence must reflect actual visual evidence strength, not a guess. Use 0.5-0.7 for subtle findings, 0.7-0.85 for clear findings, 0.85+ only for unmistakable patterns.
- NEVER default to "Normal Tissue" unless the skin genuinely shows no abnormality AND image quality is good/excellent.
- If you see ANY texture irregularity, redness, bumps, dryness, discoloration, or lesions, report them as conditions.
- Categories MUST be one of: "Acne", "Eczema/Irritation", "Fungal Infection", "Pigmentation Concern", "Rosacea/Redness Pattern", "Psoriasis Pattern", "Normal Tissue", "Other/Uncertain"
- Severity MUST be one of: "mild", "moderate", "high"
- Return ONLY valid JSON, no markdown, no explanation outside JSON.`;

        const userPrompt = `${demoContext}
Analyze this skin image. Look carefully at every region.

Return this exact JSON structure:
{
  "person_detected": boolean,
  "good_angle": boolean,
  "screening_confidence": 0.0-1.0,
  "visibility_quality": "poor"|"fair"|"good"|"excellent",
  "visualPatternSummary": "one-line summary of what you see",
  "uncertainty_level": "low"|"moderate"|"high",
  "conditions": [
    { "category": "...", "confidence": 0.0-1.0, "description": "specific description of what you see", "severity": "mild|moderate|high", "affected_zone": "forehead|left_cheek|right_cheek|nose|chin|jawline_left|jawline_right|T_zone|upper_lip|under_eyes|left_temple|right_temple|neck|full_face" }
  ],
  "signals": ["signal1", "signal2"],
  "primaryInsight": "main finding in plain language",
  "explanation": "clinical reasoning for the finding",
  "suggestedRiskScore": 0-100,
  "bodyPart": "head",
  "uncertainty_reason": ""
}`;

        let parsed = null;
        let source = '';
        let lastErr = null;

        try {
            const openAIResponse = await callOpenAIChatWithRotation({
                model: OPENAI_VISION_MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: userPrompt },
                            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}`, detail: 'high' } }
                        ]
                    }
                ],
                temperature: 0.1,
                maxTokens: 16384,
                responseFormatJson: true
            });
            parsed = extractFirstJsonObject(openAIResponse?.content);
            if (!parsed) throw Object.assign(new Error('OpenAI vision returned non-JSON response'), { status: 502 });
            source = 'openai';
        } catch (openAIErr) {
            lastErr = openAIErr;
            console.error('[OpenAI Vision] Failed:', openAIErr?.message || openAIErr);
        }

        if (!parsed) throw lastErr || Object.assign(new Error('Vision AI unavailable'), { status: 503 });

        const normalized = normalizeAnalyzeResult(parsed, {
            analysisMode: 'live',
            demoSafe: false,
            fallbackUsed: false,
            source: source || 'vision_provider'
        });
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
                    demo_safe: true,
                    prompt_version: cached?.prompt_version || ANALYZE_PROMPT_VERSION,
                    fallback_used: Boolean(cached?.fallback_used),
                    normalized_from: cached?.normalized_from || 'cache'
                });
            }

            const autoScenario = ['healthy', 'acne', 'eczema'].includes(forcedScenario) ? forcedScenario : 'auto';
            const fallback = normalizeAnalyzeResult(
                buildFallbackScenario(autoScenario, icData, cacheKey),
                {
                    analysisMode: 'fallback',
                    demoSafe: true,
                    fallbackUsed: true,
                    uncertaintyReason: 'Live vision service unavailable; fallback scenario used for resilience mode.',
                    source: 'fallback_scenario'
                }
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
                source: 'validation',
                language: 'English',
                source_context_used: false,
                error_message: 'No messages provided',
                debug_reason: 'Validation: no messages provided',
                debug_context_summary: null
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
        const latestUserMessage = [...messages].reverse().find((m) => m?.sender === 'user' && typeof m.text === 'string')?.text || '';
        let debugReason = null;

        const buildDeterministicFallback = () => {
            const detected = contextSummary.detected_condition;
            const confidence = contextSummary.confidence_label;
            const urgency = contextSummary.urgency_level;
            const pathway = String(contextSummary.triage_pathway || 'monitor').replace('_', ' ');
            const recommendation = contextSummary.recommendation_text && contextSummary.recommendation_text !== 'Not available'
                ? contextSummary.recommendation_text
                : 'Continue gentle skin care, monitor for changes, and seek professional review if symptoms worsen.';
            const userQuestion = String(latestUserMessage || '').toLowerCase().trim();

            if (/why\b.*acne|why do i have acne|why does acne appear|cause.*acne|acne.*appear/.test(userQuestion)) {
                return languageLabel === 'Melayu'
                    ? 'Jerawat biasanya muncul apabila pori tersumbat oleh minyak, sel kulit mati, dan keradangan. Pada muka, ini sering dipengaruhi oleh hormon, stres, produk yang tidak sesuai, peluh, atau geseran. Berdasarkan keputusan semasa anda, ini kelihatan rendah urgensi, jadi fokus pada penjagaan lembut, elakkan memicit, dan pantau jika ia bertambah teruk.'
                    : languageLabel === 'Chinese'
                        ? '痤疮通常是因为毛孔被油脂、死皮和炎症堵塞而出现。脸部常见诱因包括荷尔蒙变化、压力、不合适的护肤品、出汗或摩擦。根据您当前的结果，这看起来属于较低紧急程度，因此建议温和护理、不要挤压，并观察是否加重。'
                        : 'Acne usually appears when pores become clogged with oil, dead skin, and inflammation. On the face, common triggers include hormones, stress, unsuitable skincare, sweat, or friction. Based on your current result, this looks low urgency, so focus on gentle care, avoid squeezing, and monitor for worsening.';
            }
            if (/explain my result|terangkan keputusan saya|\u89e3\u91ca\u6211\u7684\u7ed3\u679c/.test(userQuestion)) {
                return languageLabel === 'Melayu'
                    ? `Keputusan anda menunjukkan corak ${detected}. Tahap keyakinan AI ialah ${confidence} dan tahap urgensi penjagaan ialah ${urgency}. Ini ialah saringan visual, bukan diagnosis muktamad. Maksud praktikalnya: ${recommendation}`
                    : languageLabel === 'Chinese'
                        ? `您的结果显示为 ${detected} 模式。AI 置信度为 ${confidence}，护理紧急程度为 ${urgency}。这属于视觉筛查结果，不是最终诊断。实际建议是：${recommendation}`
                        : `Your result suggests a ${detected} pattern. AI confidence is ${confidence} and care urgency is ${urgency}. This is a visual screening result, not a definitive diagnosis. In practical terms: ${recommendation}`;
            }
            if (/explain my risk level|terangkan tahap risiko saya|\u89e3\u91ca\u6211\u7684\u98ce\u9669\u7b49\u7ea7/.test(userQuestion)) {
                return languageLabel === 'Melayu'
                    ? `Tahap risiko anda sekarang kelihatan ${urgency.toLowerCase()} kerana corak yang dikesan tidak menunjukkan isyarat amaran yang kuat. Laluan triage semasa ialah ${pathway}.`
                    : languageLabel === 'Chinese'
                        ? `您当前的风险等级偏${urgency}，因为目前检测到的模式没有显示强烈的高危信号。当前分流路径为 ${pathway}。`
                        : `Your current risk level looks ${urgency.toLowerCase()} because the detected pattern does not show strong high-concern warning signals right now. Current triage pathway: ${pathway}.`;
            }
            if (/what should i do next|apakah langkah seterusnya|\u6211\u4e0b\u4e00\u6b65\u8be5\u600e\u4e48\u505a/.test(userQuestion)) {
                return languageLabel === 'Melayu'
                    ? `Langkah seterusnya yang paling penting: ${recommendation}`
                    : languageLabel === 'Chinese'
                        ? `您现在最重要的下一步是：${recommendation}`
                        : `The most important next step for you right now is: ${recommendation}`;
            }
            if (/when should i see a doctor|bilakah.*doktor|\u4ec0\u4e48\u65f6\u5019.*\u533b\u751f/.test(userQuestion)) {
                return languageLabel === 'Melayu'
                    ? 'Berjumpa doktor jika kawasan ini cepat merebak, menjadi lebih sakit, bernanah, berdarah, atau tidak pulih selepas beberapa hari penjagaan lembut.'
                    : languageLabel === 'Chinese'
                        ? '如果该区域迅速扩散、明显更痛、出现脓液、出血，或经过几天温和护理后仍没有改善，就应尽快看医生。'
                        : 'See a doctor if the area spreads quickly, becomes more painful, develops pus or bleeding, or does not improve after several days of gentle care.';
            }
            if (/daily monitoring steps|langkah pemantauan harian|\u6bcf\u65e5\u76d1\u6d4b\u6b65\u9aa4/.test(userQuestion)) {
                return languageLabel === 'Melayu'
                    ? 'Pemantauan harian: 1) ambil satu gambar setiap hari dalam pencahayaan sama, 2) perhatikan sakit, gatal, atau merebak, 3) elakkan produk baharu yang keras, 4) dapatkan pemeriksaan jika tanda amaran muncul.'
                    : languageLabel === 'Chinese'
                        ? '每日监测步骤：1）每天在相似光线下拍一张照片，2）观察疼痛、瘙痒或扩散，3）避免新增加刺激性产品，4）如出现警示症状请及时就医。'
                        : 'Daily monitoring steps: 1) take one photo each day in similar lighting, 2) watch for pain, itch, or spread, 3) avoid new harsh products, 4) seek review if warning signs appear.';
            }

            if (languageLabel === 'Melayu') {
                return `Saya telah menyemak keputusan terkini anda. Corak yang dikesan: ${detected}. Tahap keyakinan AI: ${confidence}. Tahap urgensi penjagaan: ${urgency}. Laluan triage semasa: ${pathway}. Cadangan utama: ${recommendation} Soalan susulan: adakah kawasan ini semakin teruk dalam 24-48 jam kebelakangan ini?`;
            }
            if (languageLabel === 'Chinese') {
                return `\u6211\u5df2\u67e5\u770b\u60a8\u6700\u65b0\u7684\u7ed3\u679c\u3002\u68c0\u6d4b\u5230\u7684\u76ae\u80a4\u6a21\u5f0f\uff1a${detected}\u3002AI \u7f6e\u4fe1\u5ea6\uff1a${confidence}\u3002\u62a4\u7406\u7d27\u6025\u7a0b\u5ea6\uff1a${urgency}\u3002\u5f53\u524d\u5206\u6d41\u8def\u5f84\uff1a${pathway}\u3002\u4e3b\u8981\u5efa\u8bae\uff1a${recommendation}\u3002\u8ffd\u95ee\uff1a\u8be5\u533a\u57df\u5728\u8fc7\u53bb 24-48 \u5c0f\u65f6\u5185\u662f\u5426\u660e\u663e\u52a0\u91cd\uff1f`;
            }
            return `I've reviewed your latest result. Detected skin pattern: ${detected}. AI confidence: ${confidence}. Care urgency: ${urgency}. Current triage pathway: ${pathway}. Main recommendation: ${recommendation} Follow-up question: has this area clearly worsened in the last 24-48 hours?`;
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
            2. Answer the user's actual question directly before adding extra background.
            3. Explain triage and next steps clearly in non-alarmist language.
            4. Keep responses concise, practical, and medically responsible.
            5. If the user speaks casually, emotionally, or vaguely (for example: "but i'm lazy", "go ahead", "so what should I actually do"), respond naturally and helpfully instead of switching into rigid questionnaire mode.
            6. Prefer concrete actions, short plans, and specific next steps over generic education.
            7. Never claim definitive diagnosis, never prescribe medication, never provide unsafe certainty.
            8. Encourage professional review when urgency is moderate/high, symptoms worsen, or user is worried.
            9. If context is missing, acknowledge limitation and ask the user to return to Results.
            10. End with one focused follow-up question when helpful.

            Latest result context:
            ${JSON.stringify(contextSummary)}

            Safety note to reflect when relevant:
            "This is educational support and does not replace professional medical diagnosis."
        `;

        const formattedMessages = [
            { role: 'system', content: systemInstruction },
            ...messages
                .filter((m) => m && typeof m.text === 'string' && m.text.trim().length > 0)
                .map((m) => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }))
        ];

        if (openAIKeys.length) {
            try {
                const openAIResponse = await callOpenAIChatWithRotation({
                    model: OPENAI_CHAT_MODEL,
                    messages: formattedMessages.map((m) => ({ role: m.role, content: m.content })),
                    temperature: 0.35,
                    maxTokens: 4096
                });
                const reply = String(openAIResponse?.content || '').trim();
                if (reply) {
                    return res.json({
                        status: 'success',
                        reply,
                        source: 'openai',
                        language: languageLabel,
                        source_context_used,
                        error_message: null,
                        debug_reason: null,
                        debug_context_summary: contextSummary
                    });
                }
                debugReason = 'OpenAI returned empty reply';
            } catch (openAIErr) {
                debugReason = `OpenAI failed: ${String(openAIErr?.message || openAIErr || 'Unknown error')}`;
                console.warn('[OpenAI Chat] Failed.', openAIErr?.message || openAIErr);
            }
        }

        return res.json({
            status: 'fallback',
            reply: buildDeterministicFallback(),
            source: 'fallback',
            language: languageLabel,
            source_context_used,
            error_message: debugReason ? 'OpenAI unavailable' : 'No OpenAI API key available',
            debug_reason: debugReason || 'No OPENAI_API_KEYS configured for Copilot',
            debug_context_summary: contextSummary
        });
    } catch (err) {
        console.error('Chat Error:', err);
        const reqLanguage = String(req.body?.language || req.body?.context?.languagePreference || 'English').toLowerCase();
        const languageLabel =
            reqLanguage.includes('malay') || reqLanguage.includes('melayu') ? 'Melayu'
                : reqLanguage.includes('chinese') || reqLanguage.includes('mandarin') ? 'Chinese'
                    : 'English';
        const reqContext = req.body?.context && typeof req.body.context === 'object' ? req.body.context : {};
        const detected = reqContext.detectedConditionLabel || reqContext.condition || 'Not available';
        const confidence = reqContext.confidenceLabel || 'Not available';
        const urgency = reqContext.urgencyLevel || 'Not available';
        const pathway = String(reqContext.triagePathway || 'monitor').replace('_', ' ');
        const recommendation = reqContext.recommendationText || 'Continue gentle skin care, monitor for changes, and seek professional review if symptoms worsen.';

        const fallbackReply =
            languageLabel === 'Melayu'
                ? `Saya telah menyemak keputusan terkini anda. Corak yang dikesan: ${detected}. Keyakinan AI: ${confidence}. Urgensi penjagaan: ${urgency}. Laluan triage: ${pathway}. Cadangan: ${recommendation} Adakah gejala menjadi lebih teruk sejak semalam?`
                : languageLabel === 'Chinese'
                    ? `\u6211\u5df2\u67e5\u770b\u60a8\u6700\u65b0\u7684\u7ed3\u679c\u3002\u68c0\u6d4b\u5230\u7684\u76ae\u80a4\u6a21\u5f0f\uff1a${detected}\u3002AI \u7f6e\u4fe1\u5ea6\uff1a${confidence}\u3002\u62a4\u7406\u7d27\u6025\u7a0b\u5ea6\uff1a${urgency}\u3002\u5206\u6d41\u8def\u5f84\uff1a${pathway}\u3002\u5efa\u8bae\uff1a${recommendation}\u3002\u8ffd\u95ee\uff1a\u4e0e\u6628\u5929\u76f8\u6bd4\u75c7\u72b6\u662f\u5426\u52a0\u91cd\uff1f`
                    : `I've reviewed your latest result. Detected skin pattern: ${detected}. AI confidence: ${confidence}. Care urgency: ${urgency}. Triage pathway: ${pathway}. Recommendation: ${recommendation} Follow-up: have symptoms worsened since yesterday?`;

        res.status(200).json({
            status: 'fallback',
            reply: fallbackReply,
            source: 'fallback',
            language: languageLabel,
            source_context_used: !!req.body?.context,
            error_message: 'Failed to generate chat response',
            debug_reason: `Chat error: ${String(err?.message || err || 'Unknown error')}`,
            debug_context_summary: {
                detected_condition: detected,
                confidence_label: confidence,
                urgency_level: urgency,
                triage_pathway: reqContext.triagePathway || 'Not available',
                recommendation_text: recommendation,
                reasoning_points: Array.isArray(reqContext.reasoningPoints) ? reqContext.reasoningPoints : []
            }
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
            visualPatternSummary: analysis?.visualPatternSummary || null,
            uncertaintyLevel: analysis?.uncertainty_level || null,
            affectedZones: analysis?.affected_zones || [],
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

        const openAIResponse = await callOpenAIChatWithRotation({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            maxTokens: 2048,
            responseFormatJson: true
        });

        const rawJson = openAIResponse?.content || '{"clinics":[]}';
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
            return res.json(formatClinicResponse('empty', [], 'No dermatology clinics found near your location. Try searching in Google Maps directly.'));
        }

        const deduped = dedupeClinics(normalized).sort((a, b) => clinicDistanceValue(a) - clinicDistanceValue(b));
        const reliableNearby = deduped.filter((entry) => hasReliableClinicCoordinates(entry));
        const nearby60 = reliableNearby.filter((entry) => clinicDistanceValue(entry) <= 60);
        const nearby120 = reliableNearby.filter((entry) => clinicDistanceValue(entry) <= 120);

        let selected = [];
        let status = 'success';
        let message = 'Using your current location to show the closest dermatology clinics first.';

        if (nearby60.length >= 3) {
            selected = nearby60.slice(0, 5);
        } else if (nearby120.length >= 3) {
            selected = nearby120.slice(0, 5);
            message = 'Using your current location. Only a limited number of close dermatology matches were found, so slightly wider nearby results are shown.';
        } else if (reliableNearby.length > 0) {
            selected = reliableNearby.slice(0, 5);
            status = 'fallback';
            message = 'Using your current location. Very few nearby dermatology clinics could be verified, so the closest broader-area options are shown.';
        } else {
            return res.json(formatClinicResponse('empty', [], 'No verified nearby dermatology clinics could be confirmed from your current location.'));
        }

        return res.json(formatClinicResponse(status, selected, message));
    } catch (err) {
        console.error("Clinics Error:", err);
        res.status(500).json(formatClinicResponse('error', [], 'Clinic search is temporarily unavailable. Please try again later.'));
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

        const openAIResponse = await callOpenAIChatWithRotation({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: synthesisPrompt }],
            temperature: 0.2,
            maxTokens: 512,
            responseFormatJson: true
        });

        const rawJson = openAIResponse?.content || '{"finalScore": 50, "insight": "Unable to compute."}';
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
        const parsed = [];
        for (const row of allData) {
            try {
                parsed.push({ ...row, data: JSON.parse(row.data) });
            } catch {
                console.warn(`[DB] Skipping row ${row.id} with invalid JSON data`);
            }
        }

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
