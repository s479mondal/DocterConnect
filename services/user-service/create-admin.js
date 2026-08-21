const mongoose = require('mongoose');
const User = require('./src/models/User');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/user_db';

mongoose.connect(uri)
  .then(async () => {
    console.log('Connected to MongoDB Atlas...');
    
    const email = 'admin@dpm.com';
    const existingAdmin = await User.findOne({ email });
    
    if (existingAdmin) {
      existingAdmin.role = 'admin';
      await existingAdmin.save();
      console.log('✅ Admin user already existed, updated role to admin!');
    } else {
      const admin = new User({
        email: email,
        password: 'Admin@123', // The model will automatically hash this
        firstName: 'Super',
        lastName: 'Admin',
        role: 'admin',
        phone: '+91-9000000000',
        gender: 'male',
        isActive: true
      });
      await admin.save();
      console.log('✅ New Admin user successfully created!');
    }
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error creating admin:', err);
    process.exit(1);
  });
