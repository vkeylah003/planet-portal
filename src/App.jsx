import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { FullPageLoader } from './components/ui'
import { isSupabaseConfigured } from './lib/supabase'

import Landing from './pages/Landing'
import PartnerHome from './pages/PartnerHome'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import SetupNotice from './pages/SetupNotice'

// Guard: must be signed in AND an admin.
function RequireAdmin({ children }) {
  const { session, isAdmin, loading } = useAuth()
  if (loading) return <FullPageLoader />
  if (!session || !isAdmin) return <Navigate to="/admin/login" replace />
  return children
}

function AppRoutes() {
  if (!isSupabaseConfigured) return <SetupNotice />

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      {/* Partners enter via their unguessable private link — no login. */}
      <Route path="/partner/:token" element={<PartnerHome />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminDashboard />
          </RequireAdmin>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
