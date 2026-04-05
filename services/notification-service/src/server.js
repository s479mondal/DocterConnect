const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const { connectRabbitMQ } = require('./config/rabbitmq');
const { logger } = require('./utils/logger');
const notificationRoutes = require('./routes/notification');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3004;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (req, res) => {
  res.json({ status: 'Notification Service is running', timestamp: new Date().toISOString() });
});

app.use('/api/notifications', notificationRoutes);

app.use((err, req, res, next) => {
  logger.error(err.message, { stack: err.stack });
  res.status(err.statusCode || 500).json({ error: err.message || 'Internal Server Error' });
});

const startServer = async () => {
  try {
    await connectRabbitMQ();
    app.listen(PORT, () => {
      logger.info(`Notification Service running on port ${PORT}`);
      console.log(`🔔 Notification Service running on http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start Notification Service:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
