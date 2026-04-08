const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI || "mongodb+srv://soumenmondal741150_db_user:SoumenDa123@cluster0.982qcmr.mongodb.net/user_db?retryWrites=true&w=majority";

async function recoverDoctors() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(uri);

    const userDb = mongoose.connection.useDb('user_db');
    const doctorDb = mongoose.connection.useDb('doctor_db');

    // 1. Find all inactive doctors in user_db
    const allDoctors = await userDb.collection('users').find({ role: 'doctor' }).toArray();
    console.log(`Found ${allDoctors.length} doctors total in user_db.`);

    let recoveredCount = 0;

    for (const doc of allDoctors) {
      const userIdStr = doc._id.toString();

      // 2. Check if they exist in doctor_db.doctors
      const existsInVerified = await doctorDb.collection('doctors').findOne({ userId: userIdStr });
      
      // 3. Check if they exist in doctor_db.pendingdoctors
      const existsInPending = await doctorDb.collection('pendingdoctors').findOne({ userId: userIdStr });

      if (!existsInVerified && !existsInPending) {
        // They were completely dropped! Recover them to Pending.
        const pendingDoc = {
          userId: userIdStr,
          firstName: doc.firstName || 'Unknown',
          lastName: doc.lastName || 'Unknown',
          email: doc.email,
          registrationNumber: `REC-${userIdStr.slice(-12).toUpperCase()}`,
          specialization: 'General Practice',
          consultationFee: 0,
          status: 'pending',
          isAvailable: true,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await doctorDb.collection('pendingdoctors').insertOne(pendingDoc);
        recoveredCount++;
        console.log(`Recovered missing pending doctor: ${doc.email}`);
      }
    }

    console.log(`\n✅ Recovery complete! Pushed ${recoveredCount} missing doctors to the Pending list.`);
  } catch (err) {
    console.error("Error during recovery:", err);
  } finally {
    process.exit(0);
  }
}

recoverDoctors();
