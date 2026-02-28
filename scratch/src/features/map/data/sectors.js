export const sectors = [

        // ──── PENINSULAR MALAYSIA (West) ────

        // PERLIS - tiny state, northernmost
        {
            id: 'perlis',
            name: 'Perlis',
            position: [-4.5, 0.12, -7.8],
            scale: 0.015,
            svgPath: "M10,5 Q20,0 35,8 Q45,18 40,30 Q30,38 15,32 Q5,22 10,5 Z",
            color: '#E8D44D',
            baseColor: '#2A2A0A',
            metrics: { trend: 'Stable', riskLevel: 22, climate: 'Arid North' }
        },
        // KEDAH
        {
            id: 'kedah',
            name: 'Kedah',
            position: [-4, 0.18, -6.5],
            scale: 0.035,
            svgPath: "M5,10 Q20,0 50,5 Q70,15 65,40 Q55,60 40,65 Q15,55 5,35 Q0,20 5,10 Z",
            color: '#FF9F43',
            baseColor: '#2A1A0A',
            metrics: { trend: 'Improving', riskLevel: 30, climate: 'Rice Plains' }
        },
        // PENANG
        {
            id: 'penang',
            name: 'Penang',
            position: [-5.2, 0.15, -5.3],
            scale: 0.018,
            svgPath: "M10,10 Q20,0 30,15 T40,40 Q20,50 0,30 Z",
            color: '#FF6B6B',
            baseColor: '#2A0A18',
            metrics: { trend: 'Spiking', riskLevel: 88, climate: 'Coastal UV' }
        },
        // PERAK
        {
            id: 'perak',
            name: 'Perak',
            position: [-3, 0.2, -4.2],
            scale: 0.045,
            svgPath: "M10,5 Q30,0 55,8 Q70,20 68,45 Q60,70 45,80 Q25,85 10,70 Q0,50 5,25 Q8,10 10,5 Z",
            color: '#54A0FF',
            baseColor: '#0A1A3A',
            metrics: { trend: 'Declining', riskLevel: 42, climate: 'Limestone Basin' }
        },
        // KELANTAN
        {
            id: 'kelantan',
            name: 'Kelantan',
            position: [1, 0.22, -6],
            scale: 0.04,
            svgPath: "M15,5 Q40,0 60,12 Q70,30 55,55 Q40,65 20,60 Q5,45 0,25 Q8,10 15,5 Z",
            color: '#5F27CD',
            baseColor: '#1A0A2A',
            metrics: { trend: 'Elevated', riskLevel: 61, climate: 'Monsoon East' }
        },
        // TERENGGANU
        {
            id: 'terengganu',
            name: 'Terengganu',
            position: [2.5, 0.2, -4],
            scale: 0.04,
            svgPath: "M5,5 Q25,0 40,10 Q55,30 50,55 Q40,75 25,80 Q10,70 0,45 Q-2,20 5,5 Z",
            color: '#01A3A4',
            baseColor: '#0A2222',
            metrics: { trend: 'Optimal', riskLevel: 18, climate: 'Coastal Tropics' }
        },
        // PAHANG - largest state
        {
            id: 'pahang',
            name: 'Pahang',
            position: [0.5, 0.25, -2],
            scale: 0.06,
            svgPath: "M10,10 Q35,0 65,5 Q85,20 80,50 Q70,75 50,85 Q25,80 8,60 Q0,35 10,10 Z",
            color: '#10AC84',
            baseColor: '#0A2A1A',
            metrics: { trend: 'Improving', riskLevel: 28, climate: 'Rainforest Interior' }
        },
        // SELANGOR
        {
            id: 'selangor',
            name: 'Selangor',
            position: [-2, 0.2, -0.8],
            scale: 0.035,
            svgPath: "M0,20 Q20,0 50,5 Q70,20 65,45 Q50,65 25,60 Q5,50 0,20 Z",
            color: '#EE5A24',
            baseColor: '#2A150A',
            metrics: { trend: 'Stable', riskLevel: 35, climate: 'Urban Heat Island' }
        },
        // KL (Federal Territory)
        {
            id: 'kl',
            name: 'Kuala Lumpur',
            position: [-1.2, 0.3, -0.5],
            scale: 0.012,
            svgPath: "M10,5 Q20,0 30,5 Q35,15 30,25 Q20,30 10,25 Q5,15 10,5 Z",
            color: '#00d2ff',
            baseColor: '#0A2A3A',
            metrics: { trend: 'Monitored', riskLevel: 45, climate: 'High-Density Urban' }
        },
        // PUTRAJAYA (Federal Territory)
        {
            id: 'putrajaya',
            name: 'Putrajaya',
            position: [-1.3, 0.28, 0.2],
            scale: 0.008,
            svgPath: "M8,3 Q16,0 22,6 Q25,14 20,20 Q12,24 6,18 Q2,10 8,3 Z",
            color: '#C44569',
            baseColor: '#2A0A1A',
            metrics: { trend: 'Optimal', riskLevel: 12, climate: 'Planned City' }
        },
        // NEGERI SEMBILAN
        {
            id: 'nsembilan',
            name: 'N. Sembilan',
            position: [-1, 0.18, 1],
            scale: 0.03,
            svgPath: "M5,8 Q25,0 45,10 Q55,30 45,50 Q30,55 10,45 Q0,25 5,8 Z",
            color: '#F8B739',
            baseColor: '#2A2A0A',
            metrics: { trend: 'Declining', riskLevel: 38, climate: 'Highland Fringe' }
        },
        // MELAKA
        {
            id: 'melaka',
            name: 'Melaka',
            position: [-0.5, 0.14, 2.2],
            scale: 0.018,
            svgPath: "M5,5 Q20,0 35,8 Q42,22 35,35 Q20,40 5,30 Q0,15 5,5 Z",
            color: '#FC427B',
            baseColor: '#2A0A20',
            metrics: { trend: 'Stable', riskLevel: 25, climate: 'Straits Coastal' }
        },
        // JOHOR
        {
            id: 'johor',
            name: 'Johor',
            position: [1, 0.2, 3.5],
            scale: 0.055,
            svgPath: "M0,60 Q30,40 60,70 T120,50 T160,80 Q100,120 50,100 Z",
            color: '#00d2ff',
            baseColor: '#0A1A2F',
            metrics: { trend: 'Declining (Humidity)', riskLevel: 72, climate: 'High Moisture' }
        },

        // ──── EAST MALAYSIA (Borneo) ────

        // SARAWAK - largest state by area
        {
            id: 'sarawak',
            name: 'Sarawak',
            position: [12, 0.2, -1],
            scale: 0.09,
            svgPath: "M0,50 Q50,20 100,30 T200,60 Q250,100 200,150 T50,100 Z",
            color: '#39ff14',
            baseColor: '#0A2A2A',
            metrics: { trend: 'Optimal', riskLevel: 15, climate: 'Tropical Canopy' }
        },
        // SABAH
        {
            id: 'sabah',
            name: 'Sabah',
            position: [24, 0.3, -5],
            scale: 0.07,
            svgPath: "M0,40 Q60,0 120,50 T150,100 Q100,140 50,100 Z",
            color: '#A3CB38',
            baseColor: '#1A2A0A',
            metrics: { trend: 'Elevated (Monsoon)', riskLevel: 55, climate: 'Monsoon Rains' }
        },
        // LABUAN (Federal Territory, island off Sabah)
        {
            id: 'labuan',
            name: 'Labuan',
            position: [19, 0.15, -3.5],
            scale: 0.01,
            svgPath: "M8,4 Q18,0 25,8 Q28,18 22,25 Q12,28 5,20 Q2,10 8,4 Z",
            color: '#786FA6',
            baseColor: '#1A1A2A',
            metrics: { trend: 'Stable', riskLevel: 20, climate: 'Island Offshore' }
        }
    
];
