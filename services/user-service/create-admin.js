const mongoose = require('mongoose');
const User = require('./src/models/User');

const uri = 'mongodb+srv://soumenmondal741150_db_user:SoumenDa123@cluster0.982qcmr.mongodb.net/user_db?retryWrites=true&w=majority';

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
