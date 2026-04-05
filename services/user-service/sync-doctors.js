const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI || "mongodb+srv://soumenmondal741150_db_user:SoumenDa123@cluster0.982qcmr.mongodb.net/user_db?retryWrites=true&w=majority";

async function syncDoctors() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(uri);

    const doctorDb = mongoose.connection.useDb('doctor_db');
    const userDb = mongoose.connection.useDb('user_db');

    // Get all verified doctors from doctor_db
    const verifiedDoctors = await doctorDb.collection('doctors').find().toArray();
    console.log(`Found ${verifiedDoctors.length} verified doctors in doctor_db.`);

    let updatedCount = 0;
    
    // For each verified doctor, ensure their user account is Active
    for (const doc of verifiedDoctors) {
      if (doc.userId) {
        const result = await userDb.collection('users').updateOne(
          { _id: new mongoose.Types.ObjectId(doc.userId) },
          { $set: { isActive: true } }
        );
        if (result.modifiedCount > 0) {
          updatedCount++;
          console.log(`Synced missing active status for Doctor: ${doc.email}`);
        }
      }
    }

    console.log(`\n✅ Sync complete! Fixed ${updatedCount} out-of-sync doctors.`);
  } catch (err) {
    console.error("Error during sync:", err);
  } finally {
    process.exit(0);
  }
}

syncDoctors();
