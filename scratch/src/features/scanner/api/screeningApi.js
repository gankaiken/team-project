const normalizeTopConditions = (conditions = []) => {
    return conditions.slice(0, 3).map((entry, index) => ({
        name: entry.name || `condition_${index + 1}`,
        confidence: typeof entry.confidence === 'number' ? entry.confidence : 0
    }));
};

const clampScore = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(100, Math.round(numeric)));
};

const mockAnalyzeScreeningImage = async (imageFile) => {
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const seed = (imageFile?.size || 0) % 5;
    const presets = [
        {
            top_conditions: [
                { name: 'eczema_dermatitis', confidence: 0.64 },
                { name: 'fungal_infection_tinea', confidence: 0.2 },
                { name: 'psoriasis', confidence: 0.1 }
            ],
            image_score: 62
        },
        {
            top_conditions: [
                { name: 'fungal_infection_tinea', confidence: 0.58 },
                { name: 'eczema_dermatitis', confidence: 0.21 },
                { name: 'bacterial_infection', confidence: 0.12 }
            ],
            image_score: 67
        },
        {
            top_conditions: [
                { name: 'psoriasis', confidence: 0.56 },
                { name: 'eczema_dermatitis', confidence: 0.24 },
                { name: 'acne_folliculitis', confidence: 0.1 }
            ],
            image_score: 54
        },
        {
            top_conditions: [
                { name: 'acne_folliculitis', confidence: 0.63 },
                { name: 'bacterial_infection', confidence: 0.16 },
                { name: 'eczema_dermatitis', confidence: 0.11 }
            ],
            image_score: 48
        },
        {
            top_conditions: [
                { name: 'bacterial_infection', confidence: 0.52 },
                { name: 'eczema_dermatitis', confidence: 0.22 },
                { name: 'fungal_infection_tinea', confidence: 0.15 }
            ],
            image_score: 71
        }
    ];

    const chosen = presets[seed];

    return {
        model: 'medgemma-1.5-4b-it',
        source: 'mock',
        top_conditions: chosen.top_conditions,
        image_score: chosen.image_score
    };
};

const normalizeApiResponse = (payload) => ({
    model: payload?.model || 'medgemma-1.5-4b-it',
    source: payload?.source || 'api',
    top_conditions: normalizeTopConditions(payload?.top_conditions),
    image_score: clampScore(payload?.image_score)
});

export const analyzeScreeningImage = async (imageFile) => {
    const formData = new FormData();
    formData.append('image', imageFile);
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
    const allowMockFallback = import.meta.env.VITE_ENABLE_SCREENING_MOCK === 'true';

    try {
        const response = await fetch(`${apiBaseUrl}/api/screening/analyze`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Analysis request failed with status ${response.status}`);
        }

        const payload = await response.json();
        return normalizeApiResponse(payload);
    } catch (error) {
        if (allowMockFallback) {
            return mockAnalyzeScreeningImage(imageFile);
        }
        throw error;
    }
};
