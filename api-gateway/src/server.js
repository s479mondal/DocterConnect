const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const { logger } = require('./utils/logger');
const proxyRoutes = require('./routes/proxy');
const { errorHandler } = require('./middleware/errorHandler');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable trust proxy for Render / reverse proxies so rate-limit uses real client IPs
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://35.200.199.76:5173',
  'http://35.200.199.76:3000',
  'https://docter-connect-vit.vercel.app'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const normalizedOrigin = origin.replace(/\/$/, '');
    if (allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept', 'X-Requested-With']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Rate limiting - restored with trust proxy to prevent false 429s from load balancers
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,
  message: { error: 'Too many requests, please try again later.' }
});

// Apply rate limiter to all /api routes EXCEPT /api/warmup
app.use('/api/', (req, res, next) => {
  if (req.path === '/warmup') {
    return next();
  }
  return limiter(req, res, next);
});

// Logging
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'API Gateway is running', timestamp: new Date().toISOString() });
});

// Warmup endpoint to wake up all downstream Render microservices in parallel
const handleWarmup = async (req, res) => {
  const services = [
    { name: 'user-service', url: `${process.env.USER_SERVICE_URL || 'http://localhost:3001'}/health` },
    { name: 'doctor-service', url: `${process.env.DOCTOR_SERVICE_URL || 'http://localhost:3002'}/health` },
    { name: 'appointment-service', url: `${process.env.APPOINTMENT_SERVICE_URL || 'http://localhost:3003'}/health` },
    { name: 'notification-service', url: `${process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3004'}/health` },
  ];

  const results = await Promise.allSettled(
    services.map(async (s) => {
      try {
        const response = await fetch(s.url, { signal: AbortSignal.timeout(25000) });
        return { name: s.name, status: response.ok ? 'awake' : 'starting', statusCode: response.status };
      } catch (err) {
        return { name: s.name, status: 'waking_up', error: err.message };
      }
    })
  );

  res.json({
    status: 'Warmup initiated',
    gateway: 'awake',
    timestamp: new Date().toISOString(),
    services: results.map((r, i) => r.value || { name: services[i].name, status: 'waking_up' })
  });
};

app.get('/warmup', handleWarmup);
app.get('/api/warmup', handleWarmup);

// Proxy routes to microservices
app.use('/api', proxyRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  logger.info(`API Gateway running on port ${PORT}`);
  console.log(`🚀 API Gateway running on http://localhost:${PORT}`);
});

module.exports = app;
