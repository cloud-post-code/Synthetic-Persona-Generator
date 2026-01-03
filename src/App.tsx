import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { User, LayoutDashboard, UserPlus, MessageSquare, PlayCircle, Settings, LogOut, Menu, X } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import HomePage from './views/HomePage.js';
import BuildPersonaPage from './views/BuildPersonaPage.js';
import ChatPage from './views/ChatPage.js';
import SimulationPage from './views/SimulationPage.js';
import GalleryPage from './views/GalleryPage.js';
import LoginPage from './views/LoginPage.js';
import SettingsPage from './views/SettingsPage.js';
import SyntheticUserDetail from './views/info/SyntheticUserDetail.js';
import AdvisorDetail from './views/info/AdvisorDetail.js';
import PracticePersonDetail from './views/info/PracticePersonDetail.js';

const MenuBar: React.FC = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = React.useState(false);

  const navItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Build Persona', path: '/build', icon: UserPlus },
    { label: 'Chat', path: '/chat', icon: MessageSquare },
    { label: 'Simulation', path: '/simulate', icon: PlayCircle },
    { label: 'My Personas', path: '/gallery', icon: User },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  if (!user) return null;

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">I</span>
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
                Instinct AI
              </span>
            </Link>
            <div className="hidden sm:ml-8 sm:flex sm:space-x-4">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`inline-flex items-center px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      isActive 
                        ? 'bg-indigo-50 text-indigo-700' 
                        : 'text-gray-600 hover:text-indigo-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="hidden sm:flex sm:items-center sm:ml-6">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">{user.username}</span>
              <button
                onClick={logout}
                className="p-2 text-gray-500 hover:text-red-600 transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex items-center sm:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="sm:hidden bg-white border-t border-gray-100">
          <div className="pt-2 pb-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center px-4 py-3 text-base font-medium ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 border-l-4 border-indigo-700'
                      : 'text-gray-600 hover:bg-gray-50 border-l-4 border-transparent'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.label}
                </Link>
              );
            })}
            <button
              onClick={logout}
              className="w-full flex items-center px-4 py-3 text-base font-medium text-gray-600 hover:bg-red-50 hover:text-red-700 transition-colors border-l-4 border-transparent"
            >
              <LogOut className="w-5 h-5 mr-3" />
              Logout
            </button>
          </div>
        </div>
      )}
    </nav>
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
        path="/gallery"
        element={
          <ProtectedRoute>
            <GalleryPage />
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
      <Route
        path="/info/practice-person"
        element={
          <ProtectedRoute>
            <PracticePersonDetail />
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
        <div className="min-h-screen flex flex-col">
          <MenuBar />
          <main className="flex-grow flex flex-col">
            <AppRoutes />
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
};

export default App;

