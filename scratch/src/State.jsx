import React, { createContext, useState, useContext, useEffect } from 'react';

// ==========================================
// 1. GLOBAL USER STATE CONTEXT
// ==========================================
const UserContext = createContext();

export const useUser = () => useContext(UserContext);

export const UserProvider = ({ children }) => {
    const [user, setUser] = useState(null);

    const login = (name, icNumber) => {
        // Gender detection from 12th digit
        const lastDigit = parseInt(icNumber.charAt(11), 10);
        const detectedGender = (lastDigit % 2 === 0) ? 'Female' : 'Male';

        // Simulated legacy report
        const simulatedLegacyReport = {
            lastTreated: "Eczema (Mild), Oct 2024",
            knownAllergies: "Latex, Pollen",
            riskFactor: "Moderate (Climate Sensitive)",
            totalScans: 12
        };

        setUser({
            name,
            ic: icNumber,
            gender: detectedGender,
            university: 'MyVerse ID',
            lastScanDate: 'No recent scans',
            riskHistory: [],
            currentRiskIndex: 'Pending',
            currentRiskChange: 'N/A',
            legacyData: simulatedLegacyReport
        });
    };

    const addScanResult = (newRiskValue) => {
        setUser(prev => {
            if (!prev) return prev;
            const newHistory = prev.riskHistory.length > 5 ? [...prev.riskHistory.slice(1), newRiskValue] : [...prev.riskHistory, newRiskValue];
            let newIndex = 'Optimal';
            if (newRiskValue > 60) newIndex = 'Elevated';
            else if (newRiskValue > 40) newIndex = 'Warning';

            return { ...prev, lastScanDate: 'Just now', riskHistory: newHistory, currentRiskIndex: newIndex, currentRiskChange: 'Calculated' };
        });
    };

    const logout = () => setUser(null);

    return (
        <UserContext.Provider value={{ user, login, logout, addScanResult }}>
            {children}
        </UserContext.Provider>
    );
};


// ==========================================
// 2. HARDWARE & SENSOR HOOKS
// ==========================================

export const useGeolocation = (defaultCoords = { lat: 1.4927, lng: 103.7414 }) => {
    const [location, setLocation] = useState(defaultCoords);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!navigator.geolocation) {
            setError('Geolocation not supported.');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => setLocation({ lat: position.coords.latitude, lng: position.coords.longitude }),
            (err) => console.warn(`Geolocation error (${err.code}): ${err.message}.`),
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
    }, []);

    return { location, error };
};

export const useCamera = () => {
    const [stream, setStream] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
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
    }, []);

    return { stream, error };
};
