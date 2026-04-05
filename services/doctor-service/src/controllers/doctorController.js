const Doctor = require('../models/Doctor');
const PendingDoctor = require('../models/PendingDoctor');
const { cacheGet, cacheSet, cacheDelete } = require('../config/redis');
const { publishMessage } = require('../config/rabbitmq');
const { logger } = require('../utils/logger');

const CACHE_TTL = 300; // 5 minutes

// Get all doctors (with caching)
exports.getAllDoctors = async (req, res) => {
  try {
    const { page = 1, limit = 10, specialization, city, sortBy = 'rating.average', order = 'desc' } = req.query;
    
    const cacheKey = `doctors:list:${page}:${limit}:${specialization || ''}:${city || ''}:${sortBy}:${order}`;
    
    // Check cache first
    const cached = await cacheGet(cacheKey);
    if (cached) {
      logger.info('Doctor list served from cache');
      return res.json({ ...cached, fromCache: true });
    }

    // Build query
    const filter = { isAvailable: true, isVerified: true };
    if (specialization) filter.specialization = new RegExp(specialization, 'i');
    if (city) filter['hospital.city'] = new RegExp(city, 'i');

    const sortOrder = order === 'asc' ? 1 : -1;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [doctors, total] = await Promise.all([
      Doctor.find(filter)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Doctor.countDocuments(filter)
    ]);

    const result = {
      doctors,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    };

    // Log the miss and cache the result
    logger.info('Doctor list fetched from MongoDB database (Cache Miss)');
    await cacheSet(cacheKey, result, CACHE_TTL);

    res.json(result);
  } catch (error) {
    logger.error('Get doctors error:', error);
    res.status(500).json({ error: 'Failed to fetch doctors' });
  }
};

// Search doctors
exports.searchDoctors = async (req, res) => {
  try {
    const { q, specialization, minFee, maxFee, minRating, city } = req.query;

    const cacheKey = `doctors:search:${q || ''}:${specialization || ''}:${minFee || ''}:${maxFee || ''}:${minRating || ''}:${city || ''}`;
    
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json({ ...cached, fromCache: true });
    }

    const filter = { isAvailable: true, isVerified: true };

    if (q) {
      filter.$text = { $search: q };
    }
    if (specialization) filter.specialization = new RegExp(specialization, 'i');
    if (city) filter['hospital.city'] = new RegExp(city, 'i');
    if (minFee || maxFee) {
      filter.consultationFee = {};
      if (minFee) filter.consultationFee.$gte = parseFloat(minFee);
      if (maxFee) filter.consultationFee.$lte = parseFloat(maxFee);
    }
    if (minRating) filter['rating.average'] = { $gte: parseFloat(minRating) };

    const doctors = await Doctor.find(filter).sort({ 'rating.average': -1 }).lean();

    const result = { doctors, total: doctors.length };
    
    logger.info('Doctor search results fetched from MongoDB (Cache Miss)');
    await cacheSet(cacheKey, result, CACHE_TTL);

    res.json(result);
  } catch (error) {
    logger.error('Search doctors error:', error);
    res.status(500).json({ error: 'Failed to search doctors' });
  }
};

// Get doctor by ID
exports.getDoctorById = async (req, res) => {
  try {
    const cacheKey = `doctors:${req.params.id}`;
    
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json({ doctor: cached, fromCache: true });
    }

    let doctor = await Doctor.findById(req.params.id).lean();
    if (!doctor) {
      doctor = await PendingDoctor.findById(req.params.id).lean();
    }
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    await cacheSet(cacheKey, doctor, CACHE_TTL);
    res.json({ doctor });
  } catch (error) {
    logger.error('Get doctor error:', error);
    res.status(500).json({ error: 'Failed to fetch doctor' });
  }
};

// Create doctor profile
exports.createDoctor = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const role = req.headers['x-user-role'];

    if (role !== 'doctor' && role !== 'admin') {
      return res.status(403).json({ error: 'Only doctors can create doctor profiles' });
    }

    const existing = await Doctor.findOne({ userId });
    if (existing) {
      return res.status(400).json({ error: 'Doctor profile already exists' });
    }

    const doctor = new Doctor({ ...req.body, userId });
    await doctor.save();

    // Invalidate cache
    await cacheDelete('doctors:*');

    // Publish event
    await publishMessage('doctor_events', 'doctor.created', {
      doctorId: doctor._id,
      userId,
      specialization: doctor.specialization
    });

    res.status(201).json({ message: 'Doctor profile created', doctor });
  } catch (error) {
    logger.error('Create doctor error:', error);
    res.status(500).json({ error: 'Failed to create doctor profile' });
  }
};

// Update doctor profile
exports.updateDoctor = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    let doctor = await Doctor.findById(req.params.id);
    let isPending = false;
    
    if (!doctor) {
      doctor = await PendingDoctor.findById(req.params.id);
      isPending = true;
    }
    
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor profile not found' });
    }

    if (doctor.userId !== userId && req.headers['x-user-role'] !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    Object.assign(doctor, req.body);
    await doctor.save();

    // Invalidate cache (only for verified doctors)
    if (!isPending) {
      await cacheDelete('doctors:*');
    } else {
      logger.info(`Pending doctor profile updated: ${doctor.email}`);
    }

    // Publish event for availability updates
    if (req.body.availability) {
      await publishMessage('doctor_events', 'doctor.availability_updated', {
        doctorId: doctor._id,
        userId,
        timestamp: new Date().toISOString()
      });
    }

    res.json({ message: 'Doctor profile updated', doctor });
  } catch (error) {
    logger.error('Update doctor error:', error);
    res.status(500).json({ error: 'Failed to update doctor profile' });
  }
};

// Get doctor by user ID
exports.getDoctorByUserId = async (req, res) => {
  try {
    let doctor = await Doctor.findOne({ userId: req.params.userId }).lean();
    if (!doctor) {
      doctor = await PendingDoctor.findOne({ userId: req.params.userId }).lean();
    }
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor profile not found' });
    }
    res.json({ doctor });
  } catch (error) {
    logger.error('Get doctor by userId error:', error);
    res.status(500).json({ error: 'Failed to fetch doctor' });
  }
};

// Get available specializations
exports.getSpecializations = async (req, res) => {
  try {
    const cacheKey = 'doctors:specializations';
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json({ specializations: cached, fromCache: true });

    const specializations = await Doctor.distinct('specialization', { isAvailable: true, isVerified: true });
    await cacheSet(cacheKey, specializations, 600);
    res.json({ specializations });
  } catch (error) {
    logger.error('Get specializations error:', error);
    res.status(500).json({ error: 'Failed to fetch specializations' });
  }
};

// Admin: Get unverified doctors
exports.getUnverifiedDoctors = async (req, res) => {
  try {
    const role = req.headers['x-user-role'];
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
    }

    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [doctors, total] = await Promise.all([
      PendingDoctor.find({ status: 'pending' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      PendingDoctor.countDocuments({ status: 'pending' })
    ]);

    res.json({
      doctors,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Get unverified doctors error:', error);
    res.status(500).json({ error: 'Failed to fetch unverified doctors' });
  }
};

// Admin: Verify doctor
exports.verifyDoctor = async (req, res) => {
  try {
    const role = req.headers['x-user-role'];
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
    }

    // 1. Find in PendingDoctor
    const pending = await PendingDoctor.findById(req.params.id);
    if (!pending) {
      return res.status(404).json({ error: 'Pending doctor profile not found' });
    }

    // 2. Create in main Doctor collection
    const doctor = new Doctor({
      userId: pending.userId,
      firstName: pending.firstName,
      lastName: pending.lastName,
      email: pending.email,
      registrationNumber: pending.registrationNumber,
      specialization: pending.specialization,
      qualifications: pending.qualifications,
      experience: pending.experience,
      consultationFee: pending.consultationFee,
      bio: pending.bio,
      hospital: pending.hospital,
      availability: pending.availability,
      isAvailable: pending.isAvailable ?? true,
      isVerified: true
    });

    await doctor.save();

    // 3. Delete from PendingDoctor
    await PendingDoctor.findByIdAndDelete(pending._id);

    // Invalidate cache
    await cacheDelete('doctors:*');

    // Publish verification event for user-service to activate the account
    await publishMessage('doctor_events', 'doctor.verified', {
      event: 'DOCTOR_VERIFIED',
      userId: pending.userId,
      verifiedAt: new Date().toISOString()
    });

    res.json({ message: 'Doctor verified and moved to main database successfully', doctor });
  } catch (error) {
    logger.error('Verify doctor error:', error);
    res.status(500).json({ error: 'Failed to verify doctor' });
  }
};
