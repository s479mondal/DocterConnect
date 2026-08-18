const amqp = require('amqplib');
const { logger } = require('../utils/logger');
const PendingDoctor = require('../models/PendingDoctor');

let channel = null;

const getRabbitMQUrl = () => {
  const url = process.env.RABBITMQ_URL;
  if (url) return url;
  if (process.env.NODE_ENV === 'production') {
    const errorMsg = 'FATAL: RABBITMQ_URL environment variable is required in production mode!';
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }
  logger.warn('RABBITMQ_URL not provided. Falling back to local development URL: amqp://localhost:5672');
  return 'amqp://localhost:5672';
};

const connectRabbitMQ = async (retries = 10) => {
  try {
    const url = getRabbitMQUrl();
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
      logger.warn('RabbitMQ closed. Reconnecting in 5 seconds...');
      setTimeout(() => connectRabbitMQ(10), 5000);
    });
  } catch (error) {
    logger.error('RabbitMQ connection error:', error.message);
    if (process.env.NODE_ENV === 'production' && !process.env.RABBITMQ_URL) {
      throw error;
    }
    if (retries > 0) {
      console.log(`⚠️ RabbitMQ not available. Retrying in 5 seconds... (${retries} retries left)`);
      setTimeout(() => connectRabbitMQ(retries - 1), 5000);
    } else {
      console.log('⚠️ RabbitMQ max retries reached. Service continuing without RabbitMQ.');
    }
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
            // Check if already in Doctor or PendingDoctor
            const existingDoctor = await PendingDoctor.findOne({ userId: data.userId });
            const confirmedDoctor = await require('../models/Doctor').findOne({ userId: data.userId });
            
            if (!existingDoctor && !confirmedDoctor) {
              await PendingDoctor.create({
                userId: data.userId,
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.email,
                // Ensure registrationNumber matches regex if provided, otherwise generate a valid fallback
                registrationNumber: (data.registrationNumber && /^[A-Z0-9-]{3,20}$/i.test(data.registrationNumber))
                  ? data.registrationNumber 
                  : `REG-${data.userId.slice(-8).toUpperCase()}`,
                consultationFee: data.consultationFee || 0
              });
              logger.info(`Staged pending doctor: ${data.email}`);
            } else {
              logger.info(`Doctor already exists (pending or confirmed): ${data.email}. Skipping creation.`);
            }
          } catch (err) {
            logger.error('Error creating pending doctor record:', { 
              error: err.message, 
              stack: err.stack,
              data: { email: data.email, userId: data.userId }
            });
            // If it's a validation error, we still ACK to avoid infinite loop, 
            // but we've logged sufficiently to troubleshoot.
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
