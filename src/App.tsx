import { HashRouter, Outlet, Route, Routes } from 'react-router-dom'
import { BottomNav, Sidebar } from './components/Sidebar'
import { LoginPage, SignupPage } from './features/auth/AuthPages'
import { ForgotPasswordPage, ResetPasswordPage } from './features/auth/PasswordReset'
import { RequireAuth } from './features/auth/session'
import { ClientsPage } from './features/clients/ClientsPage'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { FocusPage } from './features/focus/FocusPage'
import { HelpCenter } from './features/help/HelpCenter'
import { InvoiceEditor } from './features/invoices/InvoiceEditor'
import { InvoicesPage } from './features/invoices/InvoicesPage'
import { ProfilePage } from './features/profile/ProfilePage'
import { ReportsPage } from './features/reports/ReportsPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { TasksPage } from './features/tasks/TasksPage'
import { TimerEngine } from './features/timer/TimerEngine'
import { TimerGuardian } from './features/timer/TimerGuardian'

function Shell() {
  return (
    <RequireAuth>
      <div className="flex min-h-screen flex-col pb-40 md:flex-row md:pb-16">
        <Sidebar />
        <Outlet />
      </div>
      <BottomNav />
      <TimerEngine />
      <TimerGuardian />
      <HelpCenter />
    </RequireAuth>
  )
}

// HashRouter keeps deep links working on any static host without rewrite rules.
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route element={<Shell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/focus" element={<FocusPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/invoices/:id" element={<InvoiceEditor />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<DashboardPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
