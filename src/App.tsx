import React, { useRef } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { User, LayoutDashboard, UserPlus, PlayCircle, Settings, LogOut, Menu, X, Shield, Briefcase, Boxes, History, Trash2, Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { SimulationLogsBridgeProvider, useSimulationLogsBridge } from './context/SimulationLogsBridgeContext.js';
import HomePage from './views/HomePage.js';
import BuildPersonaPage from './views/BuildPersonaPage.js';
import ChatPage from './views/ChatPage.js';
import SimulationPage from './views/SimulationPage.js';
import SimulationsHubPage from './views/SimulationsHubPage.js';
import GalleryPage from './views/GalleryPage.js';
import LoginPage from './views/LoginPage.js';
import SettingsPage from './views/SettingsPage.js';
import BusinessProfilePage from './views/BusinessProfilePage.js';
import AdminPage from './views/AdminPage.js';
import SyntheticUserDetail from './views/info/SyntheticUserDetail.js';
import AdvisorDetail from './views/info/AdvisorDetail.js';
import { ApiErrorBanner } from './components/ApiErrorBanner.js';
// --- Global voice agent (⌘ mic dock + /voice/plan) — disabled; restore by uncommenting imports + wrapper below ---
// import { VoiceAgentProvider } from './voice/VoiceAgentProvider.js';
// import { VoiceAgentDock } from './voice/VoiceAgentDock.js';
import { useVoiceTarget } from './voice/useVoiceTarget.js';

const SidebarNavLink: React.FC<{
  to: string;
  label: string;
  icon: React.ElementType;
  isActive: boolean;
  voiceId: string;
  onNavigate: () => void;
}> = ({ to, label, icon: Icon, isActive, voiceId, onNavigate }) => {
  const linkRef = useRef<HTMLAnchorElement>(null);
  useVoiceTarget({
    id: voiceId,
    label: `Go to ${label}`,
    action: 'click',
    ref: linkRef,
  });
  return (
    <Link
      ref={linkRef}
      to={to}
      onClick={onNavigate}
      className={`flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
        isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-100 hover:text-indigo-600'
      }`}
    >
      <Icon className="w-5 h-5 mr-3" />
      {label}
    </Link>
  );
};

const SIMULATION_LOG_PREVIEW = 4;

const SidebarSimulationLogs: React.FC<{
  onAfterSelect: () => void;
}> = ({ onAfterSelect }) => {
  const location = useLocation();
  const bridge = useSimulationLogsBridge();
  const [expanded, setExpanded] = React.useState(false);

  React.useEffect(() => {
    setExpanded(false);
  }, [location.pathname]);

  const sessions = bridge?.sessions ?? [];
  const activeSessionId = bridge?.activeSessionId ?? null;
  const onSelectSession = bridge?.onSelectSession;
  const onDeleteSession = bridge?.onDeleteSession;
  const onClearAll = bridge?.onClearAll;
  const clearing = bridge?.clearing ?? false;
  const isAdmin = bridge?.isAdmin ?? false;

  const hasOverflow = sessions.length > SIMULATION_LOG_PREVIEW;
  const visible = expanded ? sessions : sessions.slice(0, SIMULATION_LOG_PREVIEW);

  return (
    <div className="shrink-0 border-t border-gray-200 px-3 py-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] leading-tight pt-0.5">
          Simulation logs
        </h3>
        {bridge && isAdmin && sessions.length > 0 ? (
          <button
            type="button"
            disabled={clearing}
            onClick={() => onClearAll && void onClearAll()}
            title="Admin: delete all simulation history for your account"
            className="shrink-0 flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-amber-900 hover:bg-amber-100 disabled:opacity-50"
          >
            {clearing ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden /> : <Trash2 className="w-3 h-3" aria-hidden />}
            Clear all
          </button>
        ) : null}
      </div>

      {!bridge ? (
        <p className="text-[10px] text-gray-500 leading-snug px-0.5 py-2">
          Open{' '}
          <Link
            to="/simulate"
            className="font-bold text-indigo-600 hover:text-indigo-800"
            onClick={() => onAfterSelect()}
          >
            Run simulation
          </Link>{' '}
          to view and manage your session history.
        </p>
      ) : sessions.length === 0 ? (
        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider text-center py-3">No history yet</p>
      ) : (
        <>
          <div className={expanded ? 'max-h-40 overflow-y-auto space-y-1 pr-0.5' : 'space-y-1'}>
            {visible.map((s) => (
              <div key={s.id} className="group relative">
                <button
                  type="button"
                  onClick={() => {
                    if (onSelectSession) void onSelectSession(s);
                    onAfterSelect();
                  }}
                  className={`w-full text-left p-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                    activeSessionId === s.id
                      ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <History className={`w-3.5 h-3.5 shrink-0 ${activeSessionId === s.id ? 'text-indigo-600' : 'opacity-30'}`} aria-hidden />
                  <span className="truncate pr-6">{s.name}</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    if (onDeleteSession) void onDeleteSession(e, s.id);
                  }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100"
                  aria-label={`Delete ${s.name}`}
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden />
                </button>
              </div>
            ))}
          </div>
          {hasOverflow ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 w-full text-center text-[10px] font-bold uppercase tracking-wider text-indigo-600 hover:text-indigo-800"
            >
              {expanded ? 'View less' : 'View more'}
            </button>
          ) : null}
        </>
      )}
    </div>
  );
};

const Sidebar: React.FC = () => {
  const location = useLocation();
  const { user, logout, isAdmin } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);

  const navItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Build simulation', path: '/simulations', icon: Boxes },
    { label: 'Run simulation', path: '/simulate', icon: PlayCircle },
    { label: 'Build Persona', path: '/build', icon: UserPlus },
    { label: 'My Personas', path: '/gallery', icon: User },
    { label: 'Business Profile', path: '/business-profile', icon: Briefcase },
    { label: 'Settings', path: '/settings', icon: Settings },
    ...(isAdmin ? [{ label: 'Admin', path: '/admin', icon: Shield }] : []),
  ];

  if (!user) return null;

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-white border border-gray-200 shadow-md text-gray-600 hover:text-gray-900 hover:bg-gray-50"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 z-40 flex flex-col transform transition-transform duration-300 ease-in-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-gray-200">
          <Link to="/" className="flex items-center gap-2" onClick={() => setIsMobileOpen(false)}>
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">I</span>
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
              Instinct AI
            </span>
          </Link>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 min-h-0 px-4 py-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            const voiceId = item.path === '/' ? 'nav.home' : `nav.${item.path.slice(1).replace(/\//g, '.')}`;
            return (
              <SidebarNavLink
                key={item.path}
                to={item.path}
                label={item.label}
                icon={Icon}
                isActive={isActive}
                voiceId={voiceId}
                onNavigate={() => setIsMobileOpen(false)}
              />
            );
          })}
        </nav>

        <SidebarSimulationLogs onAfterSelect={() => setIsMobileOpen(false)} />

        {/* User section */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700 truncate">{user.username}</span>
          </div>
          <button
            onClick={() => {
              setIsMobileOpen(false);
              logout();
            }}
            className="w-full flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-700 transition-colors"
          >
            <LogOut className="w-5 h-5 mr-2" />
            Logout
          </button>
        </div>

        {/* Close button for mobile */}
        <button
          onClick={() => setIsMobileOpen(false)}
          className="lg:hidden absolute top-4 right-4 p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
        >
          <X className="w-5 h-5" />
        </button>
      </aside>
    </>
  );
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/build"
        element={
          <ProtectedRoute>
            <BuildPersonaPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat/:id"
        element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/simulate"
        element={
          <ProtectedRoute>
            <SimulationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/simulations"
        element={
          <ProtectedRoute>
            <SimulationsHubPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/business-profile"
        element={
          <ProtectedRoute>
            <BusinessProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/gallery"
        element={
          <ProtectedRoute>
            <GalleryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/library"
        element={
          <ProtectedRoute>
            <Navigate to="/gallery?tab=library" replace />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminPage />
          </AdminRoute>
        }
      />
      <Route
        path="/info/synthetic-user"
        element={
          <ProtectedRoute>
            <SyntheticUserDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/info/advisor"
        element={
          <ProtectedRoute>
            <AdvisorDetail />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <SimulationLogsBridgeProvider>
          {/* VoiceAgentProvider: wraps app for global navigator agent + task tracker. Re-enable with VoiceAgentDock. */}
          <div className="min-h-screen flex">
            <Sidebar />
            <main className="flex-1 lg:ml-64 flex flex-col">
              <AppRoutes />
            </main>
          </div>
          {/* <VoiceAgentDock /> */}
          <ApiErrorBanner />
        </SimulationLogsBridgeProvider>
      </Router>
    </AuthProvider>
  );
};

export default App;

