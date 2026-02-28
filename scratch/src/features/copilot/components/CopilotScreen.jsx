import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, CheckCircle, AlertTriangle } from 'lucide-react';
import {
    buildTriageQuestions,
    computeFinalAssessment,
    getConditionLabel
} from '../data/triageQuestions';

const DEFAULT_IMAGE_ANALYSIS = {
    model: 'medgemma-1.5-4b-it',
    source: 'fallback',
    top_conditions: [{ name: 'eczema_dermatitis', confidence: 0.5 }],
    image_score: 55
};

export const CopilotScreen = ({ imageAnalysis, onComplete }) => {
    const resolvedImageAnalysis = imageAnalysis || DEFAULT_IMAGE_ANALYSIS;
    const primaryCondition = resolvedImageAnalysis.top_conditions?.[0]?.name || 'eczema_dermatitis';
    const primaryConditionLabel = getConditionLabel(primaryCondition);

    const triageQuestions = useMemo(() => buildTriageQuestions(primaryCondition), [primaryCondition]);

    const [messages, setMessages] = useState([
        {
            sender: 'ai',
            text: `Image pre-screen complete. Top hypothesis: ${primaryConditionLabel}. I will ask targeted triage questions for a safer assessment.`,
            isTyping: false
        }
    ]);
    const [questionIndex, setQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState([]);
    const [isSubmitted, setIsSubmitted] = useState(false);

    useEffect(() => {
        if (questionIndex >= triageQuestions.length && !isSubmitted) {
            const timer = setTimeout(() => {
                const computed = computeFinalAssessment({
                    imageAnalysis: resolvedImageAnalysis,
                    questions: triageQuestions,
                    answers
                });

                onComplete({
                    ...computed,
                    image_analysis: resolvedImageAnalysis,
                    questionnaire: {
                        asked_condition: primaryCondition,
                        answers
                    }
                });
                setIsSubmitted(true);
            }, 1000);
            return () => clearTimeout(timer);
        }
        return undefined;
    }, [
        questionIndex,
        triageQuestions,
        answers,
        onComplete,
        isSubmitted,
        resolvedImageAnalysis,
        primaryCondition
    ]);

    useEffect(() => {
        if (questionIndex < triageQuestions.length && messages[messages.length - 1].sender === 'user') {
            const typingTimer = setTimeout(() => {
                setMessages((prev) => [...prev, { sender: 'ai', text: triageQuestions[questionIndex].q, isTyping: true }]);
                setTimeout(
                    () =>
                        setMessages((prev) => {
                            const updated = [...prev];
                            updated[updated.length - 1].isTyping = false;
                            return updated;
                        }),
                    800
                );
            }, 450);
            return () => clearTimeout(typingTimer);
        }

        return undefined;
    }, [questionIndex, messages, triageQuestions]);

    useEffect(() => {
        if (questionIndex === 0 && messages.length === 1) {
            const timer = setTimeout(() => {
                setMessages((prev) => [...prev, { sender: 'ai', text: triageQuestions[0].q, isTyping: true }]);
                setTimeout(
                    () =>
                        setMessages((prev) => {
                            const updated = [...prev];
                            updated[updated.length - 1].isTyping = false;
                            return updated;
                        }),
                    800
                );
            }, 900);
            return () => clearTimeout(timer);
        }

        return undefined;
    }, [questionIndex, messages.length, triageQuestions]);

    const handleOptionClick = (option) => {
        const currentQuestion = triageQuestions[questionIndex];
        if (!currentQuestion) return;

        setMessages((prev) => [...prev, { sender: 'user', text: option.label, isTyping: false }]);
        setAnswers((prev) => [
            ...prev,
            {
                question_id: currentQuestion.id,
                value: option.value
            }
        ]);
        setQuestionIndex((prev) => prev + 1);
    };

    const progressText = `${Math.min(questionIndex, triageQuestions.length)}/${triageQuestions.length}`;

    return (
        <motion.div layoutId="screen-container" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9 }} className="flex flex-col h-full w-full p-6 relative">
            <header className="flex items-center justify-between gap-3 pb-4 border-b border-white/10 shrink-0">
                <div className="flex items-center space-x-3">
                    <div className="relative">
                        <div className="w-10 h-10 rounded-lg bg-[var(--color-cyber-teal)]/10 border border-[var(--color-cyber-teal)]/30 flex items-center justify-center relative overflow-hidden">
                            <Cpu size={20} className="text-[var(--color-cyber-teal)] z-10" />
                            <div className="absolute inset-0 bg-[var(--color-cyber-teal)]/20 animate-pulse"></div>
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-[var(--color-bio-green)] rounded-full shadow-[0_0_8px_#39ff14]"></div>
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold tracking-wide text-white">Holographic Assistant</h2>
                        <p className="text-[10px] text-gray-400 uppercase tracking-widest">MedGemma-Triage Workflow</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Progress</p>
                    <p className="text-xs text-[var(--color-cyber-teal)] font-mono">{progressText}</p>
                </div>
            </header>

            <div className="mt-3 rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-3 py-2 text-[11px] text-yellow-100 flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>AI triage support only. This is not a medical diagnosis.</span>
            </div>

            <div className="flex-1 overflow-y-auto py-6 space-y-6 scroll-smooth pr-2">
                <AnimatePresence>
                    {messages.map((msg, idx) => (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={idx} className={`flex w-full ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-2xl p-4 text-sm ${msg.sender === 'user' ? 'bg-[var(--color-cyber-teal)]/20 border border-[var(--color-cyber-teal)]/30 text-white rounded-tr-sm' : 'glass-panel text-gray-200 border-l-[3px] border-l-[var(--color-cyber-teal)] rounded-tl-sm relative overflow-hidden'}`}>
                                {msg.sender === 'ai' && <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-[var(--color-cyber-teal)]/50 to-transparent"></div>}
                                {msg.isTyping ? <span className="typing-cursor"></span> : msg.text}
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
                {questionIndex >= triageQuestions.length && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center pt-4">
                        <div className="glass-panel px-4 py-2 border-[var(--color-bio-green)]/30 text-[var(--color-bio-green)] text-xs rounded-full flex items-center shadow-[0_0_10px_rgba(57,255,20,0.2)]"><CheckCircle size={14} className="mr-2" /> Analysis Completed</div>
                    </motion.div>
                )}
            </div>

            <div className="pt-4 border-t border-white/10 shrink-0 min-h-[100px]">
                <AnimatePresence mode="popLayout">
                    {questionIndex < triageQuestions.length && !messages[messages.length - 1].isTyping && messages[messages.length - 1].sender === 'ai' && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="flex flex-wrap gap-2">
                            {triageQuestions[questionIndex].options.map((option, i) => (
                                <button key={i} onClick={() => handleOptionClick(option)} className="px-4 py-3 rounded-xl glass-panel border border-white/20 text-xs text-gray-300 hover:border-[var(--color-cyber-teal)] hover:text-white transition-all flex-1 text-center whitespace-nowrap min-w-[30%] cursor-pointer">{option.label}</button>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
};
