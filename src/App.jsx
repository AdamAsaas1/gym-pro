import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GymProvider } from './context/GymContext';
import { PermissionProvider, usePermissions } from './context/PermissionContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import PermissionRender from './components/PermissionRender';
import Sidebar      from './components/Sidebar';
import Header       from './components/Header';
import Login        from './pages/Login';
import Dashboard   from './pages/Dashboard';
import Membres     from './pages/Membres';
import Planning    from './pages/Planning';
import Activites   from './pages/Activites';
import Abonnements from './pages/Abonnements';
import Coaches     from './pages/Coaches';
import Paiements   from './pages/Paiements';
import Permissions from './pages/Permissions';
import AdminNotifications from './pages/AdminNotifications';
import GestionAcces from './pages/GestionAcces';

function RequireAuth({ children }) {
  const { isAuthenticated, loadingAuth } = useAuth();
  if (loadingAuth) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function PublicOnly({ children }) {
  const { isAuthenticated, loadingAuth } = useAuth();
  if (loadingAuth) return null;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return children;
}

function ProtectedPage({ page, children }) {
  const { firstAllowedPage } = usePermissions();
  return (
    <PermissionRender page={page} fallback={<Navigate to={firstAllowedPage} replace />}>
      {children}
    </PermissionRender>
  );
}

function Layout() {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-main">
        <Header />
        <main className="app-content">
          <Routes>
            <Route path="/" element={<ProtectedPage page="/"><Dashboard /></ProtectedPage>} />
            <Route path="/acces" element={<ProtectedPage page="/acces"><GestionAcces /></ProtectedPage>} />
            <Route path="/membres" element={<ProtectedPage page="/membres"><Membres /></ProtectedPage>} />
            <Route path="/paiements" element={<ProtectedPage page="/paiements"><Paiements /></ProtectedPage>} />
            <Route path="/planning" element={<ProtectedPage page="/planning"><Planning /></ProtectedPage>} />
            <Route path="/activites" element={<ProtectedPage page="/activites"><Activites /></ProtectedPage>} />
            <Route path="/abonnements" element={<ProtectedPage page="/abonnements"><Abonnements /></ProtectedPage>} />
            <Route path="/coaches" element={<ProtectedPage page="/coaches"><Coaches /></ProtectedPage>} />
            <Route path="/notifications" element={<ProtectedPage page="/notifications"><AdminNotifications /></ProtectedPage>} />
            <Route path="/permissions" element={<ProtectedPage page="/permissions"><Permissions /></ProtectedPage>} />
            <Route path="*"            element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PermissionProvider>
        <GymProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
              <Route
                path="*"
                element={(
                  <RequireAuth>
                    <Layout />
                  </RequireAuth>
                )}
              />
            </Routes>
          </BrowserRouter>
        </GymProvider>
      </PermissionProvider>
    </AuthProvider>
  );
}
