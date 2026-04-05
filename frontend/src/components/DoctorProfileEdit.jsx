import { useState, useEffect } from 'react';
import { doctorAPI, appointmentAPI } from '../services/api';
import { FiSave, FiPlus, FiTrash2, FiClock, FiMapPin, FiBook, FiInfo, FiCalendar, FiGlobe, FiXCircle, FiZap, FiCheckCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';

const DoctorProfileEdit = ({ profile, onUpdate }) => {
  const [formData, setFormData] = useState({
    specialization: '',
    experience: 0,
    consultationFee: 0,
    bio: '',
    isAvailable: true,
    hospital: { name: '', address: '', city: '', state: '' },
    qualifications: [],
    availability: {
      weeklyAvailability: [],
      exceptions: [],
      timezone: 'Asia/Kolkata'
    }
  });
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewDate, setPreviewDate] = useState(new Date().toISOString().split('T')[0]);
  const [availableDates, setAvailableDates] = useState([]);
  const [previewSlots, setPreviewSlots] = useState([]);


  useEffect(() => {
    if (profile) {
      setFormData({
        specialization: profile.specialization || '',
        experience: profile.experience || 0,
        consultationFee: profile.consultationFee || 0,
        bio: profile.bio || '',
        isAvailable: profile.isAvailable ?? true,
        hospital: profile.hospital || { name: '', address: '', city: '', state: '' },
        qualifications: profile.qualifications || [],
        availability: profile.availability || {
          weeklyAvailability: [],
          exceptions: [],
          timezone: 'Asia/Kolkata'
        }
      });
    }
  }, [profile]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleHospitalChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      hospital: { ...prev.hospital, [name]: value }
    }));
  };

  // Weekly Availability Management
  const addWeeklyRoutine = () => {
    setFormData(prev => ({
      ...prev,
      availability: {
        ...prev.availability,
        weeklyAvailability: [
          ...prev.availability.weeklyAvailability, 
          { day: 'monday', startTime: '09:00', endTime: '17:00', slotDuration: 30, isAvailable: true }
        ]
      }
    }));
  };

  const updateWeeklyRoutine = (index, field, value) => {
    const updated = [...formData.availability.weeklyAvailability];
    updated[index][field] = value;
    setFormData(prev => ({
      ...prev,
      availability: { ...prev.availability, weeklyAvailability: updated }
    }));
  };

  const removeWeeklyRoutine = (index) => {
    setFormData(prev => ({
      ...prev,
      availability: {
        ...prev.availability,
        weeklyAvailability: prev.availability.weeklyAvailability.filter((_, i) => i !== index)
      }
    }));
  };

  // Exceptions Management
  const addException = () => {
    // Generate YYYY-MM-DD locally to avoid timezone drift
    const today = new Date();
    const localDate = new Date(today.getTime() - (today.getTimezoneOffset() * 60000))
        .toISOString().split('T')[0];

    setFormData(prev => ({
      ...prev,
      availability: {
        ...prev.availability,
        exceptions: [
          ...prev.availability.exceptions,
          { date: localDate, type: 'CLOSED', startTime: '09:00', endTime: '17:00', slotDuration: 30 }
        ]
      }
    }));
  };

  const updateException = (index, field, value) => {
    const updated = [...formData.availability.exceptions];
    updated[index][field] = value;
    setFormData(prev => ({
      ...prev,
      availability: { ...prev.availability, exceptions: updated }
    }));
  };

  const removeException = (index) => {
    setFormData(prev => ({
      ...prev,
      availability: {
        ...prev.availability,
        exceptions: prev.availability.exceptions.filter((_, i) => i !== index)
      }
    }));
  };

  const applyTemplate = (type) => {
    let newWeekly = [];
    if (type === 'FULL_TIME') {
      newWeekly = ['monday','tuesday','wednesday','thursday','friday'].map(day => ({
        day, startTime: '09:00', endTime: '17:00', slotDuration: 30, isAvailable: true
      }));
    } else if (type === 'EVENINGS') {
      newWeekly = ['monday','tuesday','wednesday','thursday','friday'].map(day => ({
        day, startTime: '17:00', endTime: '21:00', slotDuration: 30, isAvailable: true
      }));
    }
    
    setFormData(prev => ({
      ...prev,
      availability: { ...prev.availability, weeklyAvailability: newWeekly }
    }));
    toast.success(`Applied ${type.replace('_', ' ')} template! ⚡`);
  };

  const handlePreviewToggle = async () => {
    if (!showPreview) {
      setShowPreview(true);
      fetchPreviewData();
    } else {
      setShowPreview(false);
    }
  };

  const fetchPreviewData = async () => {
    try {
      const { data: summary } = await appointmentAPI.getAvailabilitySummary(profile._id);
      setAvailableDates(summary.availableDates || []);
      
      const { data: slots } = await appointmentAPI.getAvailableSlots({ doctorId: profile._id, date: previewDate });
      setPreviewSlots(slots.slots || []);
    } catch (error) {
      console.error('Preview error:', error);
    }
  };

  useEffect(() => {
    if (showPreview) fetchPreviewData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewDate, showPreview]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await doctorAPI.update(profile._id, formData);
      toast.success('Professional profile updated! ✨');
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="profile-edit-form animate-fade-in">
      {/* Quick Setup Section */}
      <div className="form-section card highlight-card">
        <div className="section-header">
          <h3><FiZap /> Quick Schedule Setup</h3>
          <button type="button" className={`btn btn-sm ${showPreview ? 'btn-primary' : 'btn-outline'}`} onClick={handlePreviewToggle}>
            {showPreview ? 'Hide Preview' : 'Preview Patient View'}
          </button>
        </div>
        <p className="section-hint">Select a template to instantly go live with a standard routine.</p>
        <div className="template-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => applyTemplate('FULL_TIME')}>
            Standard (Mon-Fri, 9-5)
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => applyTemplate('EVENINGS')}>
            Evening Shifts (Mon-Fri, 5-9)
          </button>
        </div>
      </div>

      {showPreview && (
        <div className="form-section card preview-section animate-slide-down">
          <div className="section-header">
            <h3><FiCheckCircle /> Live Availability Preview</h3>
            <span className="badge badge-success">Active</span>
          </div>
          <div className="preview-container grid-2">
            <AvailabilityCalendar 
              selectedDate={previewDate}
              availableDates={availableDates}
              onDateSelect={setPreviewDate}
              timezone={formData.availability.timezone}
            />
            <div className="preview-slots card glass">
              <h4>Slots for {previewDate}</h4>
              <div className="slots-grid">
                {previewSlots.map((slot, i) => (
                  <div key={i} className={`slot-pill ${slot.status}`}>
                    {slot.startTime}
                  </div>
                ))}
                {previewSlots.length === 0 && <p className="empty-hint">No slots available for this date.</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Basic Info Section */}
      <div className="form-section card">
        <div className="section-header">
          <h3><FiInfo /> Professional Overview</h3>
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label>Specialization</label>
            <input type="text" name="specialization" className="form-input" value={formData.specialization} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Experience (Years)</label>
            <input type="number" name="experience" className="form-input" value={formData.experience} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Consultation Fee (₹)</label>
            <input type="number" name="consultationFee" className="form-input" value={formData.consultationFee} onChange={handleChange} required />
          </div>
          <div className="form-group checkbox-group">
            <label className="checkbox-label">
              <input type="checkbox" name="isAvailable" checked={formData.isAvailable} onChange={handleChange} />
              Active for Bookings
            </label>
          </div>
        </div>
        <div className="form-group" style={{marginTop: '1rem'}}>
          <label>Bio / Background</label>
          <textarea name="bio" className="form-textarea" rows="3" value={formData.bio} onChange={handleChange}></textarea>
        </div>
      </div>

      {/* Weekly Routine Section */}
      <div className="form-section card">
        <div className="section-header">
          <h3><FiClock /> Weekly Routine</h3>
          <button type="button" className="btn btn-secondary btn-sm" onClick={addWeeklyRoutine}>
            <FiPlus /> Add Day
          </button>
        </div>
        <div className="dynamic-list">
          {formData.availability.weeklyAvailability.map((w, index) => (
            <div key={index} className="list-item-row glass">
              <select className="form-select" value={w.day} onChange={(e) => updateWeeklyRoutine(index, 'day', e.target.value)}>
                {['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map(d => (
                  <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                ))}
              </select>
              <input type="time" className="form-input" value={w.startTime} onChange={(e) => updateWeeklyRoutine(index, 'startTime', e.target.value)} />
              <span>to</span>
              <input type="time" className="form-input" value={w.endTime} onChange={(e) => updateWeeklyRoutine(index, 'endTime', e.target.value)} />
              <div className="input-with-label">
                <small>Slot (min)</small>
                <input type="number" className="form-input" style={{width: '70px'}} value={w.slotDuration} onChange={(e) => updateWeeklyRoutine(index, 'slotDuration', parseInt(e.target.value))} />
              </div>
              <button type="button" className="btn-icon-danger" onClick={() => removeWeeklyRoutine(index)}><FiTrash2 /></button>
            </div>
          ))}
          {formData.availability.weeklyAvailability.length === 0 && <p className="empty-hint">No weekly routine set. Patients cannot book unless you add available days.</p>}
        </div>
      </div>

      {/* Exceptions Section */}
      <div className="form-section card">
        <div className="section-header">
          <h3><FiCalendar /> Exceptions & Holidays</h3>
          <button type="button" className="btn btn-secondary btn-sm" onClick={addException}>
            <FiPlus /> Add Date
          </button>
        </div>
        <div className="dynamic-list">
          {formData.availability.exceptions.map((ex, index) => (
            <div key={index} className="list-item-row glass" style={{background: ex.type === 'CLOSED' ? 'rgba(239, 68, 68, 0.05)' : 'rgba(99, 102, 241, 0.05)'}}>
              <input type="date" className="form-input" value={ex.date ? new Date(ex.date).toISOString().split('T')[0] : ''} onChange={(e) => updateException(index, 'date', e.target.value)} />
              <select className="form-select" value={ex.type} onChange={(e) => updateException(index, 'type', e.target.value)}>
                <option value="CLOSED">CLOSED (OFF)</option>
                <option value="OVERRIDE">CUSTOM HOURS</option>
              </select>
              {ex.type === 'OVERRIDE' && (
                <>
                  <input type="time" className="form-input" value={ex.startTime} onChange={(e) => updateException(index, 'startTime', e.target.value)} />
                  <input type="time" className="form-input" value={ex.endTime} onChange={(e) => updateException(index, 'endTime', e.target.value)} />
                  <input type="number" className="form-input" style={{width: '70px'}} value={ex.slotDuration} onChange={(e) => updateException(index, 'slotDuration', parseInt(e.target.value))} />
                </>
              )}
              {ex.type === 'CLOSED' && <span style={{flex: 1, color: 'var(--danger)', fontWeight: 600}}>All appointments blocked</span>}
              <button type="button" className="btn-icon-danger" onClick={() => removeException(index)}><FiTrash2 /></button>
            </div>
          ))}
        </div>
      </div>

      {/* Settings Section */}
      <div className="form-section card">
        <div className="section-header">
          <h3><FiGlobe /> Localization Settings</h3>
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label>Primary Timezone</label>
            <select className="form-select" value={formData.availability.timezone} onChange={(e) => setFormData(prev => ({...prev, availability: {...prev.availability, timezone: e.target.value}}))}>
              <option value="Asia/Kolkata">Asia/Kolkata (GMT+5:30)</option>
              <option value="UTC">UTC (GMT+0)</option>
              <option value="Europe/London">Europe/London</option>
              <option value="America/New_York">America/New_York</option>
            </select>
          </div>
        </div>
      </div>

      {/* Hospital Section (Simplified for brevity) */}
      <div className="form-section card">
        <div className="section-header">
          <h3><FiMapPin /> Practice Locations</h3>
        </div>
        <div className="form-grid">
          <div className="form-group"><label>Hospital Name</label><input type="text" name="name" className="form-input" value={formData.hospital.name} onChange={handleHospitalChange} /></div>
          <div className="form-group"><label>City</label><input type="text" name="city" className="form-input" value={formData.hospital.city} onChange={handleHospitalChange} /></div>
        </div>
      </div>

      <div className="form-actions sticky-actions glass">
        <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
          {loading ? 'Saving Changes...' : <><FiSave /> Save Production Profile</>}
        </button>
      </div>
    </form>
  );
};

export default DoctorProfileEdit;
