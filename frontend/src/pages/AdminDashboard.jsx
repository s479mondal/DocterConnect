import { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';
import toast from 'react-hot-toast';
import { FiUsers, FiCalendar, FiCheckCircle, FiActivity } from 'react-icons/fi';
import { RiStethoscopeLine } from 'react-icons/ri';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('pending');
  const [unverifiedDoctors, setUnverifiedDoctors] = useState([]);
  const [users, setUsers] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pagination states
  const [doctorPage, setDoctorPage] = useState(1);
  const [userPage, setUserPage] = useState(1);
  const [apptPage, setApptPage] = useState(1);
  
  const [doctorTotalPages, setDoctorTotalPages] = useState(1);
  const [userTotalPages, setUserTotalPages] = useState(1);
  const [apptTotalPages, setApptTotalPages] = useState(1);

  const fetchUnverifiedDoctors = async (page = 1) => {
    try {
      setLoading(true);
      const { data } = await adminAPI.getUnverifiedDoctors({ page, limit: 10 });
      setUnverifiedDoctors(data.doctors);
      setDoctorTotalPages(data.pagination.totalPages);
    } catch (error) {
      toast.error('Failed to load pending doctors');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async (page = 1) => {
    try {
      setLoading(true);
      const { data } = await adminAPI.getAllUsers({ page, limit: 20 });
      setUsers(data.users);
      setUserTotalPages(data.pagination.totalPages);
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const fetchAppointments = async (page = 1) => {
    try {
      setLoading(true);
      const { data } = await adminAPI.getAllAppointments({ page, limit: 20 });
      setAppointments(data.appointments);
      setApptTotalPages(data.pagination.totalPages);
    } catch (error) {
      toast.error('Failed to load appointments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'pending') fetchUnverifiedDoctors(doctorPage);
    else if (activeTab === 'users') fetchUsers(userPage);
    else if (activeTab === 'appointments') fetchAppointments(apptPage);
  }, [activeTab, doctorPage, userPage, apptPage]);

  const handleVerify = async (id) => {
    try {
      await adminAPI.verifyDoctor(id);
      toast.success('Doctor verified successfully!');
      // Remove from list
      setUnverifiedDoctors(prev => prev.filter(doc => doc._id !== id));
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to verify doctor');
    }
  };

  return (
    <div className="admin-dashboard container fade-in">
      <div className="dashboard-header">
        <h1>Admin Control Panel</h1>
        <p>Manage users, verify doctors, and monitor system activity.</p>
      </div>

      <div className="admin-tabs">
        <button 
          className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => { setActiveTab('pending'); setDoctorPage(1); }}
        >
          <FiActivity /> Pending Doctors
        </button>
        <button 
          className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => { setActiveTab('users'); setUserPage(1); }}
        >
          <FiUsers /> All Users
        </button>
        <button 
          className={`tab-btn ${activeTab === 'appointments' ? 'active' : ''}`}
          onClick={() => { setActiveTab('appointments'); setApptPage(1); }}
        >
          <FiCalendar /> Appointments
        </button>
      </div>

      <div className="tab-content glass">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading data...</p>
          </div>
        ) : (
          <>
            {activeTab === 'pending' && (
              <div className="pending-doctors-section">
                <h2>Requires Verification</h2>
                {unverifiedDoctors.length === 0 ? (
                  <div className="empty-state">
                    <FiCheckCircle className="empty-icon" style={{color: 'var(--success)'}} />
                    <p>All caught up! No doctors waiting for verification.</p>
                  </div>
                ) : (
                  <div className="doctor-grid">
                    {unverifiedDoctors.map(doctor => (
                      <div key={doctor._id} className="doctor-card pending-card">
                        <div className="doctor-info">
                          <div className="avatar-placeholder">
                            <RiStethoscopeLine />
                          </div>
                          <div className="details">
                            <h3>Dr. {doctor.firstName} {doctor.lastName}</h3>
                            <span className="specialization badge badge-primary">{doctor.specialization}</span>
                            <p className="hospital-info">{doctor.hospital?.name}, {doctor.hospital?.city}</p>
                            <div className="stats-row">
                              <span>Reg No: {doctor.registrationNumber}</span>
                              <span>Experience: {doctor.experience} yrs</span>
                              <span>Fee: ₹{doctor.consultationFee}</span>
                            </div>
                            <div className="qualifications">
                              <strong>Qualifications:</strong>
                              <ul>
                                {doctor.qualifications?.map((q, idx) => (
                                  <li key={idx}>{q.degree} from {q.institution} ({q.year})</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                        <div className="action-row">
                          <button onClick={() => handleVerify(doctor._id)} className="btn btn-success btn-full">
                            <FiCheckCircle /> Approve & Verify
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {doctorTotalPages > 1 && (
                  <div className="pagination">
                    <button disabled={doctorPage === 1} onClick={() => setDoctorPage(p => p - 1)} className="btn btn-outline btn-sm">Prev</button>
                    <span>Page {doctorPage} of {doctorTotalPages}</span>
                    <button disabled={doctorPage === doctorTotalPages} onClick={() => setDoctorPage(p => p + 1)} className="btn btn-outline btn-sm">Next</button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'users' && (
              <div className="data-table-section">
                <h2>All Registered Users</h2>
                {users.length === 0 ? (
                  <p>No users found.</p>
                ) : (
                  <div className="table-responsive">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Role</th>
                          <th>Phone</th>
                          <th>Joined</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map(u => (
                          <tr key={u._id}>
                            <td>{u.firstName} {u.lastName}</td>
                            <td>{u.email}</td>
                            <td>
                              <span className={`badge ${u.role === 'admin' ? 'badge-primary' : u.role === 'doctor' ? 'badge-secondary' : 'badge-outline'}`}>
                                {u.role}
                              </span>
                            </td>
                            <td>{u.phone || 'N/A'}</td>
                            <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                            <td>
                              {u.isActive ? (
                                <span className="status-badge success">Active</span>
                              ) : (
                                <span className="status-badge danger">Inactive</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {userTotalPages > 1 && (
                  <div className="pagination">
                    <button disabled={userPage === 1} onClick={() => setUserPage(p => p - 1)} className="btn btn-outline btn-sm">Prev</button>
                    <span>Page {userPage} of {userTotalPages}</span>
                    <button disabled={userPage === userTotalPages} onClick={() => setUserPage(p => p + 1)} className="btn btn-outline btn-sm">Next</button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'appointments' && (
              <div className="data-table-section">
                <h2>Global Appointments</h2>
                {appointments.length === 0 ? (
                  <p>No appointments found in the system.</p>
                ) : (
                  <div className="table-responsive">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Date & Time</th>
                          <th>Patient</th>
                          <th>Doctor</th>
                          <th>Type</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {appointments.map(appt => (
                          <tr key={appt._id}>
                            <td>
                              <div><strong>{new Date(appt.date).toLocaleDateString()}</strong></div>
                              <div className="text-sm text-gray">{appt.timeSlot?.startTime} - {appt.timeSlot?.endTime}</div>
                            </td>
                            <td>{appt.patientName}</td>
                            <td>Dr. {appt.doctorName} <br/><span className="text-sm text-gray">{appt.doctorSpecialization}</span></td>
                            <td className="capitalize text-sm">{appt.type}</td>
                            <td>
                              <span className={`status-badge ${appt.status}`}>
                                {appt.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {apptTotalPages > 1 && (
                  <div className="pagination">
                    <button disabled={apptPage === 1} onClick={() => setApptPage(p => p - 1)} className="btn btn-outline btn-sm">Prev</button>
                    <span>Page {apptPage} of {apptTotalPages}</span>
                    <button disabled={apptPage === apptTotalPages} onClick={() => setApptPage(p => p + 1)} className="btn btn-outline btn-sm">Next</button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
