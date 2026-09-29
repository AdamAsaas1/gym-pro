import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
import Settings from './pages/Settings';
import Boutique from './pages/Boutique';
import LiveShow from './pages/LiveShow';
import Shop from './pages/Shop';

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

function ForceSettingsRedirect({ children }) {
  return children;
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
            <Route path="/live" element={<ProtectedPage page="/live"><LiveShow /></ProtectedPage>} />
            <Route path="/paiements" element={<ProtectedPage page="/paiements"><Paiements /></ProtectedPage>} />
            <Route path="/planning" element={<ProtectedPage page="/planning"><Planning /></ProtectedPage>} />
            <Route path="/activites" element={<ProtectedPage page="/activites"><Activites /></ProtectedPage>} />
            <Route path="/abonnements" element={<ProtectedPage page="/abonnements"><Abonnements /></ProtectedPage>} />
            <Route path="/coaches" element={<ProtectedPage page="/coaches"><Coaches /></ProtectedPage>} />
            <Route path="/notifications" element={<ProtectedPage page="/notifications"><AdminNotifications /></ProtectedPage>} />
            <Route path="/boutique"    element={<ProtectedPage page="/boutique"><Boutique /></ProtectedPage>} />
            <Route path="/permissions" element={<ProtectedPage page="/permissions"><Permissions /></ProtectedPage>} />
            <Route path="/settings"    element={<ProtectedPage page="/settings"><Settings /></ProtectedPage>} />
            <Route path="*"            element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const { i18n } = useTranslation();

  useEffect(() => {
    document.documentElement.dir = i18n.dir();
    document.documentElement.lang = i18n.language;
  }, [i18n, i18n.language]);

  return (
    <AuthProvider>
      <PermissionProvider>
        <GymProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
              {/* Public online shop (linked from Instagram): no login required */}
              <Route path="/shop" element={<Shop />} />
              <Route
                path="*"
                element={(
                  <RequireAuth>
                    <ForceSettingsRedirect>
                      <Layout />
                    </ForceSettingsRedirect>
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
