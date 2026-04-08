import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doctorAPI, appointmentAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AvailabilityCalendar from '../components/AvailabilityCalendar';
import { 
  FiCalendar, FiClock, FiCheck, FiXCircle, FiSunrise, 
  FiSun, FiMoon, FiArrowLeft, FiAlertCircle, FiLock 
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import './BookAppointment.css';

const BookAppointment = () => {
  const { doctorId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [doctor, setDoctor] = useState(null);
  const [slots, setSlots] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  
  // Booking Form State
  const [type, setType] = useState('consultation');
  const [consultationType, setConsultationType] = useState('offline');
  const [reason, setReason] = useState('');
  
  // Timer for slot lock
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [availableDates, setAvailableDates] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [lockingSlotId, setLockingSlotId] = useState(null);

  const fetchAvailabilitySummary = useCallback(async () => {
    try {
      setSummaryLoading(true);
      const { data } = await appointmentAPI.getAvailabilitySummary(doctorId);
      const dates = data.availableDates || [];
      setAvailableDates(dates);
      
      if (dates.length > 0) {
        const todayObj = new Date();
        const year = todayObj.getFullYear();
        const monthStr = String(todayObj.getMonth() + 1).padStart(2, '0');
        const dayStr = String(todayObj.getDate()).padStart(2, '0');
        const today = `${year}-${monthStr}-${dayStr}`;
        if (!dates.includes(today)) {
          setSelectedDate(dates[0]);
        } else {
          setSelectedDate(today);
        }
      } else {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const year = tomorrow.getFullYear();
        const monthStr = String(tomorrow.getMonth() + 1).padStart(2, '0');
        const dayStr = String(tomorrow.getDate()).padStart(2, '0');
        setSelectedDate(`${year}-${monthStr}-${dayStr}`);
      }
    } catch (error) {
      console.error('Error fetching summary:', error);
    } finally {
      setSummaryLoading(false);
    }
  }, [doctorId]);

  const fetchDoctor = useCallback(async () => {
    try {
      const { data } = await doctorAPI.getById(doctorId);
      setDoctor(data.doctor);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load doctor information');
    } finally {
      setLoading(false);
    }
  }, [doctorId]);

  useEffect(() => {
    fetchDoctor();
    fetchAvailabilitySummary();
  }, [fetchDoctor, fetchAvailabilitySummary]);

  const fetchSlots = useCallback(async () => {
    try {
      const { data } = await appointmentAPI.getAvailableSlots({ doctorId, date: selectedDate });
      setSlots(data.slots || []);
    } catch (error) {
      console.error('Error fetching slots:', error);
      setSlots([]);
    }
  }, [doctorId, selectedDate]);

  useEffect(() => {
    if (selectedDate && doctorId) fetchSlots();
  }, [fetchSlots, selectedDate, doctorId]);

  // Lock Timer Logic
  useEffect(() => {
    let interval = null;
    if (timerActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && timerActive) {
      setTimerActive(false);
      setSelectedSlot(null);
      toast.error('Session expired. The slot has been released.');
      fetchSlots();
    }
    return () => clearInterval(interval);
  }, [timerActive, timeLeft, fetchSlots]);

  const handleSlotSelect = async (slot) => {
    if (selectedSlot) return; // Strict commitment

    if (slot.status !== 'AVAILABLE') {
      if (slot.status === 'LOCKED') {
        toast.error('This slot is temporarily held by another user.');
      } else if (slot.status === 'BOOKED') {
        toast.error('This slot is already booked.');
      }
      return;
    }

    try {
      setLockingSlotId(slot.slotId);
      await appointmentAPI.lockSlot({
        doctorId,
        date: selectedDate,
        startTime: slot.startTime,
        slotId: slot.slotId
      });
      
      setSelectedSlot(slot);
      setTimeLeft(60); // 1 minute
      setTimerActive(true);
      toast.success('Slot held for 1 minute! ✨');
    } catch (error) {
      if (error.response?.status === 409) {
        toast.error(error.response.data.message || 'Slot conflict.');
      } else {
        toast.error('Failed to reserve slot.');
      }
    } finally {
      setLockingSlotId(null);
    }
  };

  const handleReleaseSlot = async () => {
    if (!selectedSlot) return;
    try {
      await appointmentAPI.releaseLock(selectedSlot.slotId);
      setSelectedSlot(null);
      setTimerActive(false);
      setTimeLeft(0);
      toast.success('Slot released.');
      fetchSlots();
    } catch (error) {
      console.error('Error releasing slot:', error);
      toast.error('Failed to release slot.');
    }
  };

  const handleBooking = async () => {
    if (!selectedSlot) return toast.error('Please select a time slot');
    setBooking(true);
    try {
      await appointmentAPI.book({
        doctorId,
        doctorUserId: doctor.userId,
        doctorName: `${doctor.firstName} ${doctor.lastName}`,
        doctorSpecialization: doctor.specialization,
        patientName: `${user.firstName} ${user.lastName}`,
        date: selectedDate,
        timeSlot: { startTime: selectedSlot.startTime, endTime: selectedSlot.endTime },
        slotId: selectedSlot.slotId,
        type,
        consultationType,
        reason,
        consultationFee: doctor.consultationFee
      });
      toast.success('Appointment booked successfully! 🎉');
      setTimerActive(false);
      navigate('/appointments');
    } catch (error) {
      console.error('Booking error:', error);
      toast.error(error.response?.data?.message || 'Booking failed.');
    } finally {
      setBooking(false);
    }
  };

  if (loading) return <div className="page-loading"><div className="spinner"></div></div>;
  if (!doctor) return <div className="empty-state"><h3>Doctor not found</h3></div>;

  const formatTimeStr = (timeStr) => {
    const [h, m] = timeStr.split(':');
    const d = new Date();
    d.setHours(h, m, 0);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const getSlotPeriod = (timeStr) => {
    const h = parseInt(timeStr.split(':')[0], 10);
    if (h < 12) return 'Morning';
    if (h < 17) return 'Afternoon';
    return 'Evening';
  };

  const periodIcons = {
    'Morning': <FiSunrise />,
    'Afternoon': <FiSun />,
    'Evening': <FiMoon />
  };

  return (
    <div className="booking-page">
      <div className="container">
        <button 
          className="btn btn-secondary btn-sm" 
          onClick={() => navigate(-1)} 
          style={{marginBottom: '1.5rem'}}
          disabled={timerActive}
        >
          <FiArrowLeft /> Back
        </button>

        <div className="booking-grid animate-fade-in">
          <div className="booking-main">
            <h1 className="section-title">Book Appointment</h1>
            <p className="section-subtitle">with Dr. {doctor.firstName} {doctor.lastName} - {doctor.specialization}</p>

            {/* Date Selection */}
            <div className={`booking-section ${selectedSlot ? 'section-locked' : ''}`}>
              <div className="section-header-inline">
                <h2><FiCalendar /> 1. Select Date</h2>
                {summaryLoading && <div className="spinner-sm"></div>}
              </div>
              <div className="calendar-container">
                <AvailabilityCalendar 
                  selectedDate={selectedDate} 
                  availableDates={availableDates}
                  onDateSelect={(date) => !selectedSlot && setSelectedDate(date)} 
                  timezone={doctor?.availability?.timezone}
                />
                {selectedSlot && (
                  <div className="calendar-overlay-locked glass animate-fade-in">
                    <div className="locked-badge">
                      <FiLock /> Date selection locked. Release your slot to change dates.
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Consultation Type - Moved here as Step 2 */}
            <div className={`booking-section card ${selectedSlot ? 'section-locked' : ''}`}>
              <h2><FiCheck /> 2. Mode of Visit</h2>
              <div className="form-group" style={{marginTop: '1rem'}}>
                <div className="consultation-type-selector grid-2">
                  <div 
                    className={`type-option glass ${consultationType === 'offline' ? 'active' : ''} ${selectedSlot ? 'disabled' : ''}`}
                    onClick={() => !selectedSlot && setConsultationType('offline')}
                  >
                    <div className="type-icon"><FiSunrise /></div>
                    <div className="type-info">
                      <span className="type-title">In-Person</span>
                      <span className="type-desc">At Clinic</span>
                    </div>
                  </div>
                  <div 
                    className={`type-option glass ${consultationType === 'online' ? 'active' : ''} ${selectedSlot ? 'disabled' : ''}`}
                    onClick={() => !selectedSlot && setConsultationType('online')}
                  >
                    <div className="type-icon"><FiClock style={{color: 'var(--accent)'}} /></div>
                    <div className="type-info">
                      <span className="type-title">Video Call</span>
                      <span className="type-desc">Online (+₹500)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Time Slots - Now Step 3 */}
            <div className="booking-section card">
              <div className="section-header-inline">
                <h2><FiClock /> 3. Available Slots</h2>
                {timerActive && (
                  <div className="lock-timer pulse">
                    <FiClock /> {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                    <span className="lock-timer-text"> (Locked)</span>
                  </div>
                )}
              </div>
              
              {slots.length === 0 ? (
                <div className="unavailable-notice glass">
                  <FiXCircle />
                  <p>Doctor is unavailable on this date. Please try another selection.</p>
                </div>
              ) : (
                <div className="slots-grouped-container">
                  {['Morning', 'Afternoon', 'Evening'].map(period => {
                    const periodSlots = slots.filter(s => getSlotPeriod(s.startTime) === period);
                    if (periodSlots.length === 0) return null;
                    return (
                      <div key={period} className="slot-period-group">
                        <h3 className="period-title">
                          {periodIcons[period]} {period}
                        </h3>
                        <div className="slots-grid">
                          {periodSlots.map((slot, i) => (
                            <button
                              key={i}
                              className={`slot-btn ${
                                selectedSlot?.slotId === slot.slotId ? 'selected' : ''
                              } ${slot.status === 'BOOKED' ? 'unavailable' : ''} ${slot.status === 'LOCKED' && selectedSlot?.slotId !== slot.slotId ? 'locked' : ''} ${slot.status === 'EXPIRED' ? 'expired' : ''} ${lockingSlotId === slot.slotId ? 'locking-pulse' : ''}`}
                              onClick={() => handleSlotSelect(slot)}
                              disabled={slot.status === 'BOOKED' || slot.status === 'EXPIRED' || lockingSlotId === slot.slotId || (selectedSlot && selectedSlot.slotId !== slot.slotId)}
                              title={slot.status === 'LOCKED' ? 'Slot is being held' : (selectedSlot && selectedSlot.slotId !== slot.slotId) ? 'Release current slot to select this one' : ''}
                            >
                              {lockingSlotId === slot.slotId ? (
                                <span className="locking-text">Locking...</span>
                              ) : (
                                formatTimeStr(slot.startTime)
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Appointment Details - Step 4 */}
            <div className={`booking-section card ${!selectedSlot ? 'section-disabled' : ''}`}>
              <h2>4. Appointment Details</h2>
              <div className="form-group">
                <label>Type of Consultation</label>
                <select 
                  className="form-select" 
                  value={type} 
                  onChange={(e) => setType(e.target.value)}
                  disabled={!selectedSlot}
                >
                  <option value="consultation">First Consultation</option>
                  <option value="follow-up">Follow-up Visit</option>
                  <option value="check-up">Routine Check-up</option>
                </select>
              </div>
              <div className="form-group">
                <label>Reason for Appointment</label>
                <textarea
                  className="form-textarea"
                  placeholder="Tell us why you are booking this appointment..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={!selectedSlot}
                />
              </div>
            </div>
          </div>

          <div className="booking-sidebar">
            <div className="summary-card glass">
              <h3>Booking Summary</h3>
              <div className="summary-item">
                <span className="summary-label">Doctor</span>
                <span>Dr. {doctor.firstName} {doctor.lastName}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Specialization</span>
                <span>{doctor.specialization}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Date</span>
                <span>{selectedDate ? new Date(selectedDate + 'T12:00:00Z').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'Not selected'}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Time</span>
                <span>{selectedSlot ? `${formatTimeStr(selectedSlot.startTime)} - ${formatTimeStr(selectedSlot.endTime)}` : 'Not selected'}</span>
              </div>
              <div className="summary-divider"></div>
              <div className="summary-item summary-total">
                <span>Total Fee</span>
                <span className="summary-fee">₹{doctor.consultationFee + (consultationType === 'online' ? 500 : 0)}</span>
              </div>
              <button
                className="btn btn-accent btn-lg"
                style={{width: '100%', marginTop: '1.5rem'}}
                onClick={handleBooking}
                disabled={!selectedSlot || booking}
              >
                {booking ? <span className="spinner" style={{width: 20, height: 20}}></span> : <><FiCheck /> Confirm Booking</>}
              </button>
              {!selectedSlot && (
                <p className="summary-note"><FiAlertCircle /> Select a time slot to proceed</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {booking && (
        <div className="booking-overlay animate-fade-in">
          <div className="overlay-content glass">
            <div className="pulse-circle"></div>
            <h2>Securing Your Slot...</h2>
            <p>Dr. {doctor.firstName} {doctor.lastName} - {selectedSlot?.startTime}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookAppointment;
