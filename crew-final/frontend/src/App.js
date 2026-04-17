import { lazy, Suspense, Component } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { Toaster } from './components/ui/sonner';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

const Home           = lazy(() => import('./pages/Home'));
const HowItWorks     = lazy(() => import('./pages/HowItWorks'));
const FindAPartner   = lazy(() => import('./pages/FindAPartner'));
const Events         = lazy(() => import('./pages/Events'));
const About          = lazy(() => import('./pages/About'));
const GetStarted     = lazy(() => import('./pages/GetStarted'));
const AuthCallback   = lazy(() => import('./pages/AuthCallback'));
const AthleteProfile = lazy(() => import('./pages/AthleteProfile'));
const MyConnections  = lazy(() => import('./pages/MyConnections'));
const EditProfile    = lazy(() => import('./pages/EditProfile'));
const PrivacyPolicy  = lazy(() => import('./pages/PrivacyPolicy'));
const Terms          = lazy(() => import('./pages/Terms'));

function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1C0A30' }}>
      <div style={{ width: 40, height: 40, border: '3px solid #D4880A', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );
}

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error('[CREW] ErrorBoundary caught:', error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100vh', background: '#1C0A30',
          gap: 16, padding: 24, textAlign: 'center'
        }}>
          <p style={{ color: '#D4880A', fontFamily: 'Inter, sans-serif', fontSize: 28, fontWeight: 800, letterSpacing: '-1px' }}>
            CREW
          </p>
          <p style={{ color: '#fff', fontFamily: 'Inter, sans-serif', fontSize: 16, fontWeight: 600, maxWidth: 400 }}>
            We're experiencing high demand right now.
          </p>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontFamily: 'Inter, sans-serif', fontSize: 13, maxWidth: 400, lineHeight: 1.7 }}>
            If you continue to face issues, please email us at{' '}
            <a href="mailto:mycrew.find@gmail.com" style={{ color: '#D4880A', textDecoration: 'none' }}>
              mycrew.find@gmail.com
            </a>
            {' '}and we'll get you sorted.
          </p>
          <button
            onClick={() => window.location.href = '/'}
            style={{
              padding: '10px 24px', background: '#D4880A', color: '#fff',
              border: 'none', borderRadius: 999, fontFamily: 'Inter, sans-serif',
              fontWeight: 700, cursor: 'pointer', fontSize: 14, marginTop: 8
            }}>
            Back to Home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  return (
    <div className="min-h-screen flex flex-col" style={{ fontFamily: 'Inter, sans-serif' }}>
      <Navbar />
      <main className="flex-1">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/get-started" element={<GetStarted />} />
            <Route path="/" element={<Home />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/events" element={<Events />} />
            <Route path="/events/:slug" element={<Events />} />
            <Route path="/about" element={<About />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/find-a-partner" element={<ProtectedRoute><FindAPartner /></ProtectedRoute>} />
            <Route path="/athlete/:id" element={<ProtectedRoute><AthleteProfile /></ProtectedRoute>} />
            <Route path="/my-connections" element={<ProtectedRoute><MyConnections /></ProtectedRoute>} />
            <Route path="/profile/edit" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AuthProvider>
          <AppContent />
          <Toaster position="top-center" richColors />
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
