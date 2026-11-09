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
import OrganizationsPage from './pages/OrganizationsPage'
import OrganizationDetailPage from './pages/OrganizationDetailPage'
import OrganizationMembersPage from './pages/OrganizationMembersPage'
import OrganizationIdentityPage from './pages/OrganizationIdentityPage'
import OrganizationSportsPage from './pages/OrganizationSportsPage'
import SportsTeamPage from './pages/SportsTeamPage'
import OrganizationCopasPage from './pages/OrganizationCopasPage'
import PublicProfilePage from './pages/PublicProfilePage'
import ProfilePage from './pages/ProfilePage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<AppLayout />}>
        <Route path="/home" element={<HomePage />} />
        <Route path="/entidades" element={<OrganizationsPage />} />
        <Route path="/entidades/:id" element={<OrganizationDetailPage />} />
        <Route path="/entidades/:id/membros" element={<OrganizationMembersPage />} />
        <Route path="/entidades/:id/identidade" element={<OrganizationIdentityPage />} />
        <Route path="/entidades/:id/esportes" element={<OrganizationSportsPage />} />
        <Route path="/entidades/:id/copas" element={<OrganizationCopasPage />} />
        <Route path="/times/:id" element={<SportsTeamPage />} />
        <Route path="/pessoas/:email" element={<PublicProfilePage />} />
        <Route path="/perfil" element={<ProfilePage />} />
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
