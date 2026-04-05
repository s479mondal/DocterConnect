import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiMenu, FiX, FiUser, FiLogOut, FiCalendar, FiGrid } from 'react-icons/fi';
import { RiStethoscopeLine } from 'react-icons/ri';
import './Navbar.css';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
    setMenuOpen(false);
  };

  return (
    <nav className="navbar glass">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand" onClick={() => setMenuOpen(false)}>
          <div className="brand-icon">
            <RiStethoscopeLine />
          </div>
          <span className="brand-text">Doctor<span className="brand-accent">Connect</span></span>
        </Link>

        <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
          {menuOpen ? <FiX /> : <FiMenu />}
        </button>

        <div className={`navbar-menu ${menuOpen ? 'active' : ''}`}>
          {(!user || user.role === 'patient') && (
            <Link to="/doctors" className="nav-link" onClick={() => setMenuOpen(false)}>
              <RiStethoscopeLine /> Find Doctors
            </Link>
          )}

          {user ? (
            <>
              <Link
                to={user.role === 'admin' ? '/admin-dashboard' : user.role === 'doctor' ? '/doctor-dashboard' : '/dashboard'}
                className="nav-link"
                onClick={() => setMenuOpen(false)}
              >
                <FiGrid /> {user.role === 'admin' ? 'Admin Panel' : 'Dashboard'}
              </Link>
              {user.role !== 'admin' && (
                <Link to="/appointments" className="nav-link" onClick={() => setMenuOpen(false)}>
                  <FiCalendar /> Appointments
                </Link>
              )}
              <div className="nav-user">
                <div className="user-avatar">
                  {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
                </div>
                <span className="user-name">{user.firstName}</span>
                <span className="user-role badge badge-primary">{user.role}</span>
                <button className="btn-logout" onClick={handleLogout} title="Logout">
                  <FiLogOut />
                </button>
              </div>
            </>
          ) : (
            <div className="nav-auth">
              <Link to="/login" className="btn btn-secondary btn-sm" onClick={() => setMenuOpen(false)}>
                Sign In
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm" onClick={() => setMenuOpen(false)}>
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
