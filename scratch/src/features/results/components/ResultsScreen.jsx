import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Map, PhoneCall, ShieldAlert, Zap } from 'lucide-react';
import { useUser } from '../../../shared/context/UserContext';
import { getConditionLabel } from '../../copilot/data/triageQuestions';

const getBandStyles = (band) => {
    if (band === 'high') {
        return {
            label: 'High Concern',
            strokeStart: '#f97316',
            strokeEnd: '#ef4444',
            textClass: 'text-red-300'
        };
    }

    if (band === 'moderate') {
        return {
            label: 'Moderate Concern',
            strokeStart: '#facc15',
            strokeEnd: '#f97316',
            textClass: 'text-yellow-300'
        };
    }

    return {
        label: 'Low Concern',
        strokeStart: '#22c55e',
        strokeEnd: '#14b8a6',
        textClass: 'text-emerald-300'
    };
};

export const ResultsScreen = ({ assessment, onShowMap }) => {
    const { addScanResult } = useUser();

    useEffect(() => {
        if (assessment) {
            addScanResult(assessment);
        }
    }, [assessment, addScanResult]);

    if (!assessment) {
        return (
            <div className="flex items-center justify-center h-full w-full p-6">
                <div className="glass-panel rounded-xl p-5 border border-white/10 text-sm text-gray-300">
                    No assessment available yet. Please run a scan first.
                </div>
            </div>
        );
    }

    const finalScore = Math.round(assessment.final_score || 0);
    const imageScore = Math.round(assessment.image_score || 0);
    const questionnaireScore = Math.round(assessment.questionnaire_score || 0);

    const styles = getBandStyles(assessment.band);
    const circleCircumference = 2 * Math.PI * 54;
    const strokeDashoffset = circleCircumference - (finalScore / 100) * circleCircumference;

    return (
        <motion.div layoutId="screen-container" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, x: -50 }} transition={{ duration: 0.6, type: 'spring' }} className="flex flex-col h-full w-full p-8 items-center relative overflow-hidden">
            <header className="w-full text-center mb-6 relative">
                <h2 className="text-xl font-light tracking-[0.3em] uppercase text-gray-400">Triage Assessment</h2>
                <div className="absolute bottom--2 left-1/2 transform -translate-x-1/2 w-12 h-[1px] bg-[var(--color-cyber-teal)]"></div>
            </header>

            <div className="relative flex justify-center items-center mb-6">
                <div className="absolute w-40 h-40 bg-[rgba(255,165,0,0.15)] rounded-full blur-[30px]"></div>
                <svg className="w-48 h-48 transform -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                    <circle className="circular-progress" cx="60" cy="60" r="54" fill="none" stroke="url(#gradient)" strokeWidth="6" strokeLinecap="round" strokeDasharray={circleCircumference} strokeDashoffset={strokeDashoffset} />
                    <defs>
                        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor={styles.strokeStart} />
                            <stop offset="100%" stopColor={styles.strokeEnd} />
                        </linearGradient>
                    </defs>
                </svg>
                <div className="absolute flex flex-col items-center">
                    <span className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-yellow-300 to-red-400">{finalScore}</span>
                    <span className={`text-[10px] uppercase tracking-widest mt-1 ${styles.textClass}`}>{styles.label}</span>
                </div>
            </div>

            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                <div className="glass-panel p-4 rounded-xl border border-white/10">
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Image Score</p>
                    <p className="text-xl font-semibold text-white">{imageScore}</p>
                </div>
                <div className="glass-panel p-4 rounded-xl border border-white/10">
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Questionnaire Score</p>
                    <p className="text-xl font-semibold text-white">{questionnaireScore}</p>
                </div>
            </div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="w-full glass-panel p-5 rounded-xl border-l-[4px] border-l-yellow-500 mb-4">
                <h3 className="text-sm font-semibold text-gray-200 mb-3 flex items-center"><Zap size={16} className="text-yellow-500 mr-2" /> Top Possible Conditions</h3>
                <div className="space-y-2 text-sm text-gray-300">
                    {(assessment.top_conditions || []).slice(0, 3).map((condition, index) => (
                        <div key={`${condition.name}-${index}`} className="flex justify-between items-center">
                            <span>{getConditionLabel(condition.name)}</span>
                            <span className="font-mono text-[var(--color-cyber-teal)]">{Math.round((condition.confidence || 0) * 100)}%</span>
                        </div>
                    ))}
                </div>
            </motion.div>

            {(assessment.red_flags_triggered || assessment.requires_clinician_review) && (
                <div className="w-full rounded-xl border border-red-500/40 bg-red-500/10 p-4 mb-4 text-red-100 text-sm flex gap-2">
                    <ShieldAlert size={16} className="mt-0.5 shrink-0" />
                    <div>
                        <p className="font-semibold mb-1">Clinician Review Recommended</p>
                        <p className="text-red-200/90">One or more risk signals require direct professional review.</p>
                    </div>
                </div>
            )}

            <div className="w-full rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-[11px] text-yellow-100 mb-5 flex gap-2">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>{assessment.disclaimer || 'AI triage only. This is not a medical diagnosis.'}</span>
            </div>

            <div className="w-full flex flex-col space-y-3 mt-auto relative z-10">
                <motion.button whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(0, 210, 255, 0.4)' }} whileTap={{ scale: 0.98 }} className="w-full py-4 rounded-xl bg-gradient-to-r from-[var(--color-cyber-teal)]/80 to-blue-600/80 text-white font-medium tracking-wide border border-white/10 flex items-center justify-center shadow-lg relative overflow-hidden group cursor-pointer">
                    <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                    <PhoneCall size={18} className="mr-3" /> Consult Specialist Now
                </motion.button>
                <motion.button onClick={onShowMap} whileHover={{ scale: 1.02, backgroundColor: 'rgba(255, 255, 255, 0.1)' }} whileTap={{ scale: 0.98 }} className="w-full py-3 rounded-xl glass-panel text-gray-300 text-sm flex items-center justify-center hover:text-white transition-colors cursor-pointer">
                    <Map size={16} className="mr-2 text-[var(--color-bio-green)]" /> Open 3D Map Sandbox
                </motion.button>
            </div>
        </motion.div>
    );
};
