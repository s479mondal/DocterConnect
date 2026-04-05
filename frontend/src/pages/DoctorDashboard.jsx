import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { appointmentAPI, doctorAPI } from '../services/api';
import { FiCalendar, FiClock, FiCheckCircle, FiXCircle, FiUsers, FiCheck, FiX, FiUser } from 'react-icons/fi';
import DoctorProfileEdit from '../components/DoctorProfileEdit';
import toast from 'react-hot-toast';
import './Dashboard.css';

const DoctorDashboard = () => {
  const { user } = useAuth();
  const [doctorProfile, setDoctorProfile] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, today: 0, pending: 0, completed: 0, cancelled: 0 });
  const [activeTab, setActiveTab] = useState('appointments');

  useEffect(() => {
    fetchDoctorData();
  }, []);

  const fetchDoctorData = async () => {
    try {
      const { data: docData } = await doctorAPI.getByUserId(user.id);
      setDoctorProfile(docData.doctor);

      if (docData.doctor) {
        const { data: apptData } = await appointmentAPI.getDoctorAppointments(docData.doctor._id, { limit: 50 });
        const appts = apptData.appointments || [];
        setAppointments(appts);

        const today = new Date().toDateString();
        setStats({
          total: appts.length,
          today: appts.filter(a => new Date(a.date).toDateString() === today).length,
          pending: appts.filter(a => a.status === 'pending').length,
          completed: appts.filter(a => a.status === 'completed').length,
          cancelled: appts.filter(a => a.status === 'cancelled').length
        });
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatus = async (apptId, status, version) => {
    try {
      await appointmentAPI.updateStatus(apptId, { status, version });
      toast.success(`Appointment ${status}`);
      fetchDoctorData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update');
    }
  };

  const pendingAppts = appointments.filter(a => a.status === 'pending');
  const todayAppts = appointments.filter(a => {
    const today = new Date().toDateString();
    return new Date(a.date).toDateString() === today && ['confirmed', 'pending'].includes(a.status);
  });

  const getStatusBadge = (status) => {
    const map = { pending: 'badge-warning', confirmed: 'badge-info', completed: 'badge-success', cancelled: 'badge-danger' };
    return <span className={`badge ${map[status] || 'badge-info'}`}>{status}</span>;
  };

  if (loading) return <div className="page-loading"><div className="spinner"></div></div>;

  return (
    <div className="dashboard-page">
      <div className="container">
        <div className="dashboard-header animate-fade-in">
          <div>
            <h1>Dr. {user?.firstName}'s Dashboard 🩺</h1>
            <p className="dashboard-subtitle">Manage your appointments and patients</p>
          </div>
          <div className="tab-navigation glass">
            <button 
              className={`tab-btn ${activeTab === 'appointments' ? 'active' : ''}`}
              onClick={() => setActiveTab('appointments')}
            >
              <FiCalendar /> Appointments
            </button>
            <button 
              className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <FiUser /> Profile Settings
            </button>
          </div>
        </div>

        {activeTab === 'appointments' ? (
          <>
            {/* Stats */}
        <div className="stats-grid animate-fade-in">
          <div className="stat-card-dash glass">
            <div className="stat-icon" style={{background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary-light)'}}><FiUsers /></div>
            <div className="stat-content">
              <span className="stat-number">{stats.total}</span>
              <span className="stat-text">Total Appointments</span>
            </div>
          </div>
          <div className="stat-card-dash glass">
            <div className="stat-icon" style={{background: 'rgba(6, 214, 160, 0.15)', color: 'var(--accent)'}}><FiCalendar /></div>
            <div className="stat-content">
              <span className="stat-number">{stats.today}</span>
              <span className="stat-text">Today</span>
            </div>
          </div>
          <div className="stat-card-dash glass">
            <div className="stat-icon" style={{background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)'}}><FiClock /></div>
            <div className="stat-content">
              <span className="stat-number">{stats.pending}</span>
              <span className="stat-text">Pending</span>
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
            <div className="stat-icon" style={{background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444'}}><FiXCircle /></div>
            <div className="stat-content">
              <span className="stat-number">{stats.cancelled}</span>
              <span className="stat-text">Cancelled</span>
            </div>
          </div>
        </div>

        {/* Pending Approvals */}
        {pendingAppts.length > 0 && (
          <div className="dashboard-section animate-fade-in">
            <div className="section-header">
              <h2><FiClock /> Pending Approvals ({pendingAppts.length})</h2>
            </div>
            <div className="appointments-list">
              {pendingAppts.map((appt) => (
                <div key={appt._id} className="appointment-item card">
                  <div className="appt-avatar" style={{background: 'var(--gradient-accent)'}}>
                    {appt.patientName?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="appt-info">
                    <h4>{appt.patientName}</h4>
                    <p className="appt-spec" style={{textTransform: 'capitalize'}}>{appt.type} • {appt.reason || 'No reason specified'}</p>
                    <div className="appt-time">
                      <FiCalendar /> {new Date(appt.date).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
                      <FiClock /> {appt.timeSlot?.startTime} - {appt.timeSlot?.endTime}
                    </div>
                  </div>
                  <div className="appt-actions">
                    <button className="btn btn-sm" style={{background: 'var(--success)', color: 'white'}} onClick={() => handleStatus(appt._id, 'confirmed', appt.version)}>
                      <FiCheck /> Confirm
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleStatus(appt._id, 'cancelled', appt.version)}>
                      <FiX /> Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Today's Appointments */}
        <div className="dashboard-section animate-fade-in">
          <div className="section-header">
            <h2><FiCalendar /> Today's Schedule</h2>
          </div>
          {todayAppts.length === 0 ? (
            <div className="empty-state card">
              <div className="empty-state-icon">📅</div>
              <h3>No appointments today</h3>
              <p>Enjoy your day off!</p>
            </div>
          ) : (
            <div className="appointments-list">
              {todayAppts.map((appt) => (
                <div key={appt._id} className="appointment-item card">
                  <div className="appt-avatar" style={{background: 'var(--gradient-accent)'}}>
                    {appt.patientName?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="appt-info">
                    <h4>{appt.patientName}</h4>
                    <p className="appt-spec" style={{textTransform: 'capitalize'}}>{appt.type}</p>
                    <div className="appt-time">
                      <FiClock /> {appt.timeSlot?.startTime} - {appt.timeSlot?.endTime}
                    </div>
                  </div>
                  <div className="appt-status">
                    {getStatusBadge(appt.status)}
                    {appt.status === 'confirmed' && (
                      <button className="btn btn-sm" style={{background: 'var(--success)', color: 'white', marginTop: '0.5rem'}} onClick={() => handleStatus(appt._id, 'completed', appt.version)}>
                        Complete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        </>
        ) : (
          <DoctorProfileEdit profile={doctorProfile} onUpdate={fetchDoctorData} />
        )}
      </div>
    </div>
  );
};

export default DoctorDashboard;
