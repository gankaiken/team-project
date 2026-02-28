import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';
import * as THREE from 'three';
import { parseSVGPath } from '../utils/parseSVGPath';
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


export { TopographicState };
