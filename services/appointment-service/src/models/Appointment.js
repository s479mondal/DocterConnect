const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  patientId: {
    type: String,
    required: true,
    index: true
  },
  patientName: {
    type: String,
    required: true
  },
  patientEmail: {
    type: String,
    required: true
  },
  doctorId: {
    type: String,
    required: true,
    index: true
  },
  doctorUserId: {
    type: String,
    required: true,
    index: true
  },
  doctorName: {
    type: String,
    required: true
  },
  doctorSpecialization: {
    type: String,
    default: ''
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  timeSlot: {
    startTime: { type: String, required: true }, // "09:00"
    endTime: { type: String, required: true }     // "09:30"
  },
  type: {
    type: String,
    enum: ['consultation', 'follow-up', 'check-up', 'emergency'],
    default: 'consultation'
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled', 'no-show'],
    default: 'pending',
    index: true
  },
  reason: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  },
  prescription: {
    diagnosis: { type: String, default: '' },
    medicines: [{
      name: { type: String, required: true },
      dosage: { type: String, required: true },
      duration: { type: String, required: true },
      instructions: { type: String, default: '' }
    }],
    advice: { type: String, default: '' },
    issuedAt: { type: Date }
  },
  cancellationReason: {
    type: String,
    default: ''
  },
  consultationFee: {
    type: Number,
    default: 0
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded'],
    default: 'pending'
  },
  slotId: {
    type: String,
    required: true,
    index: true
  },
  razorpayOrderId: {
    type: String,
    default: ''
  },
  razorpayPaymentId: {
    type: String,
    default: ''
  },
  razorpaySignature: {
    type: String,
    default: ''
  },
  // Video Call / Offline Consultation Type
  consultationType: {
    type: String,
    enum: ['offline', 'online'],
    default: 'offline'
  },
  videoCallLink: {
    type: String,
    default: ''
  },
  // Optimistic locking version field
  version: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Compound unique index to prevent double booking using deterministic slotId
// Only unique for active appointments (not cancelled)
appointmentSchema.index(
  { slotId: 1 },
  { 
    unique: true, 
    partialFilterExpression: { status: { $in: ['pending', 'confirmed', 'in-progress', 'completed'] } } 
  }
);

// Optimistic locking middleware
appointmentSchema.pre('save', function(next) {
  if (!this.isNew) {
    this.version += 1;
  }
  next();
});

module.exports = mongoose.model('Appointment', appointmentSchema);
