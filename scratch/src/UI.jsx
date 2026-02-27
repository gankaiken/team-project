import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Zap, User, Clock, ChevronRight, FileText, LogOut, Focus, Map, Cpu, CheckCircle, X, AlertCircle } from 'lucide-react';
import { useUser } from './State';

// ==========================================
// 1. BREADCRUMBS NAVIGATION
// ==========================================
const steps = [
    { id: 'dashboard', label: 'HUB', icon: Zap },
    { id: 'scanning', label: 'SCAN', icon: Focus },
    { id: 'copilot', label: 'ANALYZE', icon: Cpu },
    { id: 'results', label: 'REPORT', icon: CheckCircle },
    { id: 'map', label: 'MAP', icon: Map }
];

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
export const Sidebar = ({ currentScreen, onNavigate }) => {
    const { user, logout } = useUser();
    const [isReportOpen, setIsReportOpen] = useState(false);

    if (!user) return null;

    return (
        <motion.div initial={{ x: -300 }} animate={{ x: 0 }} className="w-64 h-full bg-[var(--color-background)]/80 backdrop-blur-xl border-r border-white/10 flex flex-col p-6 absolute z-50 md:relative">
            <div className="flex items-center space-x-3 mb-12">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--color-cyber-teal)] to-blue-600 flex items-center justify-center shadow-[var(--shadow-neon-teal)]">
                    <ShieldAlert size={20} className="text-white" />
                </div>
                <div>
                    <h1 className="font-bold tracking-widest text-white text-md">DermaVanta</h1>
                    <span className="text-[10px] text-[var(--color-cyber-teal)] uppercase tracking-widest">System Online</span>
                </div>
            </div>

            <div className="glass-panel p-4 rounded-2xl mb-8 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-cyber-teal)]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="flex items-center space-x-3 mb-3">
                    <div className="w-12 h-12 rounded-full border-2 border-[var(--color-cyber-teal)]/30 flex items-center justify-center p-1 relative">
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-[var(--color-bio-green)] rounded-full border border-black shadow-[0_0_8px_#39ff14]"></div>
                        <div className="w-full h-full bg-gray-800 rounded-full flex items-center justify-center overflow-hidden">
                            <User size={20} className="text-gray-400" />
                        </div>
                    </div>
                    <div>
                        <div className="flex items-center space-x-2">
                            <h2 className="text-sm font-bold text-white tracking-wide">{user.name}</h2>
                            <span className="text-[9px] px-1.5 py-0.5 rounded backdrop-blur-sm border border-[var(--color-cyber-teal)]/30 text-[var(--color-cyber-teal)] uppercase">{user.gender}</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{user.university} Node</p>
                    </div>
                </div>
                <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                    <span className="text-gray-500 flex items-center"><Clock size={12} className="mr-1" /> Last Scan</span>
                    <span className="text-white font-medium">{user.lastScanDate}</span>
                </div>
            </div>

            <div className="flex flex-col space-y-2 flex-1">
                <h3 className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 pl-2">Navigation</h3>
                <button onClick={() => onNavigate('dashboard')} className={`flex items-center justify-between p-3 rounded-xl transition-all ${currentScreen === 'dashboard' ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}>
                    <div className="flex items-center space-x-3">
                        <Zap size={16} className={currentScreen === 'dashboard' ? 'text-[var(--color-cyber-teal)]' : ''} />
                        <span className="text-sm font-medium">Operations Center</span>
                    </div>
                    {currentScreen === 'dashboard' && <ChevronRight size={14} className="text-[var(--color-cyber-teal)]" />}
                </button>
                <button onClick={() => setIsReportOpen(true)} className="flex items-center justify-between p-3 rounded-xl transition-all text-gray-400 hover:bg-white/5 hover:text-[var(--color-cyber-teal)] group">
                    <div className="flex items-center space-x-3">
                        <FileText size={16} className="group-hover:text-[var(--color-cyber-teal)] transition-colors" />
                        <span className="text-sm font-medium">Legacy Health Report</span>
                    </div>
                </button>
            </div>

            <div className="mt-auto pt-4 border-t border-white/10 flex justify-between items-center">
                <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-[var(--color-bio-green)] animate-pulse"></div>
                    <span className="text-[10px] text-gray-400 uppercase tracking-widest">Network Secure</span>
                </div>
                <button onClick={logout} className="p-2 rounded-full hover:bg-white/10 text-gray-500 hover:text-[var(--color-danger)] transition-colors" title="Disconnect"><LogOut size={16} /></button>
            </div>

            <LegacyReportModal isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} />
        </motion.div>
    );
};
