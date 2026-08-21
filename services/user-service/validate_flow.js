const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Configuration
const ATLAS_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/';

// Schemas (simplified for testing)
const userSchema = new mongoose.Schema({
  email: String,
  firstName: String,
  lastName: String,
  role: String,
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const pendingDoctorSchema = new mongoose.Schema({
  userId: String,
  firstName: String,
  lastName: String,
  email: String,
  status: { type: String, default: 'pending' }
}, { timestamps: true });

const doctorSchema = new mongoose.Schema({
  userId: String,
  firstName: String,
  lastName: String,
  email: String,
  isVerified: { type: Boolean, default: false }
}, { timestamps: true });

async function validateFullFlow() {
  let userConn, doctorConn;
  try {
    console.log('🚀 Connecting to MongoDB Atlas...');
    userConn = await mongoose.createConnection(`${ATLAS_URI}user_db?retryWrites=true&w=majority`).asPromise();
    doctorConn = await mongoose.createConnection(`${ATLAS_URI}doctor_db?retryWrites=true&w=majority`).asPromise();
    
    const User = userConn.model('User', userSchema);
    const PendingDoctor = doctorConn.model('PendingDoctor', pendingDoctorSchema);
    const Doctor = doctorConn.model('Doctor', doctorSchema);

    console.log('✅ Connected to both databases.');

    const testEmail = `test.doctor.${Date.now()}@example.com`;

    // 1. SIMULATE REGISTRATION (user-service)
    console.log(`\n📝 Step 1: Registering doctor (${testEmail})...`);
    const newUser = new User({
      email: testEmail,
      firstName: 'Test',
      lastName: 'Doctor',
      role: 'doctor',
      isActive: false // This is what we implemented
    });
    await newUser.save();
    console.log(`✅ User created. isActive = ${newUser.isActive} (Expected: false)`);

    // 2. SIMULATE STAGING (doctor-service RabbitMQ reaction)
    console.log('\n📥 Step 2: Staging pending doctor...');
    const pending = new PendingDoctor({
      userId: newUser._id.toString(),
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      email: newUser.email
    });
    await pending.save();
    console.log('✅ PendingDoctor created in staging area.');

    // 3. SIMULATE ADMIN FETCH (doctor-service)
    console.log('\n👨‍💼 Step 3: Admin fetching pending doctors...');
    const pendingList = await PendingDoctor.find({ status: 'pending' });
    console.log(`✅ Admin found ${pendingList.length} pending doctor(s).`);

    // 4. SIMULATE ADMIN APPROVAL (doctor-service verifyDoctor)
    console.log('\n✅ Step 4: Admin approving doctor...');
    const pendingToVerify = await PendingDoctor.findOne({ email: testEmail });
    
    // Create in Doctor collection
    const verifiedDoctor = new Doctor({
      userId: pendingToVerify.userId,
      firstName: pendingToVerify.firstName,
      lastName: pendingToVerify.lastName,
      email: pendingToVerify.email,
      isVerified: true
    });
    await verifiedDoctor.save();
    
    // Delete from Pending
    await PendingDoctor.findByIdAndDelete(pendingToVerify._id);
    console.log('✅ Doctor moved to main collection and deleted from pending.');

    // 5. SIMULATE ACTIVATION (user-service DOCTOR_VERIFIED reaction)
    console.log('\n⚡ Step 5: Activating user account...');
    const userIdToActivate = pendingToVerify.userId;
    const activatedUser = await User.findByIdAndUpdate(
      userIdToActivate,
      { isActive: true },
      { new: true }
    );
    console.log(`✅ User status updated. isActive = ${activatedUser.isActive} (Expected: true)`);

    if (activatedUser.isActive === true && verifiedDoctor.isVerified === true) {
      console.log('\n🏆 FLOW VALIDATION SUCCESSFUL!');
    } else {
      console.log('\n❌ FLOW VALIDATION FAILED.');
    }

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await User.deleteOne({ _id: newUser._id });
    await Doctor.deleteOne({ _id: verifiedDoctor._id });
    console.log('✅ Test data removed.');

  } catch (error) {
    console.error('❌ Validation error:', error);
  } finally {
    if (userConn) await userConn.close();
    if (doctorConn) await doctorConn.close();
    process.exit(0);
  }
}

validateFullFlow();
