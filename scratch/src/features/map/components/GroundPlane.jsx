import React from 'react';
const GroundPlane = () => (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, 0]} receiveShadow>
        <planeGeometry args={[80, 55]} />
        <meshStandardMaterial color="#060a0d" roughness={1} />
    </mesh>
);



export { GroundPlane };
