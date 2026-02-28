import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { MapControls } from '@react-three/drei';
import { motion } from 'framer-motion';
import { Map } from 'lucide-react';
import { useGeolocation } from '../../../shared/hooks/useGeolocation';
import { sectors } from '../data/sectors';
import { TopographicState } from './TopographicState';
import { GroundPlane } from './GroundPlane';
export const SandboxMap = () => {
    const { location } = useGeolocation();
    const [hoveredState, setHoveredState] = useState(null);
    const [activeState, setActiveState] = useState(null);
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col h-full w-full relative bg-[#010305]"
        >
            <div className="absolute top-4 left-6 z-10">
                <h2 className="text-xl font-bold text-white tracking-widest flex items-center">
                    <Map size={20} className="mr-2 text-[var(--color-cyber-teal)]" /> Digital Twin
                </h2>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Malaysia 2050 Biosphere · All States</p>
            </div>

            {/* Instruction Overlay */}
            <div className="absolute top-4 right-6 z-10 glass-panel p-3 rounded-xl border border-white/10 max-w-xs">
                <p className="text-xs text-gray-300 font-medium">
                    {activeState ? `Monitoring ${sectors.find(s => s.id === activeState)?.name} Sector` : 'Pan · Zoom · Click any state for epidemiological data.'}
                </p>
            </div>

            {/* 3D Canvas rendering Malaysia Digital Twin */}
            <div className="flex-1 w-full relative">
                <Canvas shadows camera={{ position: [8, 28, 8], fov: 38 }}>
                    <ambientLight intensity={0.4} />
                    <directionalLight
                        position={[10, 30, 10]}
                        intensity={2}
                        castShadow
                        shadow-mapSize-width={1024}
                        shadow-mapSize-height={1024}
                    />
                    <pointLight position={[-10, 10, -10]} intensity={0.3} color="#39ff14" />
                    <pointLight position={[20, 10, -5]} intensity={0.2} color="#00d2ff" />

                    <GroundPlane />

                    {/* Render All State Zones */}
                    {sectors.map(sector => (
                        <TopographicState
                            key={sector.id}
                            {...sector}
                            isHovered={hoveredState === sector.id}
                            lifted={activeState === sector.id}
                            onHover={(state) => setHoveredState(state ? sector.id : null)}
                            onClick={() => setActiveState(activeState === sector.id ? null : sector.id)}
                        />
                    ))}

                    {/* Google Maps-style MapControls — top-down, no orbit */}
                    <MapControls
                        enableDamping={true}
                        dampingFactor={0.08}
                        maxPolarAngle={Math.PI / 3}
                        minPolarAngle={0.1}
                        minDistance={5}
                        maxDistance={45}
                        screenSpacePanning={true}
                        panSpeed={1.2}
                        zoomSpeed={1.0}
                        enableRotate={false}
                    />
                </Canvas>
            </div>

            {/* Bottom Info Bar with Color Legend */}
            <div className="p-3 border-t border-white/5 bg-black/70 backdrop-blur-md relative z-10">
                <div className="flex justify-between items-center text-xs mb-2">
                    <div className="flex items-center space-x-4">
                        <span className="text-gray-400 font-mono">INTERACTIVE MAP · ALL REGIONS</span>
                        <span className="text-gray-500 font-mono">|</span>
                        <span className="text-gray-400 font-mono">LAT: {location.lat.toFixed(4)} LNG: {location.lng.toFixed(4)}</span>
                    </div>
                    <div className="text-gray-500 font-mono text-[10px]">16 SECTORS ONLINE</div>
                </div>
                {/* Color Legend */}
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {sectors.map(s => (
                        <div key={s.id} className="flex items-center text-[9px] uppercase font-mono text-gray-500 tracking-wider">
                            <div className="w-2 h-2 rounded-sm mr-1" style={{ backgroundColor: s.baseColor, border: `1px solid ${s.color}40` }}></div>
                            {s.name}
                        </div>
                    ))}
                </div>
            </div>
        </motion.div>
    );
};


