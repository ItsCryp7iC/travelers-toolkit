import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import Dashboard from './pages/Dashboard'
import Planner from './pages/Planner'
import Inventory from './pages/Inventory'
import Characters from './pages/Characters'
import Weapons from './pages/Weapons'
import PlaceholderPage from './pages/PlaceholderPage'

export default function App() {
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
          <Route
            path="settings"
            element={
              <PlaceholderPage
                title="Settings"
                icon="⚙️"
                description="Customize your planner preferences, export/import your roster data, and more."
              />
            }
          />
          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
