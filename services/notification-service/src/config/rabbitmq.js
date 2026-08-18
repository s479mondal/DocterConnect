const amqp = require('amqplib');
const { logger } = require('../utils/logger');
const { handleNotificationEvent } = require('../handlers/notificationHandler');

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

    // Exchanges
    await channel.assertExchange('notification_events', 'topic', { durable: true });
    await channel.assertExchange('user_events', 'topic', { durable: true });
    await channel.assertExchange('appointment_events', 'topic', { durable: true });

    // Queue
    const q = await channel.assertQueue('notification_queue', { durable: true });

    // Bindings
    await channel.bindQueue(q.queue, 'notification_events', 'appointment.*');
    await channel.bindQueue(q.queue, 'user_events', 'user.registered');
    await channel.bindQueue(q.queue, 'appointment_events', 'appointment.*');

    // Consumer
    channel.consume(q.queue, async (msg) => {
      if (!msg) return;

      try {
        const content = JSON.parse(msg.content.toString());
        const routingKey = msg.fields.routingKey;

        logger.info(`Received event: ${routingKey}`, content);

        await handleNotificationEvent(routingKey, content);

        channel.ack(msg);
      } catch (error) {
        logger.error('Error processing message:', error);
        channel.nack(msg, false, false);
      }
    });

    logger.info('✅ Connected to RabbitMQ');
    console.log('🐰 Listening for events...');

    // Auto-reconnect on crash
    connection.on('close', () => {
      logger.warn('RabbitMQ closed. Reconnecting in 5 seconds...');
      setTimeout(() => connectRabbitMQ(10), 5000);
    });

    connection.on('error', (err) => {
      logger.error('RabbitMQ error:', err);
    });

  } catch (error) {
    logger.error('❌ RabbitMQ connection failed:', error.message);
    if (process.env.NODE_ENV === 'production' && !process.env.RABBITMQ_URL) {
      throw error;
    }

    if (retries > 0) {
      console.log(`🔁 Retrying... (${retries} retries left)`);
      setTimeout(() => connectRabbitMQ(retries - 1), 5000);
    } else {
      console.log('❌ Max retries reached. Service continuing without RabbitMQ.');
    }
  }
};

module.exports = { connectRabbitMQ };