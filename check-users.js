const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/user_db";

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
