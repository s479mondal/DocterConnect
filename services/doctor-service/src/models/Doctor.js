const mongoose = require('mongoose');

const weeklyAvailabilitySchema = new mongoose.Schema({
  day: {
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    required: true
  },
  startTime: { type: String, required: true }, // "09:00"
  endTime: { type: String, required: true },   // "17:00"
  slotDuration: { type: Number, default: 30 }, // Minutes
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

const doctorSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
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
    match: [/^[A-Z]{2}\d{2}\d{4}$/, 'Registration number must be in format XXYYZZZZ (e.g., AB241234)']
  },
  phone: {
    type: String,
    trim: true
  },
  specialization: {
    type: String,
    trim: true,
    index: true,
    default: 'General Practice'
  },
  qualifications: [{
    degree: String,
    institution: String,
    year: Number
  }],
  experience: {
    type: Number,
    default: 0,
    min: 0
  },
  consultationFee: {
    type: Number,
    min: 0,
    default: 0
  },
  bio: {
    type: String,
    default: ''
  },
  profileImage: {
    type: String,
    default: ''
  },
  availability: {
    weeklyAvailability: [weeklyAvailabilitySchema],
    exceptions: [exceptionSchema],
    timezone: { type: String, default: 'Asia/Kolkata' }
  },
  hospital: {
    name: String,
    address: String,
    city: String,
    state: String
  },
  rating: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0 }
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  version: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Text search index
doctorSchema.index({ firstName: 'text', lastName: 'text', specialization: 'text' });

// Optimistic locking - increment version on save
doctorSchema.pre('save', function(next) {
  this.version += 1;
  next();
});

module.exports = mongoose.model('Doctor', doctorSchema);
