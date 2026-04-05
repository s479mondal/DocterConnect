const amqp = require('amqplib');
const { logger } = require('../utils/logger');
const PendingDoctor = require('../models/PendingDoctor');

let channel = null;

const connectRabbitMQ = async () => {
  try {
    const url = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
    const connection = await amqp.connect(url);
    channel = await connection.createChannel();
    await channel.assertExchange('doctor_events', 'topic', { durable: true });
    await channel.assertExchange('user_events', 'topic', { durable: true });
    logger.info('Doctor Service connected to RabbitMQ');
    console.log('🐰 Doctor Service connected to RabbitMQ');

    // Start consumers
    await initializeConsumers();

    connection.on('error', (err) => logger.error('RabbitMQ error:', err));
    connection.on('close', () => {
      logger.warn('RabbitMQ closed. Reconnecting...');
      setTimeout(connectRabbitMQ, 5000);
    });
  } catch (error) {
    logger.error('RabbitMQ connection error:', error);
    console.log('⚠️ RabbitMQ not available. Retrying in 5 seconds...');
    setTimeout(connectRabbitMQ, 5000);
  }
};

const initializeConsumers = async () => {
  try {
    if (!channel) return;

    // 1. Consume User Registration events
    const queue = await channel.assertQueue('doctor_registration_queue', { durable: true });
    await channel.bindQueue(queue.queue, 'user_events', 'user.registered');

    channel.consume(queue.queue, async (msg) => {
      if (msg) {
        const data = JSON.parse(msg.content.toString());
        logger.info('Consumer received user.registered:', data);

        if (data.role && data.role.toLowerCase() === 'doctor') {
          try {
            const existing = await PendingDoctor.findOne({ userId: data.userId });
            if (!existing) {
              await PendingDoctor.create({
                userId: data.userId,
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.email,
                registrationNumber: data.registrationNumber || `PENDING-${data.userId}`,
                consultationFee: data.consultationFee || 0
              });
              logger.info(`Staged pending doctor: ${data.email}`);
            }
          } catch (err) {
            logger.error('Error creating pending doctor:', err);
          }
        }
        channel.ack(msg);
      }
    });

    logger.info('Doctor Service consumers initialized');
  } catch (error) {
    logger.error('Error initializing consumers:', error);
  }
};

const publishMessage = async (exchange, routingKey, message) => {
  try {
    if (channel) {
      channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(message)), { persistent: true });
    }
  } catch (error) {
    logger.error('Error publishing message:', error);
  }
};

module.exports = { connectRabbitMQ, publishMessage };
