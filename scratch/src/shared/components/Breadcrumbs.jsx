import React from 'react';
import { motion } from 'framer-motion';
import { steps } from '../constants/navigationSteps';
export const Breadcrumbs = ({ currentScreen }) => {
    const currentIndex = steps.findIndex(s => s.id === currentScreen);
    return (
        <div className="absolute top-6 right-6 z-50 md:flex hidden">
            <div className="glass-panel px-4 py-2 rounded-full flex items-center space-x-4 border border-[var(--color-cyber-teal)]/20 shadow-lg backdrop-blur-md">
                {steps.map((step, index) => {
                    const isActive = index === currentIndex;
                    const isPassed = index < currentIndex;
                    const Icon = step.icon;
                    return (
                        <React.Fragment key={step.id}>
                            <motion.div
                                className={`flex flex-col items-center relative ${isActive ? 'text-[var(--color-cyber-teal)]' : isPassed ? 'text-[var(--color-bio-green)]' : 'text-gray-600'}`}
                                animate={{ scale: isActive ? 1.1 : 1 }}
                            >
                                <Icon size={14} className="mb-1" />
                                <span className="text-[8px] font-bold tracking-widest uppercase">{step.label}</span>
                                {isActive && (
                                    <motion.div layoutId="activeIndicator" className="absolute -bottom-2 w-1 h-1 rounded-full bg-[var(--color-cyber-teal)] shadow-[var(--shadow-neon-teal)]" />
                                )}
                            </motion.div>
                            {index < steps.length - 1 && <div className={`w-6 h-[1px] ${isPassed ? 'bg-[var(--color-bio-green)]/50' : 'bg-gray-800'}`}></div>}
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
};

// ==========================================
// 2. LEGACY REPORT MODAL
// ==========================================

