const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Get user profile
router.get('/profile', authController.getProfile);

// Update user profile
router.put('/profile', authController.updateProfile);
// Admin: Get all users
router.get('/admin/all', authController.getAllUsers);

// Get user by ID (internal)
router.get('/:id', authController.getUserById);

// Internal: Activate user
router.patch('/internal/activate/:id', authController.activateUser);

module.exports = router;
