try { require('dns').setServers(['8.8.8.8', '8.8.4.4']); } catch (_) {}
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const { connectDB } = require('./config/database');
const { connectRabbitMQ } = require('./config/rabbitmq');
const { logger } = require('./utils/logger');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'User Service is running', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// Error handling
app.use((err, req, res, next) => {
  logger.error(err.message, { stack: err.stack });
  res.status(err.statusCode || 500).json({ error: err.message || 'Internal Server Error' });
});

// Start server
const startServer = async () => {
  try {
    await connectDB();
    await connectRabbitMQ();
    app.listen(PORT, () => {
      logger.info(`User Service running on port ${PORT}`);
      console.log(`👤 User Service running on http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start User Service:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
