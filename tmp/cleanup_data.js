const mongoose = require('mongoose');
const { createClient } = require('redis');

const URIs = {
  user: 'mongodb+srv://soumenmondal741150_db_user:SoumenDa123@cluster0.982qcmr.mongodb.net/user_db?retryWrites=true&w=majority',
  doctor: 'mongodb+srv://soumenmondal741150_db_user:SoumenDa123@cluster0.982qcmr.mongodb.net/doctor_db?retryWrites=true&w=majority',
  appointment: 'mongodb+srv://soumenmondal741150_db_user:SoumenDa123@cluster0.982qcmr.mongodb.net/appointment_db?retryWrites=true&w=majority'
};

const redisUrl = 'redis://localhost:6379';

async function cleanup() {
  console.log('🚀 Starting Data Wipe...');

  try {
    // 1. Cleanup User Service
    const userConn = await mongoose.createConnection(URIs.user).asPromise();
    const User = userConn.model('User', new mongoose.Schema({ role: String }, { strict: false }), 'users');
    const userDelete = await User.deleteMany({ role: 'doctor' });
    console.log(`✅ User Service: Deleted ${userDelete.deletedCount} doctor accounts.`);
    await userConn.close();

    // 2. Cleanup Doctor Service
    const doctorConn = await mongoose.createConnection(URIs.doctor).asPromise();
    const Doctor = doctorConn.model('Doctor', new mongoose.Schema({}, { strict: false }), 'doctors');
    const PendingDoctor = doctorConn.model('PendingDoctor', new mongoose.Schema({}, { strict: false }), 'pendingdoctors');
    const drDelete = await Doctor.deleteMany({});
    const pendingDelete = await PendingDoctor.deleteMany({});
    console.log(`✅ Doctor Service: Deleted ${drDelete.deletedCount} doctors and ${pendingDelete.deletedCount} pending records.`);
    await doctorConn.close();

    // 3. Cleanup Appointment Service
    const apptConn = await mongoose.createConnection(URIs.appointment).asPromise();
    const Appointment = apptConn.model('Appointment', new mongoose.Schema({}, { strict: false }), 'appointments');
    const SlotLock = apptConn.model('SlotLock', new mongoose.Schema({}, { strict: false }), 'slotlocks');
    const apptDelete = await Appointment.deleteMany({});
    const lockDelete = await SlotLock.deleteMany({});
    console.log(`✅ Appointment Service: Deleted ${apptDelete.deletedCount} appointments and ${lockDelete.deletedCount} slot locks.`);
    await apptConn.close();

    // 4. Cleanup Redis
    const redisClient = createClient({ url: redisUrl });
    await redisClient.connect();
    await redisClient.flushAll();
    console.log('✅ Redis Cache: Flushed all data.');
    await redisClient.disconnect();

    console.log('\n✨ WIPE COMPLETE. You have a fresh system!');
  } catch (err) {
    console.error('❌ Error during cleanup:', err);
  } finally {
    process.exit(0);
  }
}

cleanup();
