import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiMail, FiLock, FiArrowRight } from 'react-icons/fi';
import { useGoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import toast from 'react-hot-toast';
import './Auth.css';

const Login = () => {
  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await login(formData.email, formData.password);
      toast.success(`Welcome back, ${data.user.firstName}!`);
      if (data.user.role === 'admin') navigate('/admin-dashboard');
      else if (data.user.role === 'doctor') navigate('/doctor-dashboard');
      else navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      try {
        const userInfoRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
        });
        const googleUser = userInfoRes.data;

        const data = await googleLogin(tokenResponse.access_token, googleUser);
        toast.success(`Welcome, ${data.user.firstName}!`);
        if (data.user.role === 'admin') navigate('/admin-dashboard');
        else if (data.user.role === 'doctor') navigate('/doctor-dashboard');
        else navigate('/dashboard');
      } catch (error) {
        toast.error(error.response?.data?.error || 'Google Sign In failed. Please try again.');
        console.error('Google Sign In error:', error);
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: (error) => {
      toast.error('Google authentication was cancelled or failed.');
      console.error('Google OAuth error:', error);
    }
  });

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <div className="auth-orb auth-orb-1"></div>
        <div className="auth-orb auth-orb-2"></div>
      </div>
      <div className="auth-container animate-fade-in">
        <div className="auth-card glass">
          <div className="auth-header">
            <h1>Welcome Back</h1>
            <p>Sign in to continue your health journey</p>
          </div>
          
          {/* Google Authentication Button */}
          <div style={{ marginTop: '10px', marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => handleGoogleSignIn()}
              disabled={googleLoading || loading}
              style={{
                width: '100%',
                maxWidth: '320px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                padding: '10px 16px',
                backgroundColor: '#ffffff',
                color: '#374151',
                border: '1px solid #D1D5DB',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#F9FAFB'; e.currentTarget.style.borderColor = '#9CA3AF'; }}
              onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; e.currentTarget.style.borderColor = '#D1D5DB'; }}
            >
              {googleLoading ? (
                <span className="spinner" style={{ width: 18, height: 18, borderTopColor: '#374151' }}></span>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.616z" fill="#4285F4"/>
                    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                  </svg>
                  <span>Sign in with Google</span>
                </>
              )}
            </button>
          </div>

          <div style={{ textAlign: 'center', margin: '15px 0', color: '#6B7280', fontSize: '13px', fontWeight: 'bold' }}>
            OR SIGN IN WITH EMAIL
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <div className="input-icon-wrapper">
                <FiMail className="input-icon" />
                <input
                  id="email"
                  type="email"
                  className="form-input"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="input-icon-wrapper">
                <FiLock className="input-icon" />
                <input
                  id="password"
                  type="password"
                  className="form-input"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-lg auth-submit" disabled={loading}>
              {loading ? <span className="spinner" style={{width: 20, height: 20}}></span> : <>Sign In <FiArrowRight /></>}
            </button>
          </form>

          <div className="auth-footer">
            <p>Don't have an account? <Link to="/register">Create one</Link></p>
          </div>

          <div className="demo-accounts">
            <p className="demo-title">Demo Accounts</p>
            <div className="demo-cards">
              <button className="demo-card" onClick={() => setFormData({ email: 'patient1@demo.com', password: 'password123' })}>
                <span className="demo-role">Patient</span>
                <span className="demo-email">patient1@demo.com</span>
              </button>
              <button className="demo-card" onClick={() => setFormData({ email: 'dr.kumar@demo.com', password: 'password123' })}>
                <span className="demo-role">Doctor</span>
                <span className="demo-email">dr.kumar@demo.com</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
