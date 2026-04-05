const mongoose = require('mongoose');

const uri = "mongodb+srv://soumenmondal741150_db_user:SoumenDa123@cluster0.982qcmr.mongodb.net/user_db?retryWrites=true&w=majority";

async function run() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const users = await db.collection('users').find({ role: 'doctor' }).toArray();
  console.log('--- DOCTORS in user_db ---');
  users.forEach(u => {
    console.log(`Email: ${u.email}, Active: ${u.isActive}, CreatedAt: ${u.createdAt}`);
  });

  process.exit(0);
}

run();
