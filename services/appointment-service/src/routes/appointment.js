const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');

// Get available slots
router.get('/slots', appointmentController.getAvailableSlots);
router.get('/availability-summary', appointmentController.getAvailabilitySummary);

// Book appointment
router.post('/create-order', appointmentController.createOrder);
router.post('/', appointmentController.bookAppointment);
router.post('/lock', appointmentController.lockSlot);
router.post('/release-lock', appointmentController.releaseLock);

// Get patient's appointments
router.get('/patient', appointmentController.getPatientAppointments);

// Get doctor's appointments
router.get('/doctor/:doctorId', appointmentController.getDoctorAppointments);

// Admin: Get all appointments
router.get('/admin/all', appointmentController.getAllAppointments);

// Get appointment by ID
router.get('/:id', appointmentController.getAppointmentById);

// Update appointment status
router.patch('/:id/status', appointmentController.updateAppointmentStatus);
router.put('/:id/prescription', appointmentController.addPrescription);
router.post('/verify-payment/:id', appointmentController.verifyPayment);

module.exports = router;
