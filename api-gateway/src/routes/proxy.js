const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { logger } = require('../utils/logger');

const router = express.Router();

// Service URLs
const USER_SERVICE = process.env.USER_SERVICE_URL || 'http://localhost:3001';
const DOCTOR_SERVICE = process.env.DOCTOR_SERVICE_URL || 'http://localhost:3002';
const APPOINTMENT_SERVICE = process.env.APPOINTMENT_SERVICE_URL || 'http://localhost:3003';
const NOTIFICATION_SERVICE = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3004';

// Proxy options factory
const createProxy = (target) => {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: (path, req) => {
      // Forward the full original URL to the microservices
      // e.g. /api/auth/login -> /api/auth/login instead of just /login
      return req.originalUrl;
    },
    on: {
      proxyReq: (proxyReq, req) => {
        // Forward user info from JWT
        if (req.user) {
          proxyReq.setHeader('X-User-Id', req.user.userId);
          proxyReq.setHeader('X-User-Role', req.user.role);
          proxyReq.setHeader('X-User-Email', req.user.email || '');
        }
        // Forward body for POST/PUT/PATCH
        if (req.body && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
          const bodyData = JSON.stringify(req.body);
          proxyReq.setHeader('Content-Type', 'application/json');
          proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
          proxyReq.write(bodyData);
        }
      },
      proxyRes: (proxyRes, req, res) => {
        // Strip out duplicate or conflicting CORS headers from microservices
        delete proxyRes.headers['access-control-allow-origin'];
        delete proxyRes.headers['access-control-allow-credentials'];
        delete proxyRes.headers['access-control-allow-methods'];
        delete proxyRes.headers['access-control-allow-headers'];
        delete proxyRes.headers['access-control-expose-headers'];
        
        logger.info(`[PROXY] ${req.method} ${req.originalUrl} -> ${proxyRes.statusCode}`);
      },
      error: (err, req, res) => {
        logger.error(`[PROXY ERROR] ${req.method} ${req.originalUrl}: ${err.message}`);
        res.status(502).json({ error: 'Service unavailable', message: err.message });
      }
    }
  });
};

// =============================================
// AUTH ROUTES (No auth required)
// =============================================
router.use('/auth', createProxy(USER_SERVICE));

// =============================================
// USER ROUTES (Auth required)
// =============================================
router.use('/users', authMiddleware, createProxy(USER_SERVICE));

// =============================================
// DOCTOR ROUTES (Mixed auth)
// =============================================
// Public routes - list and search doctors
router.get('/doctors', optionalAuth, (req, res, next) => next());
router.get('/doctors/search', optionalAuth, (req, res, next) => next());
router.get('/doctors/:id', optionalAuth, (req, res, next) => next());

// Protected routes - manage doctor profiles
router.post('/doctors', authMiddleware, (req, res, next) => next());
router.get('/doctors/admin/unverified', authMiddleware, (req, res, next) => next());
router.patch('/doctors/admin/:id/verify', authMiddleware, (req, res, next) => next());
router.put('/doctors/:id', authMiddleware, (req, res, next) => next());
router.patch('/doctors/:id', authMiddleware, (req, res, next) => next());
router.delete('/doctors/:id', authMiddleware, (req, res, next) => next());

router.use('/doctors', createProxy(DOCTOR_SERVICE));

// =============================================
// APPOINTMENT ROUTES (Mixed auth)
// =============================================
// Public / optional auth routes
router.get('/appointments/doctor/:doctorId', optionalAuth, (req, res, next) => next());
router.get('/appointments/slots', optionalAuth, (req, res, next) => next());
router.get('/appointments/availability-summary', optionalAuth, (req, res, next) => next());
router.get('/appointments/:id', optionalAuth, (req, res, next) => next());

// Protected routes (Auth required)
router.get('/appointments/patient', authMiddleware, (req, res, next) => next());
router.get('/appointments/admin/all', authMiddleware, (req, res, next) => next());
router.post('/appointments', authMiddleware, (req, res, next) => next());
router.post('/appointments/create-order', authMiddleware, (req, res, next) => next());
router.post('/appointments/lock', authMiddleware, (req, res, next) => next());
router.post('/appointments/release-lock', authMiddleware, (req, res, next) => next());
router.post('/appointments/verify-payment/:id', authMiddleware, (req, res, next) => next());
router.patch('/appointments/:id/status', authMiddleware, (req, res, next) => next());
router.put('/appointments/:id/prescription', authMiddleware, (req, res, next) => next());

router.use('/appointments', createProxy(APPOINTMENT_SERVICE));

// =============================================
// NOTIFICATION ROUTES (Auth required)
// =============================================
router.use('/notifications', authMiddleware, createProxy(NOTIFICATION_SERVICE));

module.exports = router;
