import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, Fingerprint, Scan, ShieldCheck } from 'lucide-react';
import { useUser } from '../../../shared/context/UserContext';
export const RegistrationScreen = ({ onComplete }) => {
    const { login } = useUser();
    const [name, setName] = useState('');
    const [ic, setIc] = useState('');
    const [status, setStatus] = useState('idle');

    const handleRegister = (e) => {
        e.preventDefault();
        if (name.length > 2 && ic.length === 12) setStatus('verifying');
    };

    useEffect(() => {
        if (status === 'verifying') {
            const timer = setTimeout(() => setStatus('success'), 3500);
            return () => clearTimeout(timer);
        } else if (status === 'success') {
            const timer = setTimeout(() => { login(name, ic); onComplete(); }, 1000);
            return () => clearTimeout(timer);
        }
    }, [status, name, ic, onComplete, login]);

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col h-full w-full items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-[var(--color-cyber-teal)]/5 rounded-full blur-[100px] pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-[var(--color-bio-green)]/5 rounded-full blur-[100px] pointer-events-none"></div>
            <AnimatePresence mode="wait">
                {status === 'idle' && (
                    <motion.div key="form" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ y: -50, opacity: 0 }} className="w-full max-w-sm glass-panel p-8 rounded-2xl relative z-10">
                        <div className="flex flex-col items-center mb-8">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--color-cyber-teal)] to-blue-600 flex items-center justify-center shadow-[var(--shadow-neon-teal)] mb-4"><Database size={32} className="text-white" /></div>
                            <h2 className="text-2xl font-light tracking-wide text-white">National Health ID</h2>
                            <p className="text-xs text-[var(--color-cyber-teal)] uppercase tracking-widest mt-1">Gateway Authentication</p>
                        </div>
                        <form onSubmit={handleRegister} className="space-y-6">
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase tracking-wider text-gray-400">Citizen Full Name</label>
                                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. MORANT" className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white placeholder-gray-600 focus:outline-none focus:border-[var(--color-cyber-teal)] transition-colors" required />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase tracking-wider text-gray-400">12-Digit IC Number</label>
                                <div className="relative">
                                    <input type="text" value={ic} onChange={(e) => setIc(e.target.value.replace(/[^0-9]/g, ''))} maxLength="12" placeholder="000000000000" className="w-full bg-black/40 border border-white/10 rounded-lg p-3 pl-10 text-white placeholder-gray-600 font-mono tracking-wider focus:outline-none focus:border-[var(--color-cyber-teal)] transition-colors" required />
                                    <Fingerprint size={16} className="absolute left-3 top-3.5 text-gray-500" />
                                </div>
                            </div>
                            <motion.button whileHover={{ scale: 1.02, boxShadow: "0 0 15px rgba(0, 210, 255, 0.3)" }} whileTap={{ scale: 0.98 }} type="submit" disabled={ic.length !== 12 || name.length < 2} className="w-full py-4 rounded-xl bg-gradient-to-r from-[var(--color-cyber-teal)]/80 to-blue-600/80 text-white font-medium tracking-wide disabled:opacity-50 disabled:cursor-not-allowed border border-white/10">Authenticate Identity</motion.button>
                        </form>
                    </motion.div>
                )}
                {(status === 'verifying' || status === 'success') && (
                    <motion.div key="verifying" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center justify-center relative z-10">
                        <div className="relative w-48 h-48 border border-white/10 rounded-full flex items-center justify-center overflow-hidden mb-8">
                            {status === 'verifying' && <motion.div initial={{ top: "-10%" }} animate={{ top: "110%" }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }} className="absolute left-0 right-0 h-1 bg-[var(--color-cyber-teal)] shadow-[0_0_15px_#00d2ff] z-20" />}
                            {status === 'verifying' ? <Scan size={64} className="text-[var(--color-cyber-teal)]/50 absolute" /> : <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}><ShieldCheck size={64} className="text-[var(--color-bio-green)]" /></motion.div>}
                            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 20, ease: "linear" }} className="absolute inset-2 border-2 border-dashed border-[var(--color-cyber-teal)]/30 rounded-full" />
                            <motion.div animate={{ rotate: -360 }} transition={{ repeat: Infinity, duration: 30, ease: "linear" }} className="absolute inset-6 border border-[var(--color-bio-green)]/20 rounded-full" />
                        </div>
                        <h3 className="text-xl font-light tracking-widest text-white mb-2">{status === 'verifying' ? 'Connecting to Database...' : 'Identity Confirmed'}</h3>
                        <div className="h-6">
                            {status === 'verifying' ? (
                                <div className="flex space-x-1">
                                    <motion.div animate={{ height: [5, 15, 5] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1 bg-[var(--color-cyber-teal)]"></motion.div>
                                    <motion.div animate={{ height: [10, 20, 10] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1 bg-[var(--color-cyber-teal)]"></motion.div>
                                    <motion.div animate={{ height: [5, 15, 5] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1 bg-[var(--color-cyber-teal)]"></motion.div>
                                </div>
                            ) : (<motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-[var(--color-bio-green)] font-mono">Syncing Legacy Profile: {ic}</motion.span>)}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

// ==========================================
// 2. DASHBOARD SCREEN
// ==========================================

