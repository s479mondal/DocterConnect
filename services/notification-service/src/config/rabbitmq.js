const amqp = require('amqplib');
const { logger } = require('../utils/logger');
const { handleNotificationEvent } = require('../handlers/notificationHandler');

let channel = null;

const connectRabbitMQ = async (retries = 10) => {
  const url = process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672';

  try {
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
      logger.warn('RabbitMQ closed. Reconnecting...');
      setTimeout(() => connectRabbitMQ(), 5000);
    });

    connection.on('error', (err) => {
      logger.error('RabbitMQ error:', err);
    });

  } catch (error) {
    logger.error('❌ RabbitMQ connection failed:', error.message);

    if (retries > 0) {
      console.log(`🔁 Retrying... (${retries})`);
      setTimeout(() => connectRabbitMQ(retries - 1), 5000);
    } else {
      console.log('❌ Max retries reached. Running without RabbitMQ.');
    }
  }
};

module.exports = { connectRabbitMQ };