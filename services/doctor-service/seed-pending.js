const mongoose = require('mongoose');
const uri = 'mongodb+srv://soumenmondal741150_db_user:SoumenDa123@cluster0.982qcmr.mongodb.net/doctor_db?retryWrites=true&w=majority';

const doctorSchema = new mongoose.Schema({
  userId: String,
  firstName: String,
  lastName: String,
  email: String,
  specialization: String,
  experience: Number,
  consultationFee: Number,
  hospital: { name: String, city: String },
  isVerified: { type: Boolean, default: false },
  isAvailable: { type: Boolean, default: true },
  qualifications: [{ degree: String, institution: String, year: Number }]
});

const Doctor = mongoose.model('Doctor', doctorSchema);

mongoose.connect(uri)
  .then(async () => {
    const doc = new Doctor({
      userId: 'dummy_user_id',
      firstName: 'Test',
      lastName: 'Pending',
      email: 'pending@doc.com',
      specialization: 'Neurology',
      experience: 12,
      consultationFee: 1200,
      hospital: { name: 'City Hospital', city: 'Mumbai' },
      isVerified: false,
      qualifications: [{ degree: 'MBBS', institution: 'KEM', year: 2010 }]
    });
    await doc.save();
    console.log('✅ Pending doctor created for testing!');
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
