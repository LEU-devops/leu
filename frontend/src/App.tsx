import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import HomePage from './pages/HomePage'
import BracketsPage from './pages/BracketsPage'
import SchedulePage from './pages/SchedulePage'
import AdminPage from './pages/AdminPage'
import StandingsPage from './pages/StandingsPage'
import EventsPage from './pages/EventsPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<AppLayout />}>
        <Route path="/home" element={<HomePage />} />
        <Route path="/chaveamentos/:code?" element={<BracketsPage />} />
        <Route path="/tabela" element={<SchedulePage />} />
        <Route path="/pontuacao" element={<StandingsPage />} />
        <Route path="/atletismo/:code?" element={<EventsPage type="atletismo" />} />
        <Route path="/natacao/:code?" element={<EventsPage type="natacao" />} />
        <Route path="/admin" element={<AdminPage />} />
      </Route>
    </Routes>
  )
}
