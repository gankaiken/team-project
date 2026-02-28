import React from 'react';
import { motion } from 'framer-motion';
import { ScanLine, Activity, TrendingDown, BarChart2 } from 'lucide-react';
import { useUser } from '../../../shared/context/UserContext';
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

