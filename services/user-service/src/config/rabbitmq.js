const amqp = require('amqplib');
const { logger } = require('../utils/logger');
const userUpdateHandler = require('../handlers/userUpdateHandler');

let channel = null;
let connection = null;

const connectRabbitMQ = async () => {
  try {
    const url = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
    connection = await amqp.connect(url);
    channel = await connection.createChannel();
    
    // Declare exchanges
    await channel.assertExchange('user_events', 'topic', { durable: true });
    
    logger.info('User Service connected to RabbitMQ');
    console.log('🐰 User Service connected to RabbitMQ');

    // Start consumers
    await initializeConsumers();

    connection.on('error', (err) => {
      logger.error('RabbitMQ connection error:', err);
    });

    connection.on('close', () => {
      logger.warn('RabbitMQ connection closed. Reconnecting...');
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

    // 1. Consume Doctor Verification events
    await channel.assertExchange('doctor_events', 'topic', { durable: true });
    const queue = await channel.assertQueue('user_activation_queue', { durable: true });
    await channel.bindQueue(queue.queue, 'doctor_events', 'doctor.verified');

    channel.consume(queue.queue, async (msg) => {
      if (msg) {
        const data = JSON.parse(msg.content.toString());
        logger.info('Consumer received doctor.verified:', data);

        await userUpdateHandler.handleDoctorVerified(data);
        channel.ack(msg);
      }
    });

    logger.info('User Service consumers initialized');
  } catch (error) {
    logger.error('Error initializing consumers:', error);
  }
};

const publishMessage = async (exchange, routingKey, message) => {
  try {
    if (channel) {
      channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(message)), { persistent: true });
      logger.info(`Message published to ${exchange} with key ${routingKey}`);
    }
  } catch (error) {
    logger.error('Error publishing message:', error);
  }
};

const getChannel = () => channel;

module.exports = { connectRabbitMQ, publishMessage, getChannel };
