const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ATLAS_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/';

// Schemas
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  firstName: String,
  lastName: String,
  role: { type: String, enum: ['patient', 'doctor', 'admin'] }
}, { timestamps: true });

const doctorSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  firstName: String,
  lastName: String,
  email: String,
  specialization: String,
  experience: Number,
  consultationFee: Number,
  hospital: { name: String, city: String },
  isVerified: { type: Boolean, default: false },
  isAvailable: { type: Boolean, default: true }
}, { timestamps: true });

async function setupData() {
  let userConn, doctorConn;
  try {
    console.log('🚀 Connecting to Atlas...');
    
    // 1. Connect to user_db
    userConn = await mongoose.createConnection(`${ATLAS_URI}user_db?retryWrites=true&w=majority`).asPromise();
    const User = userConn.model('User', userSchema);
    console.log('✅ Connected to user_db');

    // 2. Connect to doctor_db
    doctorConn = await mongoose.createConnection(`${ATLAS_URI}doctor_db?retryWrites=true&w=majority`).asPromise();
    const Doctor = doctorConn.model('Doctor', doctorSchema);
    console.log('✅ Connected to doctor_db');

    // Create Admin
    const adminEmail = 'admin@dpm.com';
    const hashedPassword = await bcrypt.hash('Admin@123', 12);
    
    await User.findOneAndUpdate(
      { email: adminEmail },
      { 
        email: adminEmail, 
        password: hashedPassword, 
        firstName: 'System', 
        lastName: 'Administrator', 
        role: 'admin' 
      },
      { upsert: true, new: true }
    );
    console.log('✅ Admin user created/updated in user_db');

    // Create Pending Doctor
    const doctorEmail = 'pending.doctor@dpm.com';
    const doctorUser = await User.findOneAndUpdate(
      { email: doctorEmail },
      { 
        email: doctorEmail, 
        password: hashedPassword, 
        firstName: 'Test', 
        lastName: 'Doctor', 
        role: 'doctor' 
      },
      { upsert: true, new: true }
    );
    console.log('✅ Pending doctor user created/updated in user_db');

    // Create Doctor Profile in doctor_db
    await Doctor.findOneAndUpdate(
      { userId: doctorUser._id.toString() },
      {
        userId: doctorUser._id.toString(),
        firstName: 'Test',
        lastName: 'Doctor',
        email: doctorEmail,
        specialization: 'Cardiology',
        experience: 15,
        consultationFee: 800,
        hospital: { name: 'Metro Health', city: 'Delhi' },
        isVerified: false,
        isAvailable: true
      },
      { upsert: true, new: true }
    );
    console.log('✅ Pending doctor profile matching userId created/updated in doctor_db');

    console.log('\n🌟 SETUP COMPLETED SUCCESSFULLY!');
    console.log('Admin login: admin@dpm.com / Admin@123');
    console.log('Test Pending Doctor: pending.doctor@dpm.com / Admin@123');

  } catch (error) {
    console.error('❌ Error during setup:', error);
  } finally {
    if (userConn) await userConn.close();
    if (doctorConn) await doctorConn.close();
    process.exit(0);
  }
}

setupData();
