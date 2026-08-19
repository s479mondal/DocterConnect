const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const { connectDB } = require('./config/database');
const { connectRabbitMQ } = require('./config/rabbitmq');
const { connectRedis } = require('./config/redis');
const { logger } = require('./utils/logger');
const appointmentRoutes = require('./routes/appointment');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;

// app.use(cors()); // Disabled - CORS is handled centrally at the API Gateway
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (req, res) => {
  res.json({ status: 'Appointment Service is running', timestamp: new Date().toISOString() });
});

app.use('/api/appointments', appointmentRoutes);

app.use((err, req, res, next) => {
  logger.error(err.message, { stack: err.stack });
  res.status(err.statusCode || 500).json({ error: err.message || 'Internal Server Error' });
});

const startServer = async () => {
  try {
    await connectDB();
    await connectRabbitMQ();
    await connectRedis();
    app.listen(PORT, () => {
      logger.info(`Appointment Service running on port ${PORT}`);
      console.log(`📅 Appointment Service running on http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start Appointment Service:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
