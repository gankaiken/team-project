import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScanLine, Activity, TrendingDown, BarChart2, Fingerprint, ShieldCheck, Database, Scan, Focus, AlertTriangle, Cpu, CheckCircle, Zap, Info, PhoneCall, Map } from 'lucide-react';
import { useUser, useCamera } from './State';

// ==========================================
// 1. REGISTRATION SCREEN
// ==========================================
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
export const DashboardScreen = ({ onScanClick }) => {
    const { user } = useUser();
    if (!user) return null;

    const generatePath = (data) => {
        if (!data || data.length === 0) return '';
        const width = 300, height = 80, padding = 10;
        const points = data.map((val, i) => ({ x: padding + (i * ((width - padding * 2) / (data.length - 1 || 1))), y: height - padding - ((val / 100) * (height - padding * 2)) }));
        let path = `M ${points[0].x},${points[0].y}`;
        for (let i = 0; i < points.length - 1; i++) {
            const x_mid = (points[i].x + points[i + 1].x) / 2, y_mid = (points[i].y + points[i + 1].y) / 2;
            path += ` Q ${(x_mid + points[i].x) / 2},${points[i].y} ${x_mid},${y_mid} T ${points[i + 1].x},${points[i + 1].y}`;
        }
        return path;
    };

    const displayData = user.riskHistory.length > 1 ? user.riskHistory : [85, 80, 78, 70, 68, 60, 55, 45, 40, user.currentRiskIndex === 'Pending' ? 38 : user.riskHistory[0] || 38];
    const chartPath = generatePath(displayData);

    return (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} transition={{ duration: 0.6, type: 'spring' }} className="flex flex-col h-full w-full p-6 text-white relative">
            <div className="flex-1 flex flex-col justify-center items-center relative z-10 w-full">
                <div className="pulse-btn-container mb-12">
                    <button onClick={onScanClick} className="w-56 h-56 rounded-full bg-[var(--color-background)] border border-[var(--color-cyber-teal)]/30 flex flex-col items-center justify-center space-y-4 cursor-pointer hover:border-[var(--color-bio-green)] hover:shadow-[var(--shadow-neon-green)] transition-all duration-500 relative z-10 group">
                        <div className="absolute inset-0 rounded-full border border-[var(--color-bio-green)] opacity-20 group-hover:scale-110 transition-transform duration-500 ease-out"></div>
                        <div className="absolute inset-0 rounded-full border border-[var(--color-cyber-teal)] opacity-10 group-hover:scale-125 transition-transform duration-700 ease-out"></div>
                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 20, ease: "linear" }} className="absolute inset-2 border border-dashed border-white/10 rounded-full pointer-events-none"></motion.div>
                        <ScanLine size={56} className="text-[var(--color-cyber-teal)] group-hover:text-[var(--color-bio-green)] transition-colors" />
                        <div className="flex flex-col items-center">
                            <span className="font-bold tracking-widest text-xl uppercase text-white group-hover:text-[var(--color-bio-green)] transition-colors">Start AR Scan</span>
                            <span className="text-[10px] text-gray-400 font-mono mt-1">Initialize Vision Engine</span>
                        </div>
                    </button>
                </div>
                <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 mt-auto">
                    <motion.div layoutId="card-health-status" whileHover={{ y: -5, boxShadow: "var(--shadow-neon-teal)" }} className="p-5 rounded-2xl glass-panel border border-[var(--color-cyber-teal)]/20 flex flex-col relative overflow-hidden">
                        <div className="absolute -right-4 -top-4 w-20 h-20 bg-[var(--color-bio-green)]/10 rounded-full blur-xl"></div>
                        <div className="flex justify-between items-start mb-3"><div className="flex items-center space-x-2"><Activity size={18} className="text-[var(--color-bio-green)]" /><h3 className="text-sm font-semibold text-gray-200 tracking-wide">Aggregated Index</h3></div></div>
                        <div className="mt-2 flex items-baseline space-x-2">
                            <span className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">{user.currentRiskIndex}</span>
                            <span className={`text-xs ${user.currentRiskChange.startsWith('+') ? 'text-[var(--color-bio-green)]' : 'text-yellow-400'} font-mono`}>{user.currentRiskChange}</span>
                        </div>
                    </motion.div>
                    <motion.div layoutId="card-risk-trend" whileHover={{ y: -5, boxShadow: "var(--shadow-neon-teal)" }} className="p-5 rounded-2xl glass-panel border border-[var(--color-cyber-teal)]/20 flex flex-col w-full">
                        <div className="flex justify-between items-start mb-2"><div className="flex items-center space-x-2"><TrendingDown size={18} className="text-[var(--color-cyber-teal)]" /><h3 className="text-sm font-semibold text-gray-200 tracking-wide">Neural Risk Trend</h3></div><BarChart2 size={16} className="text-[var(--color-cyber-teal)]/50" /></div>
                        <div className="mt-4 w-full h-32 relative flex items-end">
                            <div className="absolute left-0 top-0 bottom-6 flex flex-col justify-between text-[9px] text-gray-500 font-mono z-10"><span>100</span><span>50</span><span>0</span></div>
                            <div className="ml-6 flex-1 h-full relative border-l border-b border-white/10">
                                <div className="absolute inset-0 flex justify-between opacity-10 pointer-events-none">{[1, 2, 3, 4, 5].map(i => <div key={i} className="h-full w-px bg-white"></div>)}</div>
                                <div className="absolute inset-0 flex flex-col justify-between opacity-10 pointer-events-none">{[1, 2].map(i => <div key={i} className="w-full h-px bg-white"></div>)}</div>
                                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 80" preserveAspectRatio="none">
                                    <defs>
                                        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color-cyber-teal)" stopOpacity="0.4" /><stop offset="100%" stopColor="var(--color-cyber-teal)" stopOpacity="0.0" /></linearGradient>
                                        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2" result="blur" /><feComposite in="SourceGraphic" in2="blur" operator="over" /></filter>
                                    </defs>
                                    <motion.path d={`${chartPath} L 290,70 L 10,70 Z`} fill="url(#areaGradient)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.5 }} />
                                    <motion.path d={chartPath} fill="none" stroke="var(--color-cyber-teal)" strokeWidth="2" filter="url(#glow)" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, ease: "easeInOut" }} />
                                    <motion.circle cx="290" cy="70" r="3" fill="var(--color-bio-green)" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.5 }} />
                                </svg>
                            </div>
                        </div>
                        <div className="ml-6 mt-2 flex justify-between text-[9px] text-gray-500 font-mono uppercase tracking-wider"><span>Week 1</span><span>Week 2</span><span>Week 3</span><span>Current</span></div>
                    </motion.div>
                </div>
            </div>
        </motion.div>
    );
};

// ==========================================
// 3. AR SCANNER SCREEN
// ==========================================
export const ARScanner = ({ onComplete }) => {
    const videoRef = useRef(null);
    const { stream, error } = useCamera();

    useEffect(() => { if (videoRef.current && stream) videoRef.current.srcObject = stream; }, [stream]);
    useEffect(() => { const timer = setTimeout(() => onComplete(), 4000); return () => clearTimeout(timer); }, [onComplete]);

    if (error) {
        return (
            <div className="flex flex-col h-full w-full justify-center items-center p-6 bg-background">
                <AlertTriangle size={48} className="text-danger mb-4" />
                <h2 className="text-xl text-white mb-2">Camera Access Denied</h2>
                <p className="text-sm text-gray-400 text-center">AR Scanner requires device camera permissions.</p>
                <button onClick={onComplete} className="mt-8 px-6 py-2 rounded-full glass-panel border border-[var(--color-cyber-teal)] text-[var(--color-cyber-teal)]">Bypass Scanner (Dev)</button>
            </div>
        );
    }

    return (
        <motion.div layoutId="screen-container" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col h-full w-full relative bg-black overflow-hidden">
            <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover opacity-80" />
            <div className="absolute inset-0 z-10 opacity-30 pointer-events-none" style={{ backgroundImage: `linear-gradient(to right, rgba(0, 210, 255, 0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 210, 255, 0.2) 1px, transparent 1px)`, backgroundSize: '40px 40px' }}></div>
            <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                <motion.div initial={{ width: 280, height: 280, borderColor: 'rgba(0, 210, 255, 0.3)' }} animate={{ width: [280, 260, 280], height: [280, 260, 280], borderColor: ['rgba(0, 210, 255, 0.5)', 'rgba(57, 255, 20, 0.8)', 'rgba(0, 210, 255, 0.8)'] }} transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }} className="border-2 border-dashed rounded-3xl relative flex items-center justify-center shadow-[0_0_30px_rgba(0,210,255,0.2)]">
                    <motion.div initial={{ top: "0%" }} animate={{ top: "100%" }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }} className="absolute left-0 right-0 h-[2px] bg-[var(--color-cyber-teal)] shadow-[0_0_20px_#00d2ff]" />
                    <Focus size={48} className="text-[var(--color-cyber-teal)]/20" />
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1 }} className="absolute -right-32 top-10 glass-panel p-2 rounded-lg border border-[var(--color-cyber-teal)]/50 backdrop-blur-xl pointer-events-none w-28">
                        <div className="text-[10px] text-[var(--color-cyber-teal)] uppercase tracking-wider mb-1 font-mono">Statistical Risk</div>
                        <div className="text-lg font-bold text-white font-mono flex items-end space-x-1"><span>P(x)</span><motion.span animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 0.5 }} className="text-sm text-[var(--color-bio-green)]">= 0.82</motion.span></div>
                        <div className="text-[8px] text-gray-400 mt-1">CONFIDENCE: 94%</div>
                    </motion.div>
                    {[...Array(5)].map((_, i) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 0, x: 0, scale: 0 }} animate={{ opacity: [0, 1, 0], y: [0, Math.random() * -100 - 50], x: [0, (Math.random() - 0.5) * 100], scale: [0, 1, 0.5] }} transition={{ repeat: Infinity, duration: 2 + Math.random() * 2, delay: i * 0.4 }} className="absolute bg-[var(--color-bio-green)] rounded-full w-2 h-2 shadow-[0_0_10px_#39ff14]" />
                    ))}
                </motion.div>
            </div>
            <motion.div initial={{ y: 100 }} animate={{ y: 0 }} transition={{ delay: 0.5, type: 'spring' }} className="absolute bottom-0 left-0 w-full p-6 z-30 bg-gradient-to-t from-background to-transparent">
                <div className="glass-panel p-4 rounded-xl flex items-center justify-between border border-[var(--color-cyber-teal)]/30">
                    <div>
                        <h3 className="text-sm font-semibold text-white tracking-wide">Targeting Anomalies...</h3>
                        <p className="text-xs text-[var(--color-cyber-teal)] uppercase tracking-widest mt-1">Immersive AR Engine Active</p>
                    </div>
                    <div className="flex space-x-1">
                        <motion.div animate={{ height: [10, 20, 10] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1 bg-[var(--color-cyber-teal)] rounded-full"></motion.div>
                        <motion.div animate={{ height: [15, 25, 15] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1 bg-[var(--color-cyber-teal)] rounded-full"></motion.div>
                        <motion.div animate={{ height: [8, 16, 8] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1 bg-[var(--color-cyber-teal)] rounded-full"></motion.div>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};

// ==========================================
// 4. COPILOT CHAT SCREEN
// ==========================================
export const CopilotScreen = ({ onComplete }) => {
    const [messages, setMessages] = useState([{ sender: 'ai', text: "Scan complete. I've detected a mild irregularity. To refine the analysis, I need to ask a few questions.", isTyping: false }]);
    const [questionIndex, setQuestionIndex] = useState(0);

    const triageQuestions = [
        { q: "Does the affected area itch or feel irritated?", options: ["Yes, constantly", "Occasionally", "No"] },
        { q: "How long have you noticed this?", options: ["Just appeared (1-2 days)", "A few weeks", "More than a month"] },
        { q: "Have you been exposed to excessive humidity or harsh chemicals recently?", options: ["Yes, high humidity", "Yes, chemicals", "No, neither"] }
    ];

    useEffect(() => {
        if (questionIndex >= triageQuestions.length) {
            const timer = setTimeout(() => onComplete(65), 1500);
            return () => clearTimeout(timer);
        }
    }, [questionIndex, onComplete, triageQuestions.length]);

    useEffect(() => {
        if (questionIndex < triageQuestions.length && messages[messages.length - 1].sender === 'user') {
            const typingTimer = setTimeout(() => {
                setMessages(prev => [...prev, { sender: 'ai', text: triageQuestions[questionIndex].q, isTyping: true }]);
                setTimeout(() => setMessages(prev => { const newMsgs = [...prev]; newMsgs[newMsgs.length - 1].isTyping = false; return newMsgs; }), 1000);
            }, 500);
            return () => clearTimeout(typingTimer);
        }
    }, [questionIndex, messages]);

    useEffect(() => {
        if (questionIndex === 0 && messages.length === 1) {
            const timer = setTimeout(() => {
                setMessages(prev => [...prev, { sender: 'ai', text: triageQuestions[0].q, isTyping: true }]);
                setTimeout(() => setMessages(prev => { const newMsgs = [...prev]; newMsgs[newMsgs.length - 1].isTyping = false; return newMsgs; }), 1000);
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleOptionClick = (option) => {
        setMessages(prev => [...prev, { sender: 'user', text: option, isTyping: false }]);
        setQuestionIndex(prev => prev + 1);
    };

    return (
        <motion.div layoutId="screen-container" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9 }} className="flex flex-col h-full w-full p-6 relative">
            <header className="flex items-center space-x-3 pb-4 border-b border-white/10 shrink-0">
                <div className="relative">
                    <div className="w-10 h-10 rounded-lg bg-[var(--color-cyber-teal)]/10 border border-[var(--color-cyber-teal)]/30 flex items-center justify-center relative overflow-hidden">
                        <Cpu size={20} className="text-[var(--color-cyber-teal)] z-10" />
                        <div className="absolute inset-0 bg-[var(--color-cyber-teal)]/20 animate-pulse"></div>
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-[var(--color-bio-green)] rounded-full shadow-[0_0_8px_#39ff14]"></div>
                </div>
                <div>
                    <h2 className="text-sm font-semibold tracking-wide text-white">Holographic Assistant</h2>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest">MedGemma v4.2 Online</p>
                </div>
            </header>
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
                            {triageQuestions[questionIndex].options.map((opt, i) => (
                                <button key={i} onClick={() => handleOptionClick(opt)} className="px-4 py-3 rounded-xl glass-panel border border-white/20 text-xs text-gray-300 hover:border-[var(--color-cyber-teal)] hover:text-white transition-all flex-1 text-center whitespace-nowrap min-w-[30%] cursor-pointer">{opt}</button>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
};

// ==========================================
// 5. RESULTS SCREEN
// ==========================================
export const ResultsScreen = ({ riskValue, onShowMap }) => {
    const { addScanResult } = useUser();

    useEffect(() => { addScanResult(riskValue); }, [riskValue, addScanResult]);

    const circleCircumference = 2 * Math.PI * 54;
    const strokeDashoffset = circleCircumference - (riskValue / 100) * circleCircumference;

    return (
        <motion.div layoutId="screen-container" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, x: -50 }} transition={{ duration: 0.6, type: 'spring' }} className="flex flex-col h-full w-full p-8 items-center relative overflow-hidden">
            <header className="w-full text-center mb-8 relative">
                <h2 className="text-xl font-light tracking-[0.3em] uppercase text-gray-400">Diagnostic Result</h2>
                <div className="absolute bottom--2 left-1/2 transform -translate-x-1/2 w-12 h-[1px] bg-[var(--color-cyber-teal)] shadow-neon-teal"></div>
            </header>
            <div className="relative flex justify-center items-center mb-8">
                <div className="absolute w-40 h-40 bg-[rgba(255,165,0,0.15)] rounded-full blur-[30px]"></div>
                <svg className="w-48 h-48 transform -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                    <circle cx="60" cy="60" r="45" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="2 4" />
                    <circle className="circular-progress" cx="60" cy="60" r="54" fill="none" stroke="url(#gradient)" strokeWidth="6" strokeLinecap="round" strokeDasharray={circleCircumference} strokeDashoffset={strokeDashoffset} />
                    <defs>
                        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#ef4444" /></linearGradient>
                    </defs>
                </svg>
                <div className="absolute flex flex-col items-center">
                    <span className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-yellow-400 to-red-500">{riskValue}</span>
                    <span className="text-[10px] uppercase tracking-widest text-gray-400 mt-1">{riskValue > 60 ? 'ELEVATED' : 'OPTIMAL'}</span>
                </div>
            </div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="w-full glass-panel p-5 rounded-xl border-l-[4px] border-l-yellow-500 mb-8 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-2 opacity-20 group-hover:opacity-100 transition-opacity"><Info size={16} className="text-yellow-500" /></div>
                <h3 className="text-sm font-semibold text-gray-200 mb-2 flex items-center"><Zap size={16} className="text-yellow-500 mr-2" /> Primary Insight</h3>
                <p className="text-sm text-gray-400 leading-relaxed font-light">Detected mild dermatitis signature. <span className="text-white font-medium">Risk increased</span> due to recent persistent itchiness combined with the current 85% relative humidity levels recorded in the <span className="text-[var(--color-cyber-teal)] border-b border-[var(--color-cyber-teal)]/50 border-dashed cursor-help">Johor grid</span>.</p>
            </motion.div>
            <div className="w-full flex flex-col space-y-3 mt-auto relative z-10">
                <motion.button whileHover={{ scale: 1.02, boxShadow: "0 0 20px rgba(0, 210, 255, 0.4)" }} whileTap={{ scale: 0.98 }} className="w-full py-4 rounded-xl bg-gradient-to-r from-[var(--color-cyber-teal)]/80 to-blue-600/80 text-white font-medium tracking-wide border border-white/10 flex items-center justify-center shadow-lg relative overflow-hidden group cursor-pointer">
                    <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                    <PhoneCall size={18} className="mr-3" /> Consult Specialist Now
                </motion.button>
                <motion.button onClick={onShowMap} whileHover={{ scale: 1.02, backgroundColor: "rgba(255, 255, 255, 0.1)" }} whileTap={{ scale: 0.98 }} className="w-full py-3 rounded-xl glass-panel text-gray-300 text-sm flex items-center justify-center hover:text-white transition-colors cursor-pointer">
                    <Map size={16} className="mr-2 text-[var(--color-bio-green)]" /> Open 3D Map Sandbox
                </motion.button>
            </div>
        </motion.div>
    );
};
