const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/appointment_db";

async function dropBrokenIndex() {
  try {
    console.log("Connecting to MongoDB Atlas...");
    await mongoose.connect(uri);
    console.log("Connected.");

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log("Collections in appointment_db:", collections.map(c => c.name));

    if (collections.some(c => c.name === 'slotlocks')) {
        const collection = db.collection('slotlocks');
        const indexes = await collection.indexes();
        console.log("Existing indexes:", indexes.map(i => i.name));

        const brokenIndexName = 'doctorId_1_date_1_startTime_1';
        if (indexes.some(i => i.name === brokenIndexName)) {
            console.log(`Dropping broken index: ${brokenIndexName}...`);
            await collection.dropIndex(brokenIndexName);
            console.log("Successfully dropped index.");
        } else {
            console.log("Broken index not found by name.");
            // Try to find by keys
            const indexByKeys = indexes.find(i => 
                i.key.doctorId === 1 && 
                i.key.date === 1 && 
                i.key.startTime === 1
            );
            if (indexByKeys) {
                console.log(`Dropping broken index by keys: ${indexByKeys.name}...`);
                await collection.dropIndex(indexByKeys.name);
                console.log("Successfully dropped index.");
            } else {
                console.log("No matching broken index found.");
            }
        }
    } else {
        console.log("slotlocks collection not found.");
    }
  } catch (err) {
    console.error("Error dropping index:", err);
  } finally {
    process.exit(0);
  }
}

dropBrokenIndex();
