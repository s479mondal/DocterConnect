const mongoose = require('mongoose');

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';

async function checkAllData() {
  let userConn, doctorConn, appointmentConn;
  try {
    console.log('====================================================');
    console.log('🔍 FETCHING ALL DATABASE DATA ACROSS MICROSERVICES');
    console.log('====================================================\n');

    // 1. user_db -> users
    userConn = await mongoose.createConnection(`${mongoUri}/user_db`).asPromise();
    const User = userConn.model('User', new mongoose.Schema({}, { strict: false }));
    const users = await User.find({}).select('-password -__v').lean();
    console.log(`👤 USER_DB (Total Users: ${users.length}):`);
    console.table(users.map(u => ({
      ID: u._id.toString(),
      Email: u.email,
      Name: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
      Role: u.role,
      Active: u.isActive
    })));

    // 2. doctor_db -> doctors & pendingdoctors
    doctorConn = await mongoose.createConnection(`${mongoUri}/doctor_db`).asPromise();
    const Doctor = doctorConn.model('Doctor', new mongoose.Schema({}, { strict: false }));
    const PendingDoctor = doctorConn.model('PendingDoctor', new mongoose.Schema({}, { strict: false }));
    
    const doctors = await Doctor.find({}).select('-__v').lean();
    const pendingDoctors = await PendingDoctor.find({}).select('-__v').lean();

    console.log(`\n🩺 DOCTOR_DB (Active Doctors: ${doctors.length}):`);
    console.table(doctors.map(d => ({
      ID: d._id.toString(),
      Name: `Dr. ${d.firstName || ''} ${d.lastName || ''}`.trim(),
      Email: d.email,
      Specialization: d.specialization,
      Fee: `₹${d.consultationFee}`,
      Verified: d.isVerified
    })));

    console.log(`\n⏳ DOCTOR_DB (Pending Approval: ${pendingDoctors.length}):`);
    console.table(pendingDoctors.map(p => ({
      ID: p._id.toString(),
      Name: `Dr. ${p.firstName || ''} ${p.lastName || ''}`.trim(),
      Email: p.email,
      RegNo: p.registrationNumber,
      Status: p.status || 'pending'
    })));

    // 3. appointment_db -> appointments
    appointmentConn = await mongoose.createConnection(`${mongoUri}/appointment_db`).asPromise();
    const Appointment = appointmentConn.model('Appointment', new mongoose.Schema({}, { strict: false }));
    const appointments = await Appointment.find({}).select('-__v').lean();

    console.log(`\n📅 APPOINTMENT_DB (Total Appointments: ${appointments.length}):`);
    console.table(appointments.map(a => ({
      ID: a._id.toString(),
      PatientID: a.patientId,
      DoctorID: a.doctorId,
      Date: a.date,
      Time: a.startTime,
      Status: a.status,
      Payment: a.paymentStatus
    })));

    console.log('\n====================================================');
  } catch (error) {
    console.error('❌ Error fetching data:', error.message);
  } finally {
    if (userConn) await userConn.close();
    if (doctorConn) await doctorConn.close();
    if (appointmentConn) await appointmentConn.close();
    process.exit(0);
  }
}

checkAllData();
