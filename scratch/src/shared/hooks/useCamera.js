import { useState, useEffect } from 'react';
export const useCamera = (enabled = true) => {
    const [stream, setStream] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!enabled) {
            setStream(null);
            setError(null);
            return undefined;
        }

        let activeStream = null;
        const startCamera = async () => {
            try {
                const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                activeStream = mediaStream;
                setStream(mediaStream);
            } catch (err) {
                setError(err.message || 'Failed to access camera.');
            }
        };

        startCamera();
        return () => {
            if (activeStream) activeStream.getTracks().forEach(track => track.stop());
        };
    }, [enabled]);

    return { stream, error };
};

