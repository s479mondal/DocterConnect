import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiMail, FiLock, FiUser, FiPhone, FiArrowRight } from 'react-icons/fi';
import toast from 'react-hot-toast';
import './Auth.css';

const Register = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', password: '', confirmPassword: '',
    role: 'patient', phone: '', gender: 'male', registrationNumber: '', consultationFee: 0
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    // Password validation
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{6,}$/;
    if (!passwordRegex.test(formData.password)) {
      toast.error('Password must be at least 6 characters, contain 1 capital letter, 1 digit, and 1 special character');
      return;
    }

    // Phone number validation
    const phoneRegex = /^[6-9]{2}\d{8}$/;
    if (formData.phone && !phoneRegex.test(formData.phone)) {
      toast.error('Invalid phone number. Must be 10 digits starting with 6, 7, 8, or 9');
      return;
    }

    // Doctor registration number validation
    if (formData.role === 'doctor') {
      const regRegex = /^[A-Z0-9-]{3,40}$/i;
      if (!regRegex.test(formData.registrationNumber)) {
        toast.error('Gov Reg Number must be 3-20 characters long (e.g., AB241234 or REG-12345)');
        return;
      }
    }

    setLoading(true);
    try {
      const { confirmPassword, ...data } = formData;
      const result = await register(data);
      if (formData.role === 'doctor') {
        toast.success('Registration submitted! Your doctor profile is pending Admin verification. Please wait for an Admin to approve your account before logging in.', { duration: 6000 });
        navigate('/login');
      } else {
        toast.success(`Welcome, ${result.user?.firstName || 'User'}! 🎉`);
        navigate('/dashboard');
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <div className="auth-orb auth-orb-1"></div>
        <div className="auth-orb auth-orb-2"></div>
      </div>
      <div className="auth-container animate-fade-in">
        <div className="auth-card glass" style={{ maxWidth: 520 }}>
          <div className="auth-header">
            <h1>Create Account</h1>
            <p>Start your healthcare journey today</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-row">
              <div className="form-group">
                <label>First Name</label>
                <div className="input-icon-wrapper">
                  <FiUser className="input-icon" />
                  <input type="text" name="firstName" className="form-input" placeholder="First name" value={formData.firstName} onChange={handleChange} required />
                </div>
              </div>
              <div className="form-group">
                <label>Last Name</label>
                <div className="input-icon-wrapper">
                  <FiUser className="input-icon" />
                  <input type="text" name="lastName" className="form-input" placeholder="Last name" value={formData.lastName} onChange={handleChange} required />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label>Email</label>
              <div className="input-icon-wrapper">
                <FiMail className="input-icon" />
                <input type="email" name="email" className="form-input" placeholder="you@example.com" value={formData.email} onChange={handleChange} required />
              </div>
            </div>

            <div className="form-group">
              <label>Phone</label>
              <div className="input-icon-wrapper">
                <FiPhone className="input-icon" />
                <input type="tel" name="phone" className="form-input" placeholder="+91-XXXXXXXXXX" value={formData.phone} onChange={handleChange} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Role</label>
                <select name="role" className="form-select" value={formData.role} onChange={handleChange}>
                  <option value="patient">Patient</option>
                  <option value="doctor">Doctor</option>
                </select>
              </div>
              <div className="form-group">
                <label>Gender</label>
                <select name="gender" className="form-select" value={formData.gender} onChange={handleChange}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            {formData.role === 'doctor' && (
              <div className="form-row animate-fade-in">
                <div className="form-group">
                  <label>Gov Reg Number</label>
                  <input 
                    type="text" 
                    name="registrationNumber" 
                    className="form-input" 
                    placeholder="e.g. REG-12345" 
                    value={formData.registrationNumber} 
                    onChange={handleChange} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Consultation Fee (₹)</label>
                  <input 
                    type="number" 
                    name="consultationFee" 
                    className="form-input" 
                    placeholder="e.g. 500" 
                    value={formData.consultationFee} 
                    onChange={handleChange} 
                    required 
                    min="0"
                  />
                </div>
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label>Password</label>
                <div className="input-icon-wrapper">
                  <FiLock className="input-icon" />
                  <input type="password" name="password" className="form-input" placeholder="Min 6 characters" value={formData.password} onChange={handleChange} required minLength={6} />
                </div>
              </div>
              <div className="form-group">
                <label>Confirm Password</label>
                <div className="input-icon-wrapper">
                  <FiLock className="input-icon" />
                  <input type="password" name="confirmPassword" className="form-input" placeholder="Repeat password" value={formData.confirmPassword} onChange={handleChange} required />
                </div>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-lg auth-submit" disabled={loading}>
              {loading ? <span className="spinner" style={{width: 20, height: 20}}></span> : <>Create Account <FiArrowRight /></>}
            </button>
          </form>

          <div className="auth-footer">
            <p>Already have an account? <Link to="/login">Sign In</Link></p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
