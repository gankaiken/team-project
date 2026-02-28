import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { UserProvider, useUser } from '../shared/context/UserContext';
import { Sidebar } from '../shared/components/Sidebar';
import { Breadcrumbs } from '../shared/components/Breadcrumbs';
import { RegistrationScreen } from '../features/auth/components/RegistrationScreen';
import { DashboardScreen } from '../features/dashboard/components/DashboardScreen';
import { ARScanner } from '../features/scanner/components/ARScanner';
import { CopilotScreen } from '../features/copilot/components/CopilotScreen';
import { ResultsScreen } from '../features/results/components/ResultsScreen';
import { SandboxMap } from '../features/map/components/SandboxMap';
import { SCREENS } from './constants';

const MainApp = () => {
  const { user } = useUser();
  const [currentScreen, setCurrentScreen] = useState(SCREENS.DASHBOARD);
  const [latestAssessment, setLatestAssessment] = useState(null);

  return (
    <div className="flex h-screen w-full bg-[#0a0a0e] text-white overflow-hidden relative font-sans">
      <div className="grid-bg">
        <div className="grid-3d opacity-30"></div>
      </div>
      <div className="dna-bg opacity-10"></div>

      <video
        autoPlay
        loop
        muted
        playsInline
        poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3Crect fill='%230a0a0e'/%3E%3C/svg%3E"
        className="absolute inset-0 w-full h-full object-cover opacity-[0.12] pointer-events-none mix-blend-overlay z-0"
      >
        <source src="https://assets.mixkit.co/videos/preview/mixkit-abstract-technology-connection-background-30919-large.mp4" type="video/mp4" />
        <source src="https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-futuristic-devices-99786-large.mp4" type="video/mp4" />
      </video>
      <div className="video-vignette"></div>

      <div
        className={`flex w-full h-full relative z-10 transition-all duration-1000 ${!user ? 'blur-xl pointer-events-none scale-105 opacity-40' : 'blur-0 pointer-events-auto scale-100 opacity-100'}`}
      >
        <Sidebar currentScreen={currentScreen} onNavigate={setCurrentScreen} />

        <main className="flex-1 relative flex flex-col h-full overflow-hidden">
          <Breadcrumbs currentScreen={currentScreen} />

          <div className="flex-1 w-full h-full relative">
            <AnimatePresence mode="wait">
              {currentScreen === SCREENS.DASHBOARD && (
                <DashboardScreen
                  key="dashboard"
                  onScanClick={() => {
                    setLatestAssessment(null);
                    setCurrentScreen(SCREENS.SCANNING);
                  }}
                />
              )}
              {currentScreen === SCREENS.SCANNING && (
                <ARScanner
                  key="scanning"
                  onComplete={(scanSession) => {
                    setLatestAssessment(scanSession);
                    setCurrentScreen(SCREENS.COPILOT);
                  }}
                />
              )}
              {currentScreen === SCREENS.COPILOT && (
                <CopilotScreen
                  key="copilot"
                  imageAnalysis={latestAssessment?.imageAnalysis || null}
                  onComplete={(assessment) => {
                    setLatestAssessment(assessment);
                    setCurrentScreen(SCREENS.RESULTS);
                  }}
                />
              )}
              {currentScreen === SCREENS.RESULTS && (
                <ResultsScreen
                  key="results"
                  assessment={latestAssessment}
                  onShowMap={() => setCurrentScreen(SCREENS.MAP)}
                />
              )}
              {currentScreen === SCREENS.MAP && <SandboxMap key="map" />}
            </AnimatePresence>
          </div>
        </main>
      </div>

      <AnimatePresence>
        {!user && (
          <motion.div
            key="registration-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <RegistrationScreen onComplete={() => setCurrentScreen(SCREENS.DASHBOARD)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function App() {
  return (
    <UserProvider>
      <MainApp />
    </UserProvider>
  );
}
