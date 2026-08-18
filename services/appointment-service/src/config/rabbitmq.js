const amqp = require('amqplib');
const { logger } = require('../utils/logger');
const { cacheDelete } = require('./redis');

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

    // Declare exchanges
    await channel.assertExchange('appointment_events', 'topic', { durable: true });
    await channel.assertExchange('notification_events', 'topic', { durable: true });
    await channel.assertExchange('doctor_events', 'topic', { durable: true });

    // Setup Doctor Events Subscriber
    const docQueue = await channel.assertQueue('', { exclusive: true });
    await channel.bindQueue(docQueue.queue, 'doctor_events', 'doctor.availability_updated');

    channel.consume(docQueue.queue, async (msg) => {
      if (msg !== null) {
        try {
          const eventConfig = JSON.parse(msg.content.toString());
          logger.info(`Received doctor_events: ${msg.fields.routingKey}`);
          
          if (msg.fields.routingKey === 'doctor.availability_updated' && eventConfig.doctorId) {
             const keyToClear = `availability:summary:${eventConfig.doctorId}`;
             await cacheDelete(keyToClear);
             logger.info(`Cleared availability cache for doctor: ${eventConfig.doctorId}`);
          }
          channel.ack(msg);
        } catch (error) {
          logger.error('Error processing doctor event:', error);
          channel.nack(msg);
        }
      }
    });

    logger.info('Appointment Service connected to RabbitMQ');
    console.log('🐰 Appointment Service connected to RabbitMQ');

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

const publishMessage = async (exchange, routingKey, message) => {
  try {
    if (channel) {
      channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(message)), { persistent: true });
      logger.info(`Published to ${exchange}: ${routingKey}`);
    }
  } catch (error) {
    logger.error('Error publishing message:', error);
  }
};

const getChannel = () => channel;

module.exports = { connectRabbitMQ, publishMessage, getChannel };
