import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { UserProvider, useUser } from './State';
import { Sidebar, Breadcrumbs } from './UI';
import { RegistrationScreen, DashboardScreen, ARScanner, CopilotScreen, ResultsScreen } from './Screens';
import { SandboxMap } from './SandboxMap';

const SCREENS = {
  DASHBOARD: 'dashboard',
  SCANNING: 'scanning',
  COPILOT: 'copilot',
  RESULTS: 'results',
  MAP: 'map'
};

const MainApp = () => {
  const { user } = useUser();
  const [currentScreen, setCurrentScreen] = useState(SCREENS.DASHBOARD);
  const [latestRiskValue, setLatestRiskValue] = useState(0);

  return (
    <div className="flex h-screen w-full bg-[#0a0a0e] text-white overflow-hidden relative font-sans">
      {/* Ambient Backgrounds */}
      <div className="grid-bg">
        <div className="grid-3d opacity-30"></div>
      </div>
      <div className="dna-bg opacity-10"></div>

      {/* Cinematic Tech Background Video */}
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
      {/* Vignette overlay for video edge darkening */}
      <div className="video-vignette"></div>

      {/* Main App Layer — blurred when not authenticated */}
      <div
        className={`flex w-full h-full relative z-10 transition-all duration-1000 ${!user ? 'blur-xl pointer-events-none scale-105 opacity-40' : 'blur-0 pointer-events-auto scale-100 opacity-100'}`}
      >
        {/* Global Persistent Navigation */}
        <Sidebar currentScreen={currentScreen} onNavigate={setCurrentScreen} />

        <main className="flex-1 relative flex flex-col h-full overflow-hidden">
          <Breadcrumbs currentScreen={currentScreen} />

          {/* Main Content Area */}
          <div className="flex-1 w-full h-full relative">
            <AnimatePresence mode="wait">
              {currentScreen === SCREENS.DASHBOARD && (
                <DashboardScreen
                  key="dashboard"
                  onScanClick={() => setCurrentScreen(SCREENS.SCANNING)}
                />
              )}
              {currentScreen === SCREENS.SCANNING && (
                <ARScanner
                  key="scanning"
                  onComplete={() => setCurrentScreen(SCREENS.COPILOT)}
                />
              )}
              {currentScreen === SCREENS.COPILOT && (
                <CopilotScreen
                  key="copilot"
                  onComplete={(risk) => {
                    setLatestRiskValue(risk);
                    setCurrentScreen(SCREENS.RESULTS);
                  }}
                />
              )}
              {currentScreen === SCREENS.RESULTS && (
                <ResultsScreen
                  key="results"
                  riskValue={latestRiskValue}
                  onShowMap={() => setCurrentScreen(SCREENS.MAP)}
                />
              )}
              {currentScreen === SCREENS.MAP && (
                <SandboxMap
                  key="map"
                />
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Registration Modal Overlay — rendered on TOP, outside AnimatePresence */}
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
