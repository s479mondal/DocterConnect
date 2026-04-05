import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { appointmentAPI, doctorAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { FiVideo, FiFileText, FiPlus, FiTrash2, FiSend, FiArrowLeft, FiDownload } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { generatePrescriptionPDF } from '../utils/pdfGenerator';
import './ConsultationRoom.css';

const ConsultationRoom = () => {
  const { appointmentId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const jitsiContainerRef = useRef(null);
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [jitsiApi, setJitsiApi] = useState(null);
  
  // Prescription Form State
  const [diagnosis, setDiagnosis] = useState('');
  const [advice, setAdvice] = useState('');
  const [medicines, setMedicines] = useState([
    { name: '', dosage: '', duration: '', instructions: '' }
  ]);

  const initJitsi = useCallback((appt) => {
    try {
      if (!window.JitsiMeetExternalAPI) {
        throw new Error('Jitsi API not loaded');
      }

      const domain = 'meet.jit.si';
      const roomName = appt.videoCallLink.split('/').pop() || `Consultation-${appt._id}`;
      
      const options = {
        roomName: roomName,
        width: '100%',
        height: '100%',
        parentNode: jitsiContainerRef.current,
        userInfo: {
          displayName: user.role === 'doctor' ? `Dr. ${user.firstName} ${user.lastName}` : `${user.firstName} ${user.lastName}`,
          email: user.email
        },
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          prejoinPageEnabled: false
        },
        interfaceConfigOverwrite: {
          TOOLBAR_BUTTONS: [
            'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
            'fodeviceselection', 'hangup', 'profile', 'chat', 'recording',
            'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
            'videoquality', 'filmstrip', 'invite', 'feedback', 'stats', 'shortcuts',
            'tileview', 'videobackgroundblur', 'download', 'help', 'mute-everyone',
            'security'
          ]
        }
      };

      const api = new window.JitsiMeetExternalAPI(domain, options);
      setJitsiApi(api);

      api.addEventListener('videoConferenceTerminated', () => {
        toast.info('Video conference ended.');
      });
    } catch (error) {
      console.error('Jitsi Init Error:', error);
      toast.error('Failed to load video call. Please check your internet connection.');
    }
  }, [user]);

  const fetchAppointment = useCallback(async () => {
    try {
      const { data } = await appointmentAPI.getById(appointmentId);
      setAppointment(data.appointment);
      
      if (window.JitsiMeetExternalAPI && data.appointment) {
        initJitsi(data.appointment);
      }
    } catch (error) {
      console.error('Error fetching appointment:', error);
      toast.error('Failed to load appointment details');
    } finally {
      setLoading(false);
    }
  }, [appointmentId, initJitsi]);

  useEffect(() => {
    fetchAppointment();
    
    const script = document.createElement('script');
    script.src = 'https://meet.jit.si/external_api.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
      if (jitsiApi) jitsiApi.dispose();
    };
  }, [fetchAppointment]);

  useEffect(() => {
    if (window.JitsiMeetExternalAPI && appointment && !jitsiApi) {
      initJitsi(appointment);
    }
  }, [appointment, jitsiApi, initJitsi]);

  const handleAddMedicine = () => {
    setMedicines([...medicines, { name: '', dosage: '', duration: '', instructions: '' }]);
  };

  const handleRemoveMedicine = (index) => {
    const newMeds = [...medicines];
    newMeds.splice(index, 1);
    setMedicines(newMeds);
  };

  const handleMedicineChange = (index, field, value) => {
    const newMeds = [...medicines];
    newMeds[index][field] = value;
    setMedicines(newMeds);
  };

  const handleSubmitPrescription = async (e) => {
    e.preventDefault();
    if (!diagnosis) return toast.error('Please enter a diagnosis');
    
    setSaving(true);
    try {
      // 1. Get Doctor Full Details for PDF
      const { data: docData } = await doctorAPI.getByUserId(appointment.doctorId);
      const fullDoctor = docData.doctor;

      const prescriptionData = {
        diagnosis,
        medicines: medicines.filter(m => m.name),
        advice,
        issuedAt: new Date()
      };

      // 2. Save to Backend
      await appointmentAPI.addPrescription(appointmentId, prescriptionData);
      
      // 3. Generate PDF
      generatePrescriptionPDF(fullDoctor, { name: appointment.patientName }, prescriptionData);
      
      toast.success('Prescription saved and sent! 🎉');
      navigate('/appointments');
    } catch (error) {
      console.error('Error saving prescription:', error);
      toast.error('Failed to save prescription');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="page-loading"><div className="spinner"></div></div>;
  if (!appointment) return <div className="empty-state"><h3>Appointment not found</h3></div>;

  return (
    <div className="consultation-room">
      <div className="room-header">
        <button className="btn-back" onClick={() => navigate(-1)}><FiArrowLeft /> Leave Room</button>
        <div className="room-title">
          <FiVideo /> Live Consultation: {appointment.patientName} with Dr. {appointment.doctorName}
        </div>
        {appointment.status === 'completed' && (
          <span className="badge badge-success">Consultation Completed</span>
        )}
      </div>

      <div className={`room-content ${user.role === 'doctor' ? 'split-view' : 'full-view'}`}>
        {/* Video Column */}
        <div className="video-section" ref={jitsiContainerRef}>
          {/* Jitsi iframe will be injected here */}
        </div>

        {/* Prescription Column (Doctor Only) */}
        {user.role === 'doctor' && appointment.status !== 'completed' && (
          <div className="prescription-section card">
            <div className="prescription-header">
              <h3><FiFileText /> Write Prescription</h3>
              <p>Fill out the details below to complete the consultation.</p>
            </div>

            <form onSubmit={handleSubmitPrescription}>
              <div className="form-group">
                <label>Diagnosis / Findings</label>
                <textarea 
                  className="form-textarea" 
                  placeholder="Enter diagnosis..."
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  required
                />
              </div>

              <div className="medicines-header">
                <label>Medicines</label>
                <button type="button" className="btn-add-med" onClick={handleAddMedicine}>
                  <FiPlus /> Add
                </button>
              </div>

              {medicines.map((med, index) => (
                <div key={index} className="medicine-row glass">
                  <div className="row-inputs">
                    <input 
                      type="text" 
                      placeholder="Medicine Name" 
                      value={med.name}
                      onChange={(e) => handleMedicineChange(index, 'name', e.target.value)}
                      required
                    />
                    <input 
                      type="text" 
                      placeholder="Dosage (e.g. 1-0-1)" 
                      value={med.dosage}
                      onChange={(e) => handleMedicineChange(index, 'dosage', e.target.value)}
                      required
                    />
                    <input 
                      type="text" 
                      placeholder="Duration" 
                      value={med.duration}
                      onChange={(e) => handleMedicineChange(index, 'duration', e.target.value)}
                      required
                    />
                    <input 
                      type="text" 
                      placeholder="Instructions (e.g. After meal)" 
                      value={med.instructions}
                      onChange={(e) => handleMedicineChange(index, 'instructions', e.target.value)}
                    />
                  </div>
                  {medicines.length > 1 && (
                    <button type="button" className="btn-remove-med" onClick={() => handleRemoveMedicine(index)}>
                      <FiTrash2 />
                    </button>
                  )}
                </div>
              ))}

              <div className="form-group" style={{marginTop: '1.5rem'}}>
                <label>Advice / Follow-up</label>
                <textarea 
                  className="form-textarea" 
                  placeholder="General advice or follow-up instructions..."
                  value={advice}
                  onChange={(e) => setAdvice(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-accent btn-lg btn-submit" disabled={saving}>
                {saving ? <span className="spinner-sm"></span> : <><FiSend /> Finalize & Send Prescription</>}
              </button>
            </form>
          </div>
        )}

        {/* Patient Wait View */}
        {user.role === 'patient' && appointment.status !== 'completed' && (
          <div className="patient-waiting-notice glass animate-fade-in">
              <div className="waiting-content">
                <div className="pulse-circle"></div>
                <p>Call in progress. Once the consultation ends, the doctor will send your prescription here.</p>
              </div>
          </div>
        )}

        {/* Patient Completed View */}
        {appointment.status === 'completed' && (
          <div className="prescription-download-overlay glass animate-fade-in">
             <div className="download-card">
                <div className="icon-success"><FiFileText /></div>
                <h3>Consultation Finished!</h3>
                <p>Doctor has issued your prescription. You can download it below.</p>
                <button 
                  className="btn btn-accent btn-lg" 
                  onClick={() => generatePrescriptionPDF(
                    { firstName: appointment.doctorName.split(' ')[0], lastName: appointment.doctorName.split(' ')[1] || '', specialization: appointment.doctorSpecialization }, 
                    { name: appointment.patientName }, 
                    appointment.prescription
                  )}
                >
                  <FiDownload /> Download Prescription PDF
                </button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConsultationRoom;
