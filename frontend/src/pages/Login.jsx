import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiMail, FiLock, FiArrowRight } from 'react-icons/fi';
import { GoogleLogin } from '@react-oauth/google';
import toast from 'react-hot-toast';
import './Auth.css';

const Login = () => {
  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

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

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    try {
      const data = await googleLogin(credentialResponse.credential);
      toast.success(`Welcome, ${data.user.firstName}!`);
      if (data.user.role === 'admin') navigate('/admin-dashboard');
      else if (data.user.role === 'doctor') navigate('/doctor-dashboard');
      else navigate('/dashboard');
    } catch (error) {
      toast.error('Google Sign In failed. Ensure you ran the npm installs.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

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
          
          {/* New Google Authentication Button */}
          <div style={{ marginTop: '10px', marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => toast.error('Google authentication failed.')}
              useOneTap
            />
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
