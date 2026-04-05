const mongoose = require('mongoose');
const { logger } = require('../utils/logger');

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/appointment_db';
    await mongoose.connect(uri);
    logger.info('Appointment Service connected to MongoDB');
    console.log('📦 Appointment Service connected to MongoDB');
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    throw error;
  }
};

module.exports = { connectDB };
