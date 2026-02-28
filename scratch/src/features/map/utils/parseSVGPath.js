import * as THREE from 'three';
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


export { parseSVGPath };
