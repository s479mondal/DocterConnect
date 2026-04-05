const User = require('../models/User');
const { logger } = require('../utils/logger');

exports.handleDoctorVerified = async (data) => {
  try {
    const { userId } = data;
    if (!userId) {
      logger.error('Invalid DOCTOR_VERIFIED event: Missing userId');
      return;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { isActive: true },
      { new: true }
    );

    if (user) {
      logger.info(`User activated after doctor verification: ${user.email} (userId: ${userId})`);
    } else {
      logger.warn(`User not found for activation: userId ${userId}`);
    }
  } catch (error) {
    logger.error('Error handling DOCTOR_VERIFIED event:', error);
  }
};
