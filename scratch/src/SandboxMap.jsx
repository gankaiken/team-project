import React, { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { MapControls, Html } from '@react-three/drei';
import { motion } from 'framer-motion';
import { Map, MapPin } from 'lucide-react';
import { useGeolocation } from './State';
import * as THREE from 'three';

// Utility to manually parse simple SVG string commands into THREE.Shape
const parseSVGPath = (svgPath) => {
    const shape = new THREE.Shape();
    try {
        const commands = svgPath.match(/[A-Za-z][^A-Za-z]*/g);
        if (!commands) throw new Error("No commands found");

        let currentX = 0, currentY = 0;
        let lastCtrlX = 0, lastCtrlY = 0;

        commands.forEach(cmdStr => {
            const type = cmdStr.charAt(0);
            const args = cmdStr.substring(1).trim().split(/[, ]+/).map(parseFloat);

            switch (type) {
                case 'M':
                    shape.moveTo(args[0], args[1]);
                    currentX = args[0]; currentY = args[1];
                    lastCtrlX = currentX; lastCtrlY = currentY;
                    break;
                case 'L':
                    shape.lineTo(args[0], args[1]);
                    currentX = args[0]; currentY = args[1];
                    lastCtrlX = currentX; lastCtrlY = currentY;
                    break;
                case 'Q':
                    shape.quadraticCurveTo(args[0], args[1], args[2], args[3]);
                    currentX = args[2]; currentY = args[3];
                    lastCtrlX = args[0]; lastCtrlY = args[1];
                    break;
                case 'T': {
                    const reflectedX = currentX + (currentX - lastCtrlX);
                    const reflectedY = currentY + (currentY - lastCtrlY);
                    shape.quadraticCurveTo(reflectedX, reflectedY, args[0], args[1]);
                    currentX = args[0]; currentY = args[1];
                    lastCtrlX = reflectedX; lastCtrlY = reflectedY;
                    break;
                }
                case 'Z':
                case 'z':
                    shape.closePath();
                    break;
            }
        });
        return shape;
    } catch (e) {
        console.error("Manual SVG parse error:", e);
        shape.moveTo(0, 0);
        shape.lineTo(50, 0);
        shape.lineTo(50, 50);
        shape.lineTo(0, 50);
        shape.lineTo(0, 0);
        return shape;
    }
};

// Represents an interactive Topographic Extrusion on the Map
const TopographicState = ({ position, scale = 1, svgPath, name, metrics, color, baseColor, isHovered, onHover, onClick, lifted }) => {
    const meshRef = useRef();

    const shape = useMemo(() => parseSVGPath(svgPath), [svgPath]);

    const extrudeSettings = useMemo(() => ({
        depth: lifted || isHovered ? 1.8 : 0.6,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.05,
        bevelThickness: 0.1,
    }), [lifted, isHovered]);

    useFrame(() => {
        if (meshRef.current) {
            const targetY = lifted || isHovered ? position[1] + 1.2 : position[1];
            meshRef.current.position.y = THREE.MathUtils.lerp(meshRef.current.position.y, targetY, 0.08);
        }
    });

    return (
        <group position={[position[0], 0, position[2]]}>
            <mesh
                ref={meshRef}
                position={[0, position[1], 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                scale={[scale, scale, scale]}
                onPointerOver={(e) => { e.stopPropagation(); onHover(true); }}
                onPointerOut={(e) => { e.stopPropagation(); onHover(false); }}
                onClick={(e) => { e.stopPropagation(); onClick(); }}
                receiveShadow
                castShadow
            >
                {shape && <extrudeGeometry args={[shape, extrudeSettings]} />}
                <meshStandardMaterial
                    color={lifted || isHovered ? color : (baseColor || '#111815')}
                    emissive={lifted || isHovered ? color : '#000000'}
                    emissiveIntensity={lifted ? 0.7 : isHovered ? 0.35 : 0}
                    roughness={0.7}
                    metalness={0.15}
                    transparent={false}
                />

                {/* Data Overlay when Lifted/Active */}
                {(lifted || isHovered) && (
                    <Html position={[0, 0, -2]} center zIndexRange={[100, 0]}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            className="bg-black/90 backdrop-blur-md border p-3 rounded-xl pointer-events-none min-w-[200px]"
                            style={{ borderColor: color }}
                        >
                            <div className="flex items-center space-x-2 border-b border-white/10 pb-2 mb-2">
                                <MapPin size={16} style={{ color: color }} />
                                <h3 className="font-bold text-white uppercase tracking-widest text-sm">{name} Sector</h3>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-400">Pop. Health Trend:</span>
                                    <span className="text-white font-mono">{metrics.trend}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-400">Weather Risk:</span>
                                    <span style={{ color: metrics.riskLevel > 50 ? '#ff3366' : '#39ff14' }} className="font-mono">
                                        {metrics.riskLevel}%
                                    </span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-400">Climate Factor:</span>
                                    <span className="text-[var(--color-cyber-teal)] italic">{metrics.climate}</span>
                                </div>
                            </div>
                        </motion.div>
                    </Html>
                )}
            </mesh>

            {/* Floating State Label */}
            <Html position={[0, 1.2, 0]} center zIndexRange={[50, 0]}>
                <div className="pointer-events-none select-none">
                    <span
                        className="text-[10px] font-semibold uppercase tracking-[0.12em] px-2 py-0.5 rounded whitespace-nowrap"
                        style={{
                            color: lifted || isHovered ? '#fff' : '#aaa',
                            textShadow: `0 0 8px ${color}`,
                            background: lifted || isHovered ? `${color}40` : 'rgba(0,0,0,0.5)',
                            borderBottom: lifted || isHovered ? `1px solid ${color}80` : 'none'
                        }}
                    >
                        {name}
                    </span>
                </div>
            </Html>
        </group>
    );
}

// Minimal ground plane — no grid lines
const GroundPlane = () => (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, 0]} receiveShadow>
        <planeGeometry args={[80, 55]} />
        <meshStandardMaterial color="#060a0d" roughness={1} />
    </mesh>
);


export const SandboxMap = () => {
    const { location } = useGeolocation();
    const [hoveredState, setHoveredState] = useState(null);
    const [activeState, setActiveState] = useState(null);

    // Full Malaysia: 13 states + 3 federal territories, each with unique geo shapes + colors
    const sectors = useMemo(() => [
        // ──── PENINSULAR MALAYSIA (West) ────

        // PERLIS - tiny state, northernmost
        {
            id: 'perlis',
            name: 'Perlis',
            position: [-4.5, 0.12, -7.8],
            scale: 0.015,
            svgPath: "M10,5 Q20,0 35,8 Q45,18 40,30 Q30,38 15,32 Q5,22 10,5 Z",
            color: '#E8D44D',
            baseColor: '#2A2A0A',
            metrics: { trend: 'Stable', riskLevel: 22, climate: 'Arid North' }
        },
        // KEDAH
        {
            id: 'kedah',
            name: 'Kedah',
            position: [-4, 0.18, -6.5],
            scale: 0.035,
            svgPath: "M5,10 Q20,0 50,5 Q70,15 65,40 Q55,60 40,65 Q15,55 5,35 Q0,20 5,10 Z",
            color: '#FF9F43',
            baseColor: '#2A1A0A',
            metrics: { trend: 'Improving', riskLevel: 30, climate: 'Rice Plains' }
        },
        // PENANG
        {
            id: 'penang',
            name: 'Penang',
            position: [-5.2, 0.15, -5.3],
            scale: 0.018,
            svgPath: "M10,10 Q20,0 30,15 T40,40 Q20,50 0,30 Z",
            color: '#FF6B6B',
            baseColor: '#2A0A18',
            metrics: { trend: 'Spiking', riskLevel: 88, climate: 'Coastal UV' }
        },
        // PERAK
        {
            id: 'perak',
            name: 'Perak',
            position: [-3, 0.2, -4.2],
            scale: 0.045,
            svgPath: "M10,5 Q30,0 55,8 Q70,20 68,45 Q60,70 45,80 Q25,85 10,70 Q0,50 5,25 Q8,10 10,5 Z",
            color: '#54A0FF',
            baseColor: '#0A1A3A',
            metrics: { trend: 'Declining', riskLevel: 42, climate: 'Limestone Basin' }
        },
        // KELANTAN
        {
            id: 'kelantan',
            name: 'Kelantan',
            position: [1, 0.22, -6],
            scale: 0.04,
            svgPath: "M15,5 Q40,0 60,12 Q70,30 55,55 Q40,65 20,60 Q5,45 0,25 Q8,10 15,5 Z",
            color: '#5F27CD',
            baseColor: '#1A0A2A',
            metrics: { trend: 'Elevated', riskLevel: 61, climate: 'Monsoon East' }
        },
        // TERENGGANU
        {
            id: 'terengganu',
            name: 'Terengganu',
            position: [2.5, 0.2, -4],
            scale: 0.04,
            svgPath: "M5,5 Q25,0 40,10 Q55,30 50,55 Q40,75 25,80 Q10,70 0,45 Q-2,20 5,5 Z",
            color: '#01A3A4',
            baseColor: '#0A2222',
            metrics: { trend: 'Optimal', riskLevel: 18, climate: 'Coastal Tropics' }
        },
        // PAHANG - largest state
        {
            id: 'pahang',
            name: 'Pahang',
            position: [0.5, 0.25, -2],
            scale: 0.06,
            svgPath: "M10,10 Q35,0 65,5 Q85,20 80,50 Q70,75 50,85 Q25,80 8,60 Q0,35 10,10 Z",
            color: '#10AC84',
            baseColor: '#0A2A1A',
            metrics: { trend: 'Improving', riskLevel: 28, climate: 'Rainforest Interior' }
        },
        // SELANGOR
        {
            id: 'selangor',
            name: 'Selangor',
            position: [-2, 0.2, -0.8],
            scale: 0.035,
            svgPath: "M0,20 Q20,0 50,5 Q70,20 65,45 Q50,65 25,60 Q5,50 0,20 Z",
            color: '#EE5A24',
            baseColor: '#2A150A',
            metrics: { trend: 'Stable', riskLevel: 35, climate: 'Urban Heat Island' }
        },
        // KL (Federal Territory)
        {
            id: 'kl',
            name: 'Kuala Lumpur',
            position: [-1.2, 0.3, -0.5],
            scale: 0.012,
            svgPath: "M10,5 Q20,0 30,5 Q35,15 30,25 Q20,30 10,25 Q5,15 10,5 Z",
            color: '#00d2ff',
            baseColor: '#0A2A3A',
            metrics: { trend: 'Monitored', riskLevel: 45, climate: 'High-Density Urban' }
        },
        // PUTRAJAYA (Federal Territory)
        {
            id: 'putrajaya',
            name: 'Putrajaya',
            position: [-1.3, 0.28, 0.2],
            scale: 0.008,
            svgPath: "M8,3 Q16,0 22,6 Q25,14 20,20 Q12,24 6,18 Q2,10 8,3 Z",
            color: '#C44569',
            baseColor: '#2A0A1A',
            metrics: { trend: 'Optimal', riskLevel: 12, climate: 'Planned City' }
        },
        // NEGERI SEMBILAN
        {
            id: 'nsembilan',
            name: 'N. Sembilan',
            position: [-1, 0.18, 1],
            scale: 0.03,
            svgPath: "M5,8 Q25,0 45,10 Q55,30 45,50 Q30,55 10,45 Q0,25 5,8 Z",
            color: '#F8B739',
            baseColor: '#2A2A0A',
            metrics: { trend: 'Declining', riskLevel: 38, climate: 'Highland Fringe' }
        },
        // MELAKA
        {
            id: 'melaka',
            name: 'Melaka',
            position: [-0.5, 0.14, 2.2],
            scale: 0.018,
            svgPath: "M5,5 Q20,0 35,8 Q42,22 35,35 Q20,40 5,30 Q0,15 5,5 Z",
            color: '#FC427B',
            baseColor: '#2A0A20',
            metrics: { trend: 'Stable', riskLevel: 25, climate: 'Straits Coastal' }
        },
        // JOHOR
        {
            id: 'johor',
            name: 'Johor',
            position: [1, 0.2, 3.5],
            scale: 0.055,
            svgPath: "M0,60 Q30,40 60,70 T120,50 T160,80 Q100,120 50,100 Z",
            color: '#00d2ff',
            baseColor: '#0A1A2F',
            metrics: { trend: 'Declining (Humidity)', riskLevel: 72, climate: 'High Moisture' }
        },

        // ──── EAST MALAYSIA (Borneo) ────

        // SARAWAK - largest state by area
        {
            id: 'sarawak',
            name: 'Sarawak',
            position: [12, 0.2, -1],
            scale: 0.09,
            svgPath: "M0,50 Q50,20 100,30 T200,60 Q250,100 200,150 T50,100 Z",
            color: '#39ff14',
            baseColor: '#0A2A2A',
            metrics: { trend: 'Optimal', riskLevel: 15, climate: 'Tropical Canopy' }
        },
        // SABAH
        {
            id: 'sabah',
            name: 'Sabah',
            position: [24, 0.3, -5],
            scale: 0.07,
            svgPath: "M0,40 Q60,0 120,50 T150,100 Q100,140 50,100 Z",
            color: '#A3CB38',
            baseColor: '#1A2A0A',
            metrics: { trend: 'Elevated (Monsoon)', riskLevel: 55, climate: 'Monsoon Rains' }
        },
        // LABUAN (Federal Territory, island off Sabah)
        {
            id: 'labuan',
            name: 'Labuan',
            position: [19, 0.15, -3.5],
            scale: 0.01,
            svgPath: "M8,4 Q18,0 25,8 Q28,18 22,25 Q12,28 5,20 Q2,10 8,4 Z",
            color: '#786FA6',
            baseColor: '#1A1A2A',
            metrics: { trend: 'Stable', riskLevel: 20, climate: 'Island Offshore' }
        }
    ], []);

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
