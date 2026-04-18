import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { hasError: false };
  
  static getDerivedStateFromError() { 
    return { hasError: true }; 
  }
  
  componentDidCatch(error, info) {
    // You can log this somewhere later
    console.error('App crashed:', error, info);
  }
  
  render() {
    if (this.state.hasError) return (
      <div style={{ background: '#1C0A30', minHeight: '100vh', display: 'flex', 
        alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 24 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', 
          background: 'rgba(212,136,10,0.15)', display: 'flex', 
          alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
          ⚡
        </div>
        <p style={{ color: '#fff', fontFamily: 'Inter', fontSize: 20, fontWeight: 800, textAlign: 'center' }}>
          Something went wrong.
        </p>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter', fontSize: 14, textAlign: 'center' }}>
          We're on it. Try going back to home.
        </p>
        <button onClick={() => window.location.href = '/find-a-partner'}
          style={{ background: '#D4880A', color: '#fff', border: 'none',
            borderRadius: 999, padding: '12px 28px', fontFamily: 'Inter',
            fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          Back to Home
        </button>
      </div>
    );
    return this.props.children;
  }
}
