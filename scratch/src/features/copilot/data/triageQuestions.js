const yesNo = [
    { label: 'Yes', value: true },
    { label: 'No', value: false }
];

export const CONDITION_LABELS = {
    eczema_dermatitis: 'Eczema / Dermatitis',
    fungal_infection_tinea: 'Fungal Infection (Tinea)',
    bacterial_infection: 'Bacterial Infection',
    psoriasis: 'Psoriasis',
    acne_folliculitis: 'Acne / Folliculitis'
};

export const URGENT_RED_FLAG_QUESTIONS = [
    {
        id: 'eye_or_genital_involvement',
        q: 'Is the rash near the eyes or genital area?',
        options: yesNo,
        riskWeights: { true: 100, false: 0 },
        isRedFlag: true
    },
    {
        id: 'facial_swelling_or_breathing_issue',
        q: 'Any facial swelling, breathing issue, or severe allergic reaction?',
        options: yesNo,
        riskWeights: { true: 100, false: 0 },
        isRedFlag: true
    },
    {
        id: 'immunocompromised_or_diabetes',
        q: 'Do you have diabetes or a weakened immune system?',
        options: yesNo,
        riskWeights: { true: 70, false: 0 },
        isRedFlag: true
    },
    {
        id: 'high_risk_population',
        q: 'Is this patient a child, pregnant, or elderly with severe symptoms?',
        options: yesNo,
        riskWeights: { true: 75, false: 0 },
        isRedFlag: true
    }
];

export const CONDITION_QUESTION_BANK = {
    eczema_dermatitis: [
        {
            id: 'itch_severity',
            q: 'How severe is the itch right now?',
            options: [
                { label: 'Severe (8-10)', value: 'severe' },
                { label: 'Moderate (4-7)', value: 'moderate' },
                { label: 'Mild (0-3)', value: 'mild' }
            ],
            riskWeights: { severe: 90, moderate: 60, mild: 20 }
        },
        {
            id: 'dry_scaly_skin',
            q: 'Do you notice dry or scaly skin in the same area?',
            options: yesNo,
            riskWeights: { true: 75, false: 20 }
        },
        {
            id: 'chemical_or_product_trigger',
            q: 'Did this start after soap, detergent, cosmetic, or chemical exposure?',
            options: yesNo,
            riskWeights: { true: 70, false: 30 }
        },
        {
            id: 'atopy_history',
            q: 'Any personal or family history of eczema, asthma, or allergies?',
            options: yesNo,
            riskWeights: { true: 65, false: 25 }
        }
    ],
    fungal_infection_tinea: [
        {
            id: 'ring_shape_border',
            q: 'Does it look ring-shaped with a clearer center?',
            options: yesNo,
            riskWeights: { true: 85, false: 25 }
        },
        {
            id: 'worse_with_sweat',
            q: 'Does it worsen with humidity, sweat, or after workouts?',
            options: yesNo,
            riskWeights: { true: 75, false: 30 }
        },
        {
            id: 'spreading_outward',
            q: 'Has it been spreading outward over the last few days?',
            options: yesNo,
            riskWeights: { true: 80, false: 25 }
        },
        {
            id: 'contact_exposure',
            q: 'Any close contact with someone having a similar rash?',
            options: yesNo,
            riskWeights: { true: 60, false: 20 }
        }
    ],
    bacterial_infection: [
        {
            id: 'pain_level',
            q: 'How painful or tender is it?',
            options: [
                { label: 'Severe pain', value: 'severe' },
                { label: 'Moderate pain', value: 'moderate' },
                { label: 'Minimal pain', value: 'mild' }
            ],
            riskWeights: { severe: 95, moderate: 70, mild: 25 }
        },
        {
            id: 'warmth_swelling_pus',
            q: 'Is there warmth, swelling, or pus?',
            options: yesNo,
            riskWeights: { true: 95, false: 20 }
        },
        {
            id: 'fever_chills',
            q: 'Any fever or chills?',
            options: yesNo,
            riskWeights: { true: 100, false: 10 },
            isRedFlag: true
        },
        {
            id: 'rapid_worsening',
            q: 'Did it rapidly worsen in 24-48 hours?',
            options: yesNo,
            riskWeights: { true: 85, false: 20 }
        }
    ],
    psoriasis: [
        {
            id: 'silvery_scale',
            q: 'Are thick silvery scales present?',
            options: yesNo,
            riskWeights: { true: 80, false: 30 }
        },
        {
            id: 'typical_sites',
            q: 'Is it on elbows, knees, or scalp?',
            options: yesNo,
            riskWeights: { true: 75, false: 25 }
        },
        {
            id: 'joint_stiffness',
            q: 'Any joint pain or morning stiffness?',
            options: yesNo,
            riskWeights: { true: 80, false: 20 }
        },
        {
            id: 'family_history_psoriasis',
            q: 'Family history of psoriasis?',
            options: yesNo,
            riskWeights: { true: 60, false: 20 }
        }
    ],
    acne_folliculitis: [
        {
            id: 'pus_bumps',
            q: 'Are there pus-filled bumps?',
            options: yesNo,
            riskWeights: { true: 70, false: 20 }
        },
        {
            id: 'friction_shaving_trigger',
            q: 'Any trigger from shaving, friction, or sweating?',
            options: yesNo,
            riskWeights: { true: 75, false: 30 }
        },
        {
            id: 'painful_nodules',
            q: 'Any painful deep nodules/cysts?',
            options: yesNo,
            riskWeights: { true: 85, false: 20 }
        },
        {
            id: 'trunk_involvement',
            q: 'Is chest or back significantly involved?',
            options: yesNo,
            riskWeights: { true: 60, false: 20 }
        }
    ]
};

export const getConditionLabel = (conditionId) => CONDITION_LABELS[conditionId] || 'General Skin Condition';

export const buildTriageQuestions = (conditionId) => {
    const conditionQuestions = CONDITION_QUESTION_BANK[conditionId] || CONDITION_QUESTION_BANK.eczema_dermatitis;
    return [...URGENT_RED_FLAG_QUESTIONS, ...conditionQuestions];
};

export const computeQuestionnaireScore = (questions, answers) => {
    if (!questions.length) return 0;

    const questionMap = questions.reduce((acc, question) => {
        acc[question.id] = question;
        return acc;
    }, {});

    const scores = answers
        .map((answer) => {
            const question = questionMap[answer.question_id];
            if (!question) return null;
            const weight = question.riskWeights?.[String(answer.value)];
            return typeof weight === 'number' ? weight : null;
        })
        .filter((value) => value !== null);

    if (!scores.length) return 0;

    const total = scores.reduce((sum, value) => sum + value, 0);
    return Math.round(total / scores.length);
};

export const hasRedFlags = (questions, answers) => {
    const redFlagIds = new Set(questions.filter((question) => question.isRedFlag).map((question) => question.id));
    return answers.some((answer) => redFlagIds.has(answer.question_id) && answer.value === true);
};

const scoreToBand = (score) => {
    if (score >= 65) return 'high';
    if (score >= 35) return 'moderate';
    return 'low';
};

export const computeFinalAssessment = ({ imageAnalysis, questions, answers }) => {
    const imageScore = Math.round(imageAnalysis?.image_score || 0);
    const questionnaireScore = computeQuestionnaireScore(questions, answers);
    const redFlagsTriggered = hasRedFlags(questions, answers);
    const topConfidence = imageAnalysis?.top_conditions?.[0]?.confidence || 0;

    const imageWeight = topConfidence >= 0.55 ? 0.6 : 0.4;
    const questionnaireWeight = 1 - imageWeight;

    let finalScore = Math.round((imageScore * imageWeight) + (questionnaireScore * questionnaireWeight));
    let requiresClinicianReview = false;

    if (redFlagsTriggered) {
        finalScore = Math.max(finalScore, 85);
        requiresClinicianReview = true;
    } else if (finalScore >= 70 || topConfidence < 0.35) {
        requiresClinicianReview = true;
    }

    return {
        image_score: imageScore,
        questionnaire_score: questionnaireScore,
        final_score: finalScore,
        band: scoreToBand(finalScore),
        red_flags_triggered: redFlagsTriggered,
        requires_clinician_review: requiresClinicianReview,
        top_conditions: imageAnalysis?.top_conditions || [],
        model: imageAnalysis?.model || 'unknown',
        source: imageAnalysis?.source || 'unknown',
        disclaimer: 'AI triage only. This is not a medical diagnosis.'
    };
};
