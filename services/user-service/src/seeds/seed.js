const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config();

// Connect to user_db
const userDB = mongoose.createConnection(process.env.MONGODB_URI || 'mongodb://admin:admin123@localhost:27017/user_db?authSource=admin');
// Connect to doctor_db
const doctorDB = mongoose.createConnection(process.env.MONGODB_URI_DOCTOR || 'mongodb://admin:admin123@localhost:27017/doctor_db?authSource=admin');

// User Schema (same as model)
const userSchema = new mongoose.Schema({
  email: String, password: String, firstName: String, lastName: String,
  role: String, phone: String, gender: String, isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Doctor Schema (same as model)
const doctorSchema = new mongoose.Schema({
  userId: String, firstName: String, lastName: String, email: String, phone: String,
  specialization: String, qualifications: [{ degree: String, institution: String, year: Number }],
  experience: Number, consultationFee: Number, bio: String, profileImage: String,
  schedule: [{ day: String, startTime: String, endTime: String, isAvailable: Boolean }],
  hospital: { name: String, address: String, city: String, state: String },
  rating: { average: Number, count: Number }, isAvailable: Boolean, isVerified: Boolean, version: Number
}, { timestamps: true });

const User = userDB.model('User', userSchema);
const Doctor = doctorDB.model('Doctor', doctorSchema);

const seedData = async () => {
  try {
    console.log('🌱 Starting seed...');

    // Clear existing data
    await User.deleteMany({});
    await Doctor.deleteMany({});

    const hashedPassword = await bcrypt.hash('password123', 12);

    // Create users
    const users = await User.insertMany([
      { email: 'admin@demo.com', password: hashedPassword, firstName: 'System', lastName: 'Administrator', role: 'admin', phone: '+91-9876543200', gender: 'male' },
      { email: 'patient1@demo.com', password: hashedPassword, firstName: 'Rahul', lastName: 'Sharma', role: 'patient', phone: '+91-9876543210', gender: 'male' },
      { email: 'patient2@demo.com', password: hashedPassword, firstName: 'Priya', lastName: 'Patel', role: 'patient', phone: '+91-9876543211', gender: 'female' },
      { email: 'dr.kumar@demo.com', password: hashedPassword, firstName: 'Arun', lastName: 'Kumar', role: 'doctor', phone: '+91-9876543212', gender: 'male' },
      { email: 'dr.singh@demo.com', password: hashedPassword, firstName: 'Meera', lastName: 'Singh', role: 'doctor', phone: '+91-9876543213', gender: 'female' },
      { email: 'dr.gupta@demo.com', password: hashedPassword, firstName: 'Vikram', lastName: 'Gupta', role: 'doctor', phone: '+91-9876543214', gender: 'male' },
      { email: 'dr.reddy@demo.com', password: hashedPassword, firstName: 'Lakshmi', lastName: 'Reddy', role: 'doctor', phone: '+91-9876543215', gender: 'female' },
      { email: 'dr.das@demo.com', password: hashedPassword, firstName: 'Amit', lastName: 'Das', role: 'doctor', phone: '+91-9876543216', gender: 'male' },
      { email: 'dr.mishra@demo.com', password: hashedPassword, firstName: 'Neha', lastName: 'Mishra', role: 'doctor', phone: '+91-9876543217', gender: 'female' },
    ]);

    console.log(`✅ Created ${users.length} users`);

    const defaultSchedule = [
      { day: 'monday', startTime: '09:00', endTime: '17:00', isAvailable: true },
      { day: 'tuesday', startTime: '09:00', endTime: '17:00', isAvailable: true },
      { day: 'wednesday', startTime: '09:00', endTime: '17:00', isAvailable: true },
      { day: 'thursday', startTime: '09:00', endTime: '17:00', isAvailable: true },
      { day: 'friday', startTime: '09:00', endTime: '15:00', isAvailable: true },
      { day: 'saturday', startTime: '10:00', endTime: '14:00', isAvailable: true },
    ];

    // Drop indexes to clear any duplicate registrationNumber constraint
    await Doctor.collection.dropIndexes().catch(() => {});

    // Create doctors
    const doctorUsers = users.filter(u => u.role === 'doctor');
    const specializations = [
      { spec: 'Cardiology', fee: 1500, hospital: 'Apollo Heart Centre', city: 'Mumbai', bio: 'Expert cardiologist with 15+ years of experience in interventional cardiology and cardiac care.' },
      { spec: 'Dermatology', fee: 800, hospital: 'Skin & Care Clinic', city: 'Delhi', bio: 'Board-certified dermatologist specializing in cosmetic dermatology and skin disorders.' },
      { spec: 'Orthopedics', fee: 1200, hospital: 'Fortis Hospital', city: 'Bangalore', bio: 'Orthopedic surgeon specializing in joint replacement and sports medicine.' },
      { spec: 'Pediatrics', fee: 700, hospital: 'Rainbow Children Hospital', city: 'Hyderabad', bio: 'Compassionate pediatrician with expertise in newborn care and child development.' },
      { spec: 'Neurology', fee: 2000, hospital: 'NIMHANS', city: 'Bangalore', bio: 'Neurologist specializing in stroke management and neurodegenerative diseases.' },
      { spec: 'Ophthalmology', fee: 900, hospital: 'Sankara Nethralaya', city: 'Chennai', bio: 'Eye specialist with expertise in cataract surgery and retinal disorders.' }
    ];

    const doctors = await Doctor.insertMany(
      doctorUsers.map((user, i) => ({
        userId: user._id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        registrationNumber: `REG-${1000 + i}`,
        specialization: specializations[i].spec,
        qualifications: [
          { degree: 'MBBS', institution: 'AIIMS Delhi', year: 2005 + i },
          { degree: 'MD', institution: 'PGIMER Chandigarh', year: 2008 + i }
        ],
        experience: 10 + i * 2,
        consultationFee: specializations[i].fee,
        bio: specializations[i].bio,
        profileImage: '',
        schedule: defaultSchedule,
        hospital: {
          name: specializations[i].hospital,
          address: `${100 + i} Medical Street`,
          city: specializations[i].city,
          state: 'India'
        },
        rating: { average: 4.0 + (Math.random() * 0.9), count: 50 + Math.floor(Math.random() * 200) },
        isAvailable: true,
        isVerified: true,
        version: 0
      }))
    );

    console.log(`✅ Created ${doctors.length} doctor profiles`);
    console.log('\n🎉 Seed completed successfully!');
    console.log('\n📋 Demo Accounts:');
    console.log('   Admin:   admin@demo.com / password123');
    console.log('   Patient: patient1@demo.com / password123');
    console.log('   Patient: patient2@demo.com / password123');
    console.log('   Doctor:  dr.kumar@demo.com / password123');
    console.log('   Doctor:  dr.singh@demo.com / password123');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
};

seedData();
