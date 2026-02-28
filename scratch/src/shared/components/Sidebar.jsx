import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, Zap, User, Clock, ChevronRight, FileText, LogOut } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { LegacyReportModal } from './LegacyReportModal';
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

