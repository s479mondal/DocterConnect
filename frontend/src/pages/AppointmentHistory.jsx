import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { appointmentAPI, doctorAPI } from '../services/api';
import { FiCalendar, FiClock, FiFilter, FiVideo, FiMapPin, FiDownload } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { generatePrescriptionPDF } from '../utils/pdfGenerator';
import './AppointmentHistory.css';

const AppointmentHistory = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      if (user.role === 'doctor') {
        const { data: docData } = await doctorAPI.getByUserId(user.id);
        if (docData.doctor) {
          const params = { limit: 50 };
          if (statusFilter) params.status = statusFilter;
          const { data } = await appointmentAPI.getDoctorAppointments(docData.doctor._id, params);
          setAppointments(data.appointments || []);
        }
      } else {
        const params = { limit: 50 };
        if (statusFilter) params.status = statusFilter;
        const { data } = await appointmentAPI.getPatientAppointments(params);
        setAppointments(data.appointments || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async (appt) => {
    try {
      const { data: orderData } = await appointmentAPI.createOrder({
        amount: appt.consultationFee,
        receipt: `receipt_${appt._id}`
      });

      const order = orderData.order;

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_SZ9vgZQjij4g7j',
        amount: order.amount,
        currency: order.currency,
        name: 'DoctorConnect',
        description: `Consultation with Dr. ${appt.doctorName}`,
        order_id: order.id,
        handler: async function (response) {
          try {
            await appointmentAPI.verifyPayment(appt._id, {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature
            });
            toast.success('Payment successful! Appointment confirmed.');
            fetchAppointments();
          } catch (err) {
            console.error('Payment verification error:', err);
            toast.error('Payment verification failed');
          }
        },
        prefill: {
          name: `${user.firstName} ${user.lastName}`,
          email: user.email
        },
        theme: { color: '#3498db' }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (error) {
      console.error('Payment initialization error:', error);
      toast.error('Failed to initialize payment');
    }
  };

  const handleCancel = async (apptId, version) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return;
    try {
      await appointmentAPI.updateStatus(apptId, { status: 'cancelled', version, cancellationReason: 'Cancelled by user' });
      toast.success('Appointment cancelled');
      fetchAppointments();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to cancel');
    }
  };

  const handleDownloadPrescription = async (appt) => {
    try {
      const { data: docData } = await doctorAPI.getByUserId(appt.doctorId);
      const fullDoctor = docData.doctor;
      generatePrescriptionPDF(fullDoctor, { name: appt.patientName }, appt.prescription);
    } catch (error) {
      console.error('Error downloading prescription:', error);
      toast.error('Failed to generate PDF');
    }
  };

  const getStatusBadge = (status) => {
    const map = { pending: 'badge-warning', confirmed: 'badge-info', completed: 'badge-success', cancelled: 'badge-danger', 'in-progress': 'badge-primary', 'no-show': 'badge-danger' };
    return <span className={`badge ${map[status] || 'badge-info'}`}>{status}</span>;
  };

  return (
    <div className="history-page">
      <div className="container">
        <div className="history-header animate-fade-in">
          <h1 className="section-title">Appointment History</h1>
          <div className="filter-bar">
            <FiFilter />
            <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{width: 'auto', minWidth: 180}}>
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="page-loading"><div className="spinner"></div></div>
        ) : appointments.length === 0 ? (
          <div className="empty-state card">
            <div className="empty-state-icon">📋</div>
            <h3>No appointments found</h3>
            <p>Your appointment history will appear here</p>
          </div>
        ) : (
          <div className="history-list animate-fade-in">
            {appointments.map((appt) => (
              <div key={appt._id} className="history-item card">
                <div className="history-item-header">
                  <div className="history-avatar">
                    {user.role === 'doctor'
                      ? appt.patientName?.split(' ').map(n => n[0]).join('').slice(0, 2)
                      : appt.doctorName?.split(' ').map(n => n[0]).join('').slice(0, 2)
                    }
                  </div>
                  <div className="history-info">
                    <h3>{user.role === 'doctor' ? appt.patientName : `Dr. ${appt.doctorName}`}</h3>
                    <p className="history-type" style={{textTransform: 'capitalize'}}>
                      {appt.type} {appt.doctorSpecialization ? `• ${appt.doctorSpecialization}` : ''}
                      <span className={`method-badge ${appt.consultationType === 'online' ? 'online' : 'offline'}`} style={{marginLeft: '0.5rem'}}>
                        {appt.consultationType === 'online' ? <><FiVideo /> Online</> : <><FiMapPin /> Clinic</>}
                      </span>
                    </p>
                  </div>
                  {getStatusBadge(appt.status)}
                </div>
                <div className="history-details">
                  <div className="history-detail">
                    <FiCalendar /> {new Date(appt.date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                  <div className="history-detail">
                    <FiClock /> {appt.timeSlot?.startTime} - {appt.timeSlot?.endTime}
                  </div>
                   {appt.reason && <div className="history-detail"><strong>Reason:</strong> {appt.reason}</div>}
                   {appt.status === 'completed' && appt.prescription && (
                     <div className="history-detail prescription-box glass animate-fade-in">
                        <strong>Prescription Issued</strong>
                        <button className="btn-download-inline" onClick={() => handleDownloadPrescription(appt)}>
                          <FiDownload /> Download PDF
                        </button>
                     </div>
                   )}
                   {appt.notes && <div className="history-detail"><strong>Notes:</strong> {appt.notes}</div>}
                </div>
                <div className="history-item-footer">
                  <div className="history-footer-left">
                    <span className="history-fee">₹{appt.consultationFee || 0}</span>
                    {appt.paymentStatus === 'paid' ? (
                      <span className="badge badge-success" style={{marginLeft: '0.5rem'}}>Paid</span>
                    ) : (
                      <span className="badge badge-warning" style={{marginLeft: '0.5rem'}}>Unpaid</span>
                    )}
                  </div>
                  <div className="history-actions">
                    {user.role === 'patient' && appt.status === 'pending' && appt.paymentStatus === 'pending' && (
                      <button 
                        className="btn btn-accent btn-sm" 
                        onClick={() => handlePayment(appt)}
                        style={{marginRight: '0.5rem'}}
                      >
                        Pay Now
                      </button>
                    )}
                    {appt.consultationType === 'online' && appt.status === 'confirmed' && (
                      <button 
                        className="btn btn-primary btn-sm btn-video pulse" 
                        onClick={() => navigate(`/consultation/${appt._id}`)}
                        style={{marginRight: '0.5rem'}}
                      >
                        <FiVideo /> Join Video Call
                      </button>
                    )}
                    {['pending', 'confirmed'].includes(appt.status) && (
                      <button className="btn btn-danger btn-sm" onClick={() => handleCancel(appt._id, appt.version)}>
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AppointmentHistory;
