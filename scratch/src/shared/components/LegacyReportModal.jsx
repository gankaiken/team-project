import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, X, AlertCircle } from 'lucide-react';
import { useUser } from '../context/UserContext';
export const LegacyReportModal = ({ isOpen, onClose }) => {
    const { user } = useUser();
    if (!user || (!user.legacyData && isOpen)) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                    <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="w-full max-w-md glass-panel border border-[var(--color-cyber-teal)]/30 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(0,210,255,0.15)] flex flex-col">
                        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-[var(--color-cyber-teal)]/10">
                            <div className="flex items-center space-x-2">
                                <FileText size={18} className="text-[var(--color-cyber-teal)]" />
                                <h3 className="font-semibold text-white tracking-wide">Legacy Health Report</h3>
                            </div>
                            <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 transition-colors"><X size={16} className="text-gray-400" /></button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-[10px] text-gray-400 uppercase tracking-widest">Citizen File</p>
                                    <h4 className="text-lg font-bold text-white">{user.name}</h4>
                                    <p className="text-sm font-mono text-[var(--color-cyber-teal)]">{user.ic}</p>
                                </div>
                                <div className="w-12 h-12 rounded-full border border-[var(--color-bio-green)]/50 flex items-center justify-center p-1 relative">
                                    <div className="w-full h-full bg-[var(--color-bio-green)]/20 rounded-full animate-pulse"></div>
                                    <AlertCircle size={16} className="text-[var(--color-bio-green)] absolute" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Last Treated</p>
                                    <p className="text-sm text-gray-200 font-medium">{user.legacyData.lastTreated}</p>
                                </div>
                                <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Historical Scans</p>
                                    <p className="text-sm text-gray-200 font-medium">{user.legacyData.totalScans} Entries</p>
                                </div>
                                <div className="col-span-2 p-3 rounded-xl bg-black/40 border border-white/5">
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Known Allergies</p>
                                    <p className="text-sm text-yellow-500 font-medium">{user.legacyData.knownAllergies}</p>
                                </div>
                                <div className="col-span-2 p-3 rounded-xl bg-gradient-to-r from-[var(--color-cyber-teal)]/10 to-transparent border-l-2 border-[var(--color-cyber-teal)]">
                                    <p className="text-[10px] text-[var(--color-cyber-teal)] uppercase tracking-wider mb-1">Baseline Risk Factor</p>
                                    <p className="text-sm text-white font-medium">{user.legacyData.riskFactor}</p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

// ==========================================
// 3. PERSISTENT SIDEBAR
// ==========================================

