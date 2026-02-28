import React, { createContext, useState, useContext } from 'react';
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
            scanRecords: [],
            currentRiskIndex: 'Pending',
            currentRiskChange: 'N/A',
            legacyData: simulatedLegacyReport
        });
    };

    const addScanResult = (newAssessment) => {
        setUser(prev => {
            if (!prev) return prev;

            const normalizedAssessment = typeof newAssessment === 'number'
                ? { final_score: newAssessment }
                : (newAssessment || {});

            const newRiskValue = Number(normalizedAssessment.final_score || 0);
            const previousRisk = prev.riskHistory.length ? prev.riskHistory[prev.riskHistory.length - 1] : null;
            const newHistory = prev.riskHistory.length > 5 ? [...prev.riskHistory.slice(1), newRiskValue] : [...prev.riskHistory, newRiskValue];
            const riskDiff = previousRisk === null ? 0 : newRiskValue - previousRisk;
            const changeLabel = previousRisk === null ? 'Calculated' : `${riskDiff >= 0 ? '+' : ''}${riskDiff}`;

            let newIndex = 'Optimal';
            if (newRiskValue > 60) newIndex = 'Elevated';
            else if (newRiskValue > 40) newIndex = 'Warning';

            const scanRecord = {
                timestamp: new Date().toISOString(),
                ...normalizedAssessment
            };
            const scanRecords = prev.scanRecords.length > 15 ? [...prev.scanRecords.slice(1), scanRecord] : [...prev.scanRecords, scanRecord];

            return {
                ...prev,
                lastScanDate: 'Just now',
                riskHistory: newHistory,
                scanRecords,
                currentRiskIndex: newIndex,
                currentRiskChange: changeLabel
            };
        });
    };

    const logout = () => setUser(null);

    return (
        <UserContext.Provider value={{ user, login, logout, addScanResult }}>
            {children}
        </UserContext.Provider>
    );
};



