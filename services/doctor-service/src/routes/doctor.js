const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');

// Public routes
router.get('/', doctorController.getAllDoctors);
router.get('/search', doctorController.searchDoctors);
router.get('/specializations', doctorController.getSpecializations);
router.get('/user/:userId', doctorController.getDoctorByUserId);

// Admin routes
router.get('/admin/unverified', doctorController.getUnverifiedDoctors);
router.patch('/admin/:id/verify', doctorController.verifyDoctor);

router.get('/:id', doctorController.getDoctorById);

// Protected routes (auth handled by gateway)
router.post('/pending-sync', doctorController.syncPendingDoctor);
router.post('/', doctorController.createDoctor);
router.put('/:id', doctorController.updateDoctor);

module.exports = router;
