const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const { connectDB } = require('./config/database');
const { connectRedis } = require('./config/redis');
const { connectRabbitMQ } = require('./config/rabbitmq');
const { logger } = require('./utils/logger');
const doctorRoutes = require('./routes/doctor');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// app.use(cors()); // Disabled - CORS is handled centrally at the API Gateway
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'Doctor Service is running', timestamp: new Date().toISOString() });
});

app.use('/api/doctors', doctorRoutes);

// Error handling
app.use((err, req, res, next) => {
  logger.error(err.message, { stack: err.stack });
  res.status(err.statusCode || 500).json({ error: err.message || 'Internal Server Error' });
});

const startServer = async () => {
  try {
    await connectDB();
    await connectRedis();
    await connectRabbitMQ();
    app.listen(PORT, () => {
      logger.info(`Doctor Service running on port ${PORT}`);
      console.log(`🩺 Doctor Service running on http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start Doctor Service:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
