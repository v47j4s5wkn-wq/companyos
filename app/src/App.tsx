import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth-context'
import { FrontDoor } from './routes/FrontDoor'
import { GetStarted } from './routes/GetStarted'
import { SignIn } from './routes/SignIn'
import { ResetPasswordRequest, ResetPasswordConfirm } from './routes/ResetPassword'
import { AcceptInvite } from './routes/AcceptInvite'
import { Home } from './routes/Home'
import { Team } from './routes/Team'

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return null
  if (!session) return <Navigate to="/" replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<FrontDoor />} />
      <Route path="/get-started" element={<GetStarted />} />
      <Route path="/sign-in" element={<SignIn />} />
      <Route path="/reset-password" element={<ResetPasswordRequest />} />
      <Route path="/reset-password/confirm" element={<ResetPasswordConfirm />} />
      <Route path="/accept-invite/:token" element={<AcceptInvite />} />
      <Route path="/home" element={<RequireAuth><Home /></RequireAuth>} />
      <Route path="/team" element={<RequireAuth><Team /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
