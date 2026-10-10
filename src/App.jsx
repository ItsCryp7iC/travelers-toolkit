import React, { useEffect, useRef, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import Dashboard from './pages/Dashboard'
import useStore from './store/useStore'

const Planner = lazy(() => import('./pages/Planner'))
const Inventory = lazy(() => import('./pages/Inventory'))
const Characters = lazy(() => import('./pages/Characters'))
const Weapons = lazy(() => import('./pages/Weapons'))
const Achievements = lazy(() => import('./pages/Achievements'))
const Settings = lazy(() => import('./pages/Settings'))
const DevBuilder = lazy(() => import('./pages/DevBuilder'))
const Changelog = lazy(() => import('./pages/Changelog'))

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center w-full h-full min-h-[50vh]">
      <span className="text-[var(--color-text-muted)] text-sm animate-pulse">Loading...</span>
    </div>
  )
}

const withSuspense = (Component) => (
  <Suspense fallback={<LoadingFallback />}>
    <Component />
  </Suspense>
)

export default function App() {
  const showDbBuilder = useStore((s) => s.showDbBuilder)
  const checkHoyolabSession = useStore((s) => s.checkHoyolabSession)
  const handleSyncNotes = useStore((s) => s.handleSyncNotes)
  const checkGoogleSession = useStore((s) => s.checkGoogleSession)
  const isInitializing = useRef(true)

  useEffect(() => {
    if (isInitializing.current) {
      isInitializing.current = false;
      checkHoyolabSession().then((isConnected) => {
        if (isConnected) {
          handleSyncNotes(true);
        }
      });
      checkGoogleSession();
    }
  }, [checkHoyolabSession, handleSyncNotes, checkGoogleSession]);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route
            path="characters"
            element={withSuspense(Characters)}
          />
          <Route
            path="weapons"
            element={withSuspense(Weapons)}
          />
          <Route path="planner"   element={withSuspense(Planner)} />
          <Route path="inventory" element={withSuspense(Inventory)} />
          <Route path="achievements" element={withSuspense(Achievements)} />
          <Route path="changelog" element={withSuspense(Changelog)} />
          <Route path="settings" element={withSuspense(Settings)} />
          <Route path="builder" element={showDbBuilder ? withSuspense(DevBuilder) : <Navigate to="/" replace />} />
          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
