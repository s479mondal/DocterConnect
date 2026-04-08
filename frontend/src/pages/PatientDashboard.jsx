import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { appointmentAPI } from '../services/api';
import { FiCalendar, FiClock, FiCheckCircle, FiXCircle, FiActivity } from 'react-icons/fi';
import { RiStethoscopeLine } from 'react-icons/ri';
import './Dashboard.css';

const PatientDashboard = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, upcoming: 0, completed: 0, cancelled: 0 });

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      const { data } = await appointmentAPI.getPatientAppointments({ limit: 50 });
      const appts = data.appointments || [];
      setAppointments(appts);
      setStats({
        total: appts.length,
        upcoming: appts.filter(a => ['pending', 'confirmed'].includes(a.status)).length,
        completed: appts.filter(a => a.status === 'completed').length,
        cancelled: appts.filter(a => a.status === 'cancelled').length
      });
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const upcomingAppts = appointments
    .filter(a => ['pending', 'confirmed'].includes(a.status))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5);

  const getStatusBadge = (status) => {
    const map = { pending: 'badge-warning', confirmed: 'badge-info', completed: 'badge-success', cancelled: 'badge-danger', 'in-progress': 'badge-primary' };
    return <span className={`badge ${map[status] || 'badge-info'}`}>{status}</span>;
  };

  if (loading) return <div className="page-loading"><div className="spinner"></div></div>;

  return (
    <div className="dashboard-page">
      <div className="container">
        <div className="dashboard-header animate-fade-in">
          <div>
            <h1>Welcome, {user?.firstName}! 👋</h1>
            <p className="dashboard-subtitle">Here's your health overview</p>
          </div>
          <Link to="/doctors" className="btn btn-primary">
            <RiStethoscopeLine /> Find a Doctor
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid animate-fade-in">
          <div className="stat-card-dash glass">
            <div className="stat-icon" style={{background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary-light)'}}><FiCalendar /></div>
            <div className="stat-content">
              <span className="stat-number">{stats.total}</span>
              <span className="stat-text">Total Appointments</span>
            </div>
          </div>
          <div className="stat-card-dash glass">
            <div className="stat-icon" style={{background: 'rgba(59, 130, 246, 0.15)', color: 'var(--info)'}}><FiClock /></div>
            <div className="stat-content">
              <span className="stat-number">{stats.upcoming}</span>
              <span className="stat-text">Upcoming</span>
            </div>
          </div>
          <div className="stat-card-dash glass">
            <div className="stat-icon" style={{background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)'}}><FiCheckCircle /></div>
            <div className="stat-content">
              <span className="stat-number">{stats.completed}</span>
              <span className="stat-text">Completed</span>
            </div>
          </div>
          <div className="stat-card-dash glass">
            <div className="stat-icon" style={{background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)'}}><FiXCircle /></div>
            <div className="stat-content">
              <span className="stat-number">{stats.cancelled}</span>
              <span className="stat-text">Cancelled</span>
            </div>
          </div>
        </div>

        {/* Upcoming Appointments */}
        <div className="dashboard-section animate-fade-in">
          <div className="section-header">
            <h2><FiActivity /> Upcoming Appointments</h2>
            <Link to="/appointments" className="btn btn-secondary btn-sm">View All</Link>
          </div>
          {upcomingAppts.length === 0 ? (
            <div className="empty-state card">
              <div className="empty-state-icon">📅</div>
              <h3>No upcoming appointments</h3>
              <p>Book an appointment with a doctor to get started</p>
              <Link to="/doctors" className="btn btn-primary" style={{marginTop: '1rem'}}>Find a Doctor</Link>
            </div>
          ) : (
            <div className="appointments-list">
              {upcomingAppts.map((appt) => (
                <div key={appt._id} className="appointment-item card">
                  <div className="appt-avatar">
                    {appt.doctorName?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="appt-info">
                    <h4>{appt.doctorName?.startsWith('Dr.') ? appt.doctorName : `Dr. ${appt.doctorName}`}</h4>
                    <p className="appt-spec">{appt.doctorSpecialization || 'Specialist'}</p>
                    <div className="appt-time">
                      <FiCalendar /> {new Date(appt.date).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
                      <FiClock /> {appt.timeSlot?.startTime} - {appt.timeSlot?.endTime}
                    </div>
                  </div>
                  <div className="appt-status">
                    {getStatusBadge(appt.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PatientDashboard;
