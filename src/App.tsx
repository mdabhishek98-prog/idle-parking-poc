import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage'
import DriverPage from './pages/DriverPage'
import OwnerPage from './pages/OwnerPage'
import AdminPage from './pages/AdminPage'
import { useStore } from './store/store'

export default function App() {
  const { db } = useStore()
  const adminAlerts = db.plots.filter(p => p.status === 'pending').length + db.disputes.filter(d => d.status === 'open').length

  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/" className="brand">
          <span className="logo">P</span>
          PlotPark
        </NavLink>
        <nav>
          <NavLink to="/driver">Find parking</NavLink>
          <NavLink to="/owner">Owner</NavLink>
          <NavLink to="/admin">Admin {adminAlerts > 0 && <span className="count">{adminAlerts}</span>}</NavLink>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/driver" element={<DriverPage />} />
          <Route path="/owner" element={<OwnerPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
