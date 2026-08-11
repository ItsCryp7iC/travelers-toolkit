import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import Dashboard from './pages/Dashboard'
import Planner from './pages/Planner'
import Inventory from './pages/Inventory'
import Characters from './pages/Characters'
import Weapons from './pages/Weapons'
import PlaceholderPage from './pages/PlaceholderPage'
import Settings from './pages/Settings'
import DevBuilder from './pages/DevBuilder'
import useStore from './store/useStore'

export default function App() {
  const showDbBuilder = useStore((s) => s.showDbBuilder)
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route
            path="characters"
            element={<Characters />}
          />
          <Route
            path="weapons"
            element={<Weapons />}
          />
          <Route path="planner"   element={<Planner />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="settings" element={<Settings />} />
          <Route path="builder" element={showDbBuilder ? <DevBuilder /> : <Navigate to="/" replace />} />
          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
