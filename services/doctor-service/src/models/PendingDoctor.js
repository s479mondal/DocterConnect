const mongoose = require('mongoose');

const weeklyAvailabilitySchema = new mongoose.Schema({
  day: {
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    required: true
  },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  slotDuration: { type: Number, default: 30 },
  isAvailable: { type: Boolean, default: true }
});

const exceptionSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  type: { type: String, enum: ['CLOSED', 'OVERRIDE'], required: true },
  startTime: String,
  endTime: String,
  slotDuration: Number,
  reason: String
});

const pendingDoctorSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  registrationNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    match: [/^[A-Z0-9-]{3,40}$/i, 'Registration number must be alphanumeric and between 3-40 characters (e.g., AB241234 or REG-12345)']
  },
  phone: {
    type: String,
    trim: true
  },
  specialization: {
    type: String,
    default: 'General Practice'
  },
  qualifications: [{
    degree: String,
    institution: String,
    year: Number
  }],
  experience: {
    type: Number,
    default: 0
  },
  consultationFee: {
    type: Number,
    default: 0
  },
  bio: {
    type: String,
    default: ''
  },
  hospital: {
    name: String,
    address: String,
    city: String,
    state: String
  },
  availability: {
    weeklyAvailability: [weeklyAvailabilitySchema],
    exceptions: [exceptionSchema],
    timezone: { type: String, default: 'Asia/Kolkata' }
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['pending', 'rejected'],
    default: 'pending'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('PendingDoctor', pendingDoctorSchema);
