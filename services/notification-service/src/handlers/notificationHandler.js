const { logger } = require('../utils/logger');
const { sendEmail } = require('../utils/emailSender');

// In-memory notification store (in production, use a database)
const notifications = [];

const handleNotificationEvent = async (routingKey, data) => {
  let notification = null;

  switch (routingKey) {
    case 'user.registered':
      notification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: data.userId,
        email: data.email,
        type: 'welcome',
        title: 'Welcome to DoctorConnect!',
        message: `Hello ${data.firstName}! Your account has been successfully created. Start browsing doctors and book your first appointment.`,
        read: false,
        createdAt: new Date()
      };
      break;

    case 'appointment.booked':
    case 'appointment.created':
      notification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: data.patientId,
        email: data.patientEmail,
        type: 'appointment_booked',
        title: 'Appointment Booked',
        message: `Your appointment with Dr. ${data.doctorName} on ${new Date(data.date).toLocaleDateString()} at ${data.timeSlot?.startTime || 'TBD'} has been booked successfully.`,
        data: { appointmentId: data.appointmentId },
        read: false,
        createdAt: new Date()
      };
      // Also notify doctor
      notifications.push({
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: data.doctorId,
        type: 'new_appointment',
        title: 'New Appointment',
        message: `New appointment from ${data.patientName} on ${new Date(data.date).toLocaleDateString()} at ${data.timeSlot?.startTime || 'TBD'}.`,
        data: { appointmentId: data.appointmentId },
        read: false,
        createdAt: new Date()
      });
      break;

    case 'appointment.confirmed':
      notification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: data.patientId,
        email: data.patientEmail,
        type: 'appointment_confirmed',
        title: 'Appointment Confirmed',
        message: `Your appointment with Dr. ${data.doctorName} on ${new Date(data.date).toLocaleDateString()} has been confirmed.`,
        data: { appointmentId: data.appointmentId },
        read: false,
        createdAt: new Date()
      };
      break;

    case 'appointment.cancelled':
      notification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: data.patientId,
        email: data.patientEmail,
        type: 'appointment_cancelled',
        title: 'Appointment Cancelled',
        message: `Your appointment with Dr. ${data.doctorName} on ${new Date(data.date).toLocaleDateString()} has been cancelled.`,
        data: { appointmentId: data.appointmentId },
        read: false,
        createdAt: new Date()
      };
      break;

    case 'appointment.completed':
      notification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: data.patientId,
        email: data.patientEmail,
        type: 'appointment_completed',
        title: 'Appointment Completed',
        message: `Your appointment with Dr. ${data.doctorName} has been marked as completed. View your prescription and notes in your appointment history.`,
        data: { appointmentId: data.appointmentId },
        read: false,
        createdAt: new Date()
      };
      break;

    default:
      logger.info(`Unhandled event: ${routingKey}`);
      return;
  }

  if (notification) {
    notifications.push(notification);
    logger.info(`Notification created: ${notification.title} for user ${notification.userId}`);
    
    // In production: send email, push notification, SMS, etc.
    console.log(`📧 [NOTIFICATION] ${notification.title}: ${notification.message}`);
    
    if (notification.email) {
      await sendEmail(
        notification.email,
        notification.title,
        notification.message
      );
    }
  }
};

const getNotifications = (userId) => {
  return notifications
    .filter(n => n.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

const markAsRead = (notificationId) => {
  const notif = notifications.find(n => n.id === notificationId);
  if (notif) {
    notif.read = true;
    return true;
  }
  return false;
};

const getUnreadCount = (userId) => {
  return notifications.filter(n => n.userId === userId && !n.read).length;
};

module.exports = { handleNotificationEvent, getNotifications, markAsRead, getUnreadCount };
