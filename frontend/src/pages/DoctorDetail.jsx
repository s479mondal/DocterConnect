import { useState, useEffect } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { doctorAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { FiMapPin, FiStar, FiClock, FiCalendar, FiAward, FiPhone, FiMail } from 'react-icons/fi';
import { RiStethoscopeLine } from 'react-icons/ri';
import './DoctorDetail.css';

const DoctorDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);

  // Moved fetch logic up
  const fetchDoctor = async () => {
    try {
      const { data } = await doctorAPI.getById(id);
      setDoctor(data.doctor);
    } catch (error) {
      console.error('Error fetching doctor:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctor();
  }, [id]);

  if (user?.role === 'doctor') {
    return <Navigate to="/doctor-dashboard" />;
  }


  if (loading) return <div className="page-loading"><div className="spinner"></div></div>;
  if (!doctor) return <div className="empty-state"><h3>Doctor not found</h3></div>;

  const daysMap = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };

  return (
    <div className="doctor-detail-page">
      <div className="container">
        <div className="detail-grid animate-fade-in">
          {/* Main Info */}
          <div className="detail-main">
            <div className="detail-hero glass">
              <div className="detail-hero-top">
                <div className="detail-avatar">
                  {doctor.firstName?.charAt(0)}{doctor.lastName?.charAt(0)}
                </div>
                <div className="detail-info">
                  <div className="detail-badges">
                    {doctor.isVerified && <span className="badge badge-success">✓ Verified</span>}
                    <span className="badge badge-primary">{doctor.specialization}</span>
                  </div>
                  <h1>Dr. {doctor.firstName} {doctor.lastName}</h1>
                  <p className="detail-spec"><RiStethoscopeLine /> {doctor.specialization}</p>
                  <div className="detail-meta-row">
                    <span><FiMapPin /> {doctor.hospital?.name}, {doctor.hospital?.city}</span>
                    <span><FiClock /> {doctor.experience}+ years experience</span>
                    <span><FiStar style={{color: 'var(--warning)'}} /> {doctor.rating?.average?.toFixed(1)} ({doctor.rating?.count} reviews)</span>
                  </div>
                </div>
              </div>
              <p className="detail-bio">{doctor.bio}</p>
            </div>

            {/* Qualifications */}
            <div className="detail-section card">
              <h2><FiAward /> Qualifications</h2>
              <div className="qual-list">
                {doctor.qualifications?.map((q, i) => (
                  <div key={i} className="qual-item">
                    <span className="qual-degree">{q.degree}</span>
                    <span className="qual-inst">{q.institution}</span>
                    <span className="qual-year">{q.year}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Schedule */}
            <div className="detail-section card">
              <h2><FiCalendar /> Weekly Schedule</h2>
              <div className="schedule-grid">
                {doctor.availability?.weeklyAvailability?.filter(s => s.isAvailable).map((s, i) => (
                  <div key={i} className="schedule-item">
                    <span className="schedule-day">{daysMap[s.day] || s.day}</span>
                    <span className="schedule-time">{s.startTime} - {s.endTime}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="detail-sidebar">
            <div className="booking-card glass">
              <div className="fee-display">
                <span className="fee-label">Consultation Fee</span>
                <span className="fee-amount">₹{doctor.consultationFee}</span>
              </div>
              {user?.role === 'patient' ? (
                <Link to={`/book-appointment/${doctor._id}`} className="btn btn-primary btn-lg" style={{width: '100%'}}>
                  <FiCalendar /> Book Appointment
                </Link>
              ) : !user ? (
                <Link to="/login" className="btn btn-primary btn-lg" style={{width: '100%'}}>
                  Sign in to Book
                </Link>
              ) : null}
            </div>

            <div className="contact-card card">
              <h3>Contact Information</h3>
              <div className="contact-item">
                <FiPhone /> <span>{doctor.phone || 'Not available'}</span>
              </div>
              <div className="contact-item">
                <FiMail /> <span>{doctor.email}</span>
              </div>
              <div className="contact-item">
                <FiMapPin /> <span>{doctor.hospital?.address}, {doctor.hospital?.city}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorDetail;
