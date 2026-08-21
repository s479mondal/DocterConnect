const mongoose = require('mongoose');
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');


const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/user_db";

async function run() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const users = await db.collection('users').find({ role: 'doctor' }).toArray();
  console.log('\n--- DOCTORS in user_db ---');
  users.forEach(u => {
    console.log(`Email: ${u.email}, Role: ${u.role}, Active: ${u.isActive}, id: ${u._id}`);
  });

  const pendingDoctors = await mongoose.connection.useDb('doctor_db').collection('pendingdoctors').find().toArray();
  console.log('\n--- PENDING DOCTORS in doctor_db ---');
  pendingDoctors.forEach(pd => {
    console.log(`Email: ${pd.email}, id: ${pd._id}, userId: ${pd.userId}`);
  });

  const verifiedDoctors = await mongoose.connection.useDb('doctor_db').collection('doctors').find().toArray();
  console.log('\n--- VERIFIED DOCTORS in doctor_db ---');
  verifiedDoctors.forEach(vd => {
    console.log(`Email: ${vd.email}, userId: ${vd.userId}, isVerified: ${vd.isVerified}`);
  });

  process.exit(0);
}

run();
