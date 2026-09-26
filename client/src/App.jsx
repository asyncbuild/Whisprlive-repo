import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { trackPageView } from './utils/analytics';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import PublicAskPage from './pages/PublicAskPage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import RefundPage from './pages/RefundPage';
import WelcomePage from './pages/WelcomePage';
import NotFoundPage from './pages/NotFoundPage';
import FeedbackWidget from './components/FeedbackWidget';

// Protected Route Guard for the Host Dashboard
function ProtectedRoute({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/" replace />;
}

// Track pageviews on SPA route changes for GA4 & reset scroll to top
function RouteTracker() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search]);

  return null;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <div className="whisprlive-root">
            <Router>
            <RouteTracker />
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/signup" element={<AuthPage mode="signup" />} />
              <Route path="/signin" element={<AuthPage mode="signin" />} />

              {/* Discovery & Motivating Onboarding */}
              <Route path="/try" element={<WelcomePage />} />
              <Route path="/welcome" element={<WelcomePage />} />

              {/* Compliance & Policy Pages */}
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/refund" element={<RefundPage />} />

              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />

              {/* Dynamic route for the public audience link */}
              <Route path="/ask/:roomCode" element={<PublicAskPage />} />

              {/* Custom 404 Not Found Page */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
            <FeedbackWidget />
          </Router>
        </div>
      </ToastProvider>
    </AuthProvider>
  </ThemeProvider>
  );
}