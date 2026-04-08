import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { appointmentAPI, doctorAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { FiVideo, FiFileText, FiPlus, FiTrash2, FiSend, FiArrowLeft, FiDownload, FiCheck, FiRefreshCw } from 'react-icons/fi';
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
  const [scriptLoaded, setScriptLoaded] = useState(false);
  
  // Prescription Form State
  const [diagnosis, setDiagnosis] = useState('');
  const [advice, setAdvice] = useState('');
  const [medicines, setMedicines] = useState([
    { name: '', dosage: '', duration: '', instructions: '' }
  ]);
  const [draftStatus, setDraftStatus] = useState('');

  const initJitsi = useCallback((appt) => {
    if (!jitsiContainerRef.current) return;
    
    try {
      if (!window.JitsiMeetExternalAPI) return;

      const domain = 'meet.jit.si';
      const roomName = appt.videoCallLink.split('/').pop() || `Consultation-${appt._id}`;
      
      const options = {
        roomName: roomName,
        width: '100%',
        height: '100%',
        parentNode: jitsiContainerRef.current,
        userInfo: {
          displayName: user.role?.toLowerCase() === 'doctor' ? `Dr. ${user.firstName} ${user.lastName}` : `${user.firstName} ${user.lastName}`,
          email: user.email
        },
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          prejoinPageEnabled: false,
          disableThirdPartyRequests: true,
          disableGravatar: true
        }
      };

      const api = new window.JitsiMeetExternalAPI(domain, options);
      setJitsiApi(api);
    } catch (error) {
      console.error('Jitsi Init Error:', error);
    }
  }, [user]);

  const fetchAppointment = useCallback(async () => {
    try {
      const { data } = await appointmentAPI.getById(appointmentId);
      setAppointment(data.appointment);
    } catch (error) {
      console.error('Error fetching appointment:', error);
      toast.error('Failed to load appointment details');
    } finally {
      setLoading(false);
    }
  }, [appointmentId, initJitsi]);

  useEffect(() => {
    fetchAppointment();
    
    // Auto-Restore Draft from Local Storage
    const savedDraft = localStorage.getItem(`prescription_draft_${appointmentId}`);
    if (savedDraft) {
      try {
        const { diagnosis: d, advice: a, medicines: m } = JSON.parse(savedDraft);
        if (d) setDiagnosis(d);
        if (a) setAdvice(a);
        if (m && m.length > 0) setMedicines(m);
        setDraftStatus('Draft restored from local memory');
      } catch (e) {
        console.error('Error restoring draft:', e);
      }
    }

    const script = document.createElement('script');
    script.src = 'https://meet.jit.si/external_api.js';
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    document.body.appendChild(script);

    return () => {
      // Cleanup on unmount
      if (jitsiApi) jitsiApi.dispose();
      setJitsiApi(null);
    };
  }, [fetchAppointment, appointmentId]); // Removed jitsiApi from deps to prevent re-runs

  // Auto-Save Draft to Local Storage
  useEffect(() => {
     if (user.role?.toLowerCase() === 'doctor' && appointment?.status !== 'completed') {
       const draft = { diagnosis, advice, medicines };
       localStorage.setItem(`prescription_draft_${appointmentId}`, JSON.stringify(draft));
       setDraftStatus('Draft saved locally');
     }
  }, [diagnosis, advice, medicines, appointmentId, user.role, appointment?.status]);

  // Unified Jitsi Initialization (The ONLY point of entry for Jitsi)
  useEffect(() => {
    // Only init if: Script is ready, Appointment is ready, and API not already created
    if (scriptLoaded && appointment && !jitsiApi) {
      console.log("Initializing Jitsi for room:", appointmentId);
      initJitsi(appointment);
    }
  }, [scriptLoaded, appointment, jitsiApi, initJitsi, appointmentId]);

  // Patient Status Polling (Sync prescription automatically)
  useEffect(() => {
    let interval = null;
    if (user.role?.toLowerCase() === 'patient' && appointment?.status !== 'completed') {
      interval = setInterval(() => {
        appointmentAPI.getById(appointmentId).then(({ data }) => {
          if (data.appointment?.status === 'completed') {
            setAppointment(data.appointment);
            toast.success('Doctor has finalized your prescription!');
          }
        }).catch(err => console.error('Polling error:', err));
      }, 5000); // Check every 5 seconds
    }
    return () => clearInterval(interval);
  }, [appointment?.status, appointmentId, user.role]);

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
      // 1. Get Doctor Full Details for PDF (using profile id, not user id)
      const { data: docData } = await doctorAPI.getById(appointment.doctorId);
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
      // Clear draft on successful submission
      localStorage.removeItem(`prescription_draft_${appointmentId}`);
      // Re-fetch to update status locally instead of navigating away immediately
      fetchAppointment();
    } catch (error) {
      console.error('Error saving prescription:', error);
      toast.error('Failed to save prescription to server. You can still download the draft PDF below.');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadDraft = async () => {
    try {
      const { data: docData } = await doctorAPI.getById(appointment.doctorId);
      const prescriptionData = {
        diagnosis,
        medicines: medicines.filter(m => m.name),
        advice,
        issuedAt: new Date()
      };
      generatePrescriptionPDF(docData.doctor, { name: appointment.patientName }, prescriptionData);
      toast.success('Draft PDF downloaded! You can share this with the patient.');
    } catch (error) {
      console.error('Draft download error:', error);
      toast.error('Could not generate draft PDF');
    }
  };

  const handleClearDraft = () => {
    if (window.confirm('Are you sure you want to clear your current draft?')) {
      setDiagnosis('');
      setAdvice('');
      setMedicines([{ name: '', dosage: '', duration: '', instructions: '' }]);
      localStorage.removeItem(`prescription_draft_${appointmentId}`);
      toast('Draft cleared');
    }
  };

  const isDoctor = user.role?.toLowerCase() === 'doctor';
  const isPatient = user.role?.toLowerCase() === 'patient';

  if (loading) return <div className="page-loading"><div className="spinner"></div></div>;
  if (!appointment) return <div className="empty-state"><h3>Appointment not found</h3></div>;

  return (
    <div className="consultation-room">
      <div className="room-header">
        <button className="btn-back" onClick={() => navigate(-1)}><FiArrowLeft /> Leave Room</button>
        <div className="room-title">
          <FiVideo /> Live Consultation: {appointment.patientName} with {appointment.doctorName?.startsWith('Dr.') ? appointment.doctorName : `Dr. ${appointment.doctorName}`}
        </div>
        {appointment.status === 'completed' && (
          <span className="badge badge-success">Consultation Completed</span>
        )}
      </div>

      <div className={`room-content ${isDoctor ? 'split-view' : 'full-view'}`}>
        {/* Video Column */}
        <div className="video-section">
          {/* Target for Jitsi initialization */}
          <div ref={jitsiContainerRef} className="jitsi-container-target"></div>
          
          {appointment.status !== 'completed' && !jitsiApi && (
            <div className="video-placeholder glass">
              <div className="placeholder-content">
                <FiVideo />
                <p>Initializing secure video call...</p>
              </div>
            </div>
          )}
        </div>

        {/* Prescription Column (Doctor Only) */}
        {isDoctor && (
          <div className={`prescription-section ${appointment.status === 'completed' ? 'readonly-mode' : ''}`}>
            {appointment.status === 'completed' ? (
               <div className="prescription-completed-view">
                  <div className="success-banner">
                    <FiCheck /> Prescription Finalized
                  </div>
                  <div className="readonly-content">
                    <h4>Diagnosis</h4>
                    <p>{appointment.prescription?.diagnosis}</p>
                    <h4>Advice</h4>
                    <p>{appointment.prescription?.advice}</p>
                    <button 
                      className="btn btn-primary" 
                      onClick={() => {
                        doctorAPI.getById(appointment.doctorId).then(({data}) => {
                          generatePrescriptionPDF(data.doctor, { name: appointment.patientName }, appointment.prescription);
                        });
                      }}
                    >
                      <FiDownload /> Download Copy
                    </button>
                  </div>
               </div>
            ) : (
              <>
                <div className="prescription-header">
                  <div className="header-top">
                    <h3><FiFileText /> Write Prescription</h3>
                    <div className="draft-indicator">{draftStatus}</div>
                  </div>
                  <p>Fill out the details below to complete the consultation.</p>
                  <div className="offline-tools">
                    <button type="button" className="btn-link" onClick={handleDownloadDraft} title="Download PDF without sending to server">
                      <FiDownload /> Preview/Download Draft
                    </button>
                    <button type="button" className="btn-link text-danger" onClick={handleClearDraft}>
                      <FiTrash2 /> Clear Draft
                    </button>
                  </div>
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
              </>
            )}
          </div>
        )}

        {/* Patient Wait View */}
        {isPatient && appointment.status !== 'completed' && (
          <div className="patient-waiting-notice glass animate-fade-in">
              <div className="waiting-content">
                <div className="pulse-circle"></div>
                <div>
                  <p>Call in progress. Once the consultation ends, the doctor will send your prescription here.</p>
                  <button className="btn btn-secondary btn-sm" onClick={fetchAppointment} style={{marginTop: '10px'}}>
                    <FiRefreshCw /> Check Now
                  </button>
                </div>
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
                  onClick={() => {
                    const nameParts = appointment.doctorName?.replace(/^Dr\.\s*/i, '').split(' ');
                    generatePrescriptionPDF(
                      { firstName: nameParts[0], lastName: nameParts.slice(1).join(' ') || '', specialization: appointment.doctorSpecialization }, 
                      { name: appointment.patientName }, 
                      appointment.prescription
                    );
                  }}
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
