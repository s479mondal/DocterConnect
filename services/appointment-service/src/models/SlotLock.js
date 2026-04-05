const mongoose = require('mongoose');

const slotLockSchema = new mongoose.Schema({
  slotId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  doctorId: {
    type: String,
    required: true,
    index: true
  },
  patientId: {
    type: String,
    required: true,
    index: true
  },
  date: {
    type: Date,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 } // TTL index: expires at the exactly specified time
  }
}, {
  timestamps: true
});

// Compound unique index to prevent multiple locks on same slot
slotLockSchema.index(
  { doctorId: 1, date: 1, startTime: 1 },
  { unique: true }
);

module.exports = mongoose.model('SlotLock', slotLockSchema);
