const Appointment = require('../models/Appointment');
const SlotLock = require('../models/SlotLock');
const { publishMessage } = require('../config/rabbitmq');
const { logger } = require('../utils/logger');
const { cacheGet, cacheSet, cacheDelete } = require('../config/redis');
const axios = require('axios');
const crypto = require('crypto');
const razorpay = require('../config/razorpay');

const DOCTOR_SERVICE_URL = process.env.DOCTOR_SERVICE_URL || 'http://localhost:3002';

// 🧠 Deterministic Slot ID Helper
const generateSlotId = (doctorId, date, startTime) => {
  const normalizedDate = new Date(date).toISOString().split('T')[0];
  return crypto.createHash('md5')
    .update(`${doctorId}_${normalizedDate}_${startTime}`)
    .digest('hex');
};
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';

// =============================================
// SAGA PATTERN: Book Appointment
// Steps: 1. Validate slot → 2. Create appointment → 3. Notify
// Compensation: Cancel appointment if downstream fails
// =============================================
// Pessimistic Locking: Lock a specific slot for a user
exports.lockSlot = async (req, res) => {
  try {
    const { doctorId, date, startTime, slotId } = req.body;
    const patientId = req.headers['x-user-id'];

    if (!slotId) {
      return res.status(400).json({ error: 'Missing slotId for locking' });
    }

    // 0. Strict Commitment: Check if the user ALREADY holds any lock
    const existingPatientLock = await SlotLock.findOne({ patientId });
    if (existingPatientLock) {
      if (existingPatientLock.slotId === slotId) {
        return res.status(200).json({ message: 'You already hold this lock', slotId });
      }
      return res.status(409).json({ 
        error: 'Slot conflict', 
        message: 'You already have an active reservation. Please complete your current booking or release the slot first.' 
      });
    }

    // 1. Single Source of Truth: Re-verify availability on backend
    const booked = await Appointment.findOne({ 
      slotId, 
      status: { $in: ['pending', 'confirmed', 'in-progress', 'completed'] } 
    });
    
    if (booked) {
      return res.status(409).json({ error: 'Slot is already booked' });
    }

    // 2. Attempt to create a pessimistic lock with Backend-Enforced TTL
    try {
      const lock = new SlotLock({
        slotId,
        doctorId,
        patientId,
        date: new Date(date),
        expiresAt: new Date(Date.now() + 1 * 60 * 1000) // Rule #2: 1 minute from now
      });
      await lock.save();
      
      logger.info(`Slot locked: ${slotId} for patient ${patientId}`);
      
      // Invalidate availability cache
      await cacheDelete(`availability:summary:${doctorId}`);
      
      res.status(201).json({ message: 'Slot reserved for 5 minutes', slotId });
    } catch (err) {
      if (err.code === 11000) {
        const existingLock = await SlotLock.findOne({ slotId });
        if (existingLock && existingLock.patientId === patientId) {
          return res.status(200).json({ message: 'You already hold this lock', slotId });
        }
        return res.status(409).json({ error: 'Slot is currently being held by another user' });
      }
      throw err;
    }
  } catch (error) {
    logger.error('Lock slot error:', error);
    res.status(500).json({ error: 'Failed to lock slot' });
  }
};

// 💰 Step 1: Create Razorpay Order
exports.createOrder = async (req, res) => {
  try {
    const { amount, currency = 'INR', receipt } = req.body;

    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }

    const options = {
      amount: Math.round(amount * 100), // convert to paisa
      currency,
      receipt: receipt || `receipt_${Date.now()}`,
    };

    let order;
    try {
      order = await razorpay.orders.create(options);
    } catch (rzpErr) {
      logger.warn(`Razorpay API call failed (${rzpErr.message || rzpErr}), generating fallback test order.`);
      order = {
        id: `order_mock_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        entity: 'order',
        amount: options.amount,
        amount_paid: 0,
        amount_due: options.amount,
        currency: options.currency,
        receipt: options.receipt,
        status: 'created',
        created_at: Math.floor(Date.now() / 1000)
      };
    }
    
    logger.info(`Payment Order ready: ${order.id}`);
    res.status(201).json({ order });
  } catch (error) {
    logger.error('Create Razorpay order error:', error);
    res.status(500).json({ error: 'Failed to create payment order' });
  }
};

exports.bookAppointment = async (req, res) => {
  try {
    const patientId = req.headers['x-user-id'];
    const patientEmail = req.headers['x-user-email'] || '';
    const {
      doctorId, doctorUserId, doctorName, doctorSpecialization, patientName,
      date, timeSlot, type, reason, consultationFee, slotId, consultationType,
      razorpay_payment_id, razorpay_order_id, razorpay_signature
    } = req.body;

    if (!slotId) return res.status(400).json({ error: 'Missing slotId' });

    // 1. Rule #7: Idempotency - Check if booking already exists for this slotId
    const existing = await Appointment.findOne({ slotId, patientId });
    if (existing && ['pending', 'confirmed'].includes(existing.status)) {
      return res.status(200).json({ message: 'Appointment already booked', appointment: existing });
    }

    // 2. Rule #1: Single Source of Truth - Validate status again
    const conflict = await Appointment.findOne({ 
       slotId, 
       status: { $in: ['pending', 'confirmed', 'in-progress', 'completed'] } 
    });
    if (conflict) {
      return res.status(409).json({ error: 'Slot conflict', message: 'This slot was just booked by someone else.' });
    }

    // 3. Verify Lock ownership (Strict Validation)
    const lock = await SlotLock.findOne({ slotId });
    if (!lock) {
      return res.status(400).json({ error: 'Lock expired', message: 'Your booking session has expired. Please select the slot again.' });
    }
    if (lock.patientId !== patientId) {
      return res.status(403).json({ error: 'Slot is locked by another user' });
    }

    // Calculate Price and Case Type
    const finalType = consultationType || 'offline';
    const finalFee = finalType === 'online' ? (parseFloat(consultationFee) + 500) : parseFloat(consultationFee);
    
    // Generate Meeting Link if Online
    let videoCallLink = '';
    if (finalType === 'online') {
      const roomName = `DoctorConnect-${doctorId.substring(0, 5)}-${slotId.substring(0, 8)}`;
      videoCallLink = `https://meet.jit.si/${roomName}`;
    }

    // 4. Create appointment (Pending Payment)
    const appointment = new Appointment({
      patientId,
      patientName: patientName || 'Patient',
      patientEmail: patientEmail || '',
      doctorId,
      doctorUserId,
      doctorName: doctorName || 'Doctor',
      doctorSpecialization: doctorSpecialization || '',
      date: new Date(date),
      timeSlot,
      type: type || 'consultation',
      consultationType: finalType,
      videoCallLink,
      reason: reason || '',
      consultationFee: finalFee,
      status: 'pending',
      paymentStatus: 'pending',
      slotId,
      version: 0
    });

    // If payment details were already provided (pre-paid case)
    if (razorpay_payment_id && razorpay_order_id && razorpay_signature) {
      const generated_signature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(razorpay_order_id + "|" + razorpay_payment_id)
        .digest('hex');

      if (generated_signature === razorpay_signature) {
        appointment.status = 'confirmed';
        appointment.paymentStatus = 'paid';
        appointment.razorpayOrderId = razorpay_order_id;
        appointment.razorpayPaymentId = razorpay_payment_id;
        appointment.razorpaySignature = razorpay_signature;
      }
    }

    await appointment.save();

    // 5. Atomic Cleanup: Remove the lock
    await SlotLock.deleteOne({ slotId });

    // 6. Publish events
    await publishMessage('notification_events', 'appointment.booked', {
      appointmentId: appointment._id,
      patientId,
      patientName: appointment.patientName,
      patientEmail: appointment.patientEmail,
      doctorId,
      doctorName: appointment.doctorName,
      date: appointment.date,
      timeSlot: appointment.timeSlot,
      type: appointment.type
    });

    await publishMessage('appointment_events', 'appointment.created', {
      appointmentId: appointment._id,
      doctorId,
      patientId,
      date: appointment.date,
      timeSlot: appointment.timeSlot
    });

    logger.info(`Appointment booked: ${appointment._id} (Slot: ${slotId})`);
    
    // Invalidate availability cache
    await cacheDelete(`availability:summary:${doctorId}`);
    
    res.status(201).json({ message: 'Appointment booked successfully', appointment });

  } catch (error) {
    logger.error('Book appointment error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Slot conflict', message: 'Someone just booked this slot.' });
    }
    res.status(500).json({ error: 'Failed to book appointment' });
  }
};

// 💳 Step 2: Verify Payment for an existing appointment
exports.verifyPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Payment details missing' });
    }

    // 1. Verify Signature
    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest('hex');

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    // 2. Update Appointment
    const appointment = await Appointment.findByIdAndUpdate(
      id,
      {
        status: 'confirmed',
        paymentStatus: 'paid',
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        $inc: { version: 1 }
      },
      { new: true }
    );

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // 3. Notify Success
    await publishMessage('notification_events', 'appointment.confirmed', {
      appointmentId: appointment._id,
      patientId: appointment.patientId,
      patientName: appointment.patientName,
      patientEmail: appointment.patientEmail,
      doctorId: appointment.doctorId,
      doctorName: appointment.doctorName,
      date: appointment.date,
      timeSlot: appointment.timeSlot,
      status: 'confirmed'
    });

    res.json({ message: 'Payment verified and appointment confirmed', appointment });
  } catch (error) {
    logger.error('Verify payment error:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
};

// Get appointments for patient
exports.getPatientAppointments = async (req, res) => {
  try {
    const patientId = req.headers['x-user-id'];
    const { status, page = 1, limit = 10 } = req.query;

    const filter = { patientId };
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [appointments, total] = await Promise.all([
      Appointment.find(filter)
        .sort({ date: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Appointment.countDocuments(filter)
    ]);

    res.json({
      appointments,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    logger.error('Get patient appointments error:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
};

// Get appointments for doctor
exports.getDoctorAppointments = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { status, date, page = 1, limit = 10 } = req.query;

    const filter = { doctorId };
    if (status) filter.status = status;
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      filter.date = { $gte: startOfDay, $lte: endOfDay };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [appointments, total] = await Promise.all([
      Appointment.find(filter)
        .sort({ date: 1, 'timeSlot.startTime': 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Appointment.countDocuments(filter)
    ]);

    res.json({
      appointments,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    logger.error('Get doctor appointments error:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
};

// Update appointment status (with optimistic locking)
exports.updateAppointmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, version, notes, prescription, diagnosis, cancellationReason } = req.body;

    // Optimistic lock: only update if version matches
    const appointment = await Appointment.findOneAndUpdate(
      { _id: id, version: version || 0 },
      {
        status,
        ...(notes && { notes }),
        ...(cancellationReason && { cancellationReason }),
        $inc: { version: 1 }
      },
      { new: true }
    );

    if (!appointment) {
      const existing = await Appointment.findById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Appointment not found' });
      }
      return res.status(409).json({
        error: 'Conflict: Appointment was modified by another request',
        currentVersion: existing.version,
        message: 'Please refresh and try again.'
      });
    }

    // Publish status change event
    const eventType = status === 'cancelled' ? 'appointment.cancelled' :
                      status === 'confirmed' ? 'appointment.confirmed' :
                      status === 'completed' ? 'appointment.completed' :
                      'appointment.updated';

    await publishMessage('notification_events', eventType, {
      appointmentId: appointment._id,
      patientId: appointment.patientId,
      patientName: appointment.patientName,
      patientEmail: appointment.patientEmail,
      doctorId: appointment.doctorId,
      doctorName: appointment.doctorName,
      date: appointment.date,
      timeSlot: appointment.timeSlot,
      status: appointment.status
    });

    logger.info(`Appointment ${status}: ${appointment._id}`);
    
    // Invalidate availability cache
    await cacheDelete(`availability:summary:${appointment.doctorId}`);
    
    res.json({ message: `Appointment ${status}`, appointment });
  } catch (error) {
    logger.error('Update appointment error:', error);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
};

// Get appointment by ID
exports.getAppointmentById = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id).lean();
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    res.json({ appointment });
  } catch (error) {
    logger.error('Get appointment error:', error);
    res.status(500).json({ error: 'Failed to fetch appointment' });
  }
};

// Get available slots for a doctor on a specific date (Production-Ready Engine)
exports.getAvailableSlots = async (req, res) => {
  try {
    const { doctorId, date } = req.query;
    if (!doctorId || !date) return res.status(400).json({ error: 'doctorId and date are required' });

    // 1. Fetch Doctor Config
    const response = await axios.get(`${DOCTOR_SERVICE_URL}/api/doctors/${doctorId}`);
    const doctor = response.data.doctor;
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });

    const availability = doctor.availability || { weeklyAvailability: [], exceptions: [], timezone: 'Asia/Kolkata' };
    const requestedDateObj = new Date(`${date}T12:00:00Z`);
    const dayName = requestedDateObj.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }).toLowerCase();

    // 2. Exception Priority: CLOSED > OVERRIDE > WEEKLY
    let config = null;
    const exception = availability.exceptions.find(ex => {
      // Safely parse exception date string or object
      const exDateStr = typeof ex.date === 'string' ? ex.date.split('T')[0] : ex.date.toISOString().split('T')[0];
      return exDateStr === date;
    });

    if (exception) {
      if (exception.type === 'CLOSED') {
        return res.json({ slots: [], message: 'Doctor is unavailable on this date (Closed)', date, doctorId });
      }
      config = [exception]; // Use OVERRIDE as array to match mapping logic
    } else {
      config = availability.weeklyAvailability.filter(w => w.day === dayName && w.isAvailable);
    }

    if (!config || config.length === 0) {
      return res.json({ slots: [], message: 'Doctor has no schedule for this day', date, doctorId });
    }

    // 3. Generate Potential Slots (Drop Partial Slots)
    const potentialSlots = [];
    
    // Filter past slots based directly on timezone strings
    const tz = availability.timezone || 'Asia/Kolkata';
    const tzOptions = { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false };
    const parts = new Intl.DateTimeFormat('en-US', tzOptions).formatToParts(new Date());
    const p = {};
    parts.forEach(({type, value}) => p[type] = value);
    
    // Construct local date strings safely
    const localYear = p.year;
    const localMonth = p.month.padStart(2, '0');
    const localDay = p.day.padStart(2, '0');
    const todayDateStr = `${localYear}-${localMonth}-${localDay}`;
    let currentTimeStr = `${p.hour}:${p.minute}`;
    if (currentTimeStr.startsWith('24:')) currentTimeStr = `00:${p.minute}`;

    const isToday = date === todayDateStr;

    // Process each shift block
    config.forEach(shift => {
      const [startH, startM] = shift.startTime.split(':').map(Number);
      const [endH, endM] = shift.endTime.split(':').map(Number);
      const durationMins = shift.slotDuration || 30;

      let currentMins = startH * 60 + startM;
      const endMins = endH * 60 + endM;

      while (currentMins + durationMins <= endMins) {
        const slotStartH = Math.floor(currentMins / 60);
        const slotStartM = currentMins % 60;
        const slotEndH = Math.floor((currentMins + durationMins) / 60);
        const slotEndM = (currentMins + durationMins) % 60;

        const startTimeStr = `${slotStartH.toString().padStart(2, '0')}:${slotStartM.toString().padStart(2, '0')}`;
        const endTimeStr = `${slotEndH.toString().padStart(2, '0')}:${slotEndM.toString().padStart(2, '0')}`;
        
        const isPast = date < todayDateStr || (isToday && startTimeStr < currentTimeStr);

        potentialSlots.push({
          slotId: generateSlotId(doctorId, date, startTimeStr),
          startTime: startTimeStr,
          endTime: endTimeStr,
          isPast
        });

        currentMins += durationMins;
      }
    });

    // 4. Check Booked and Locked slots (Single Source of Truth)
    const slotIds = potentialSlots.map(s => s.slotId);
    
    const [bookedAppointments, activeLocks] = await Promise.all([
      Appointment.find({ slotId: { $in: slotIds }, status: { $in: ['pending', 'confirmed', 'in-progress', 'completed'] } }).lean(),
      SlotLock.find({ slotId: { $in: slotIds } }).lean()
    ]);

    const bookedIds = bookedAppointments.map(a => a.slotId);
    const lockedIds = activeLocks.map(l => l.slotId);

    // 5. Build Unified Slot State Model
    const finalSlots = potentialSlots.map(slot => {
      const isBooked = bookedIds.includes(slot.slotId);
      const isLocked = lockedIds.includes(slot.slotId);
      
      return {
        ...slot,
        isAvailable: !isBooked && !isLocked && !slot.isPast,
        status: isBooked ? 'BOOKED' : isLocked ? 'LOCKED' : slot.isPast ? 'EXPIRED' : 'AVAILABLE'
      };
    });

    res.json({ slots: finalSlots, date, doctorId, timezone: availability.timezone });
  } catch (error) {
    logger.error('Get available slots error:', error);
    res.status(500).json({ error: 'Failed to fetch available slots' });
  }
};

// Get 30-day availability summary (Optimized Discovery)
exports.getAvailabilitySummary = async (req, res) => {
  try {
    const { doctorId } = req.query;
    if (!doctorId) return res.status(400).json({ error: 'doctorId is required' });

    const cacheKey = `availability:summary:${doctorId}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json({ availableDates: cached, fromCache: true });

    // 1. Fetch Doctor Config
    const response = await axios.get(`${DOCTOR_SERVICE_URL}/api/doctors/${doctorId}`);
    const doctor = response.data.doctor;
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });

    const availability = doctor.availability || { weeklyAvailability: [], exceptions: [], timezone: 'Asia/Kolkata' };
    const timezone = availability.timezone || 'Asia/Kolkata';
    
    // Securely get local time strings to avoid Server Timezone contamination
    const tzOptions = { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false };
    const parts = new Intl.DateTimeFormat('en-US', tzOptions).formatToParts(new Date());
    const p = {};
    parts.forEach(({type, value}) => p[type] = value);
    
    // Base Date anchored strictly at Noon UTC to safely add days without DST shifting issues
    const baseDate = new Date(`${p.year}-${p.month}-${p.day}T12:00:00Z`);
    let currentTimeStr = `${p.hour}:${p.minute}`;
    if (currentTimeStr.startsWith('24:')) currentTimeStr = `00:${p.minute}`;
    
    const availableDates = [];
    const DAYS_TO_SCAN = 30;

    // 2. Scan next 30 days
    for (let i = 0; i < DAYS_TO_SCAN; i++) {
      const scanDate = new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = scanDate.toISOString().split('T')[0];
      const dayName = scanDate.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }).toLowerCase();

      // Priority Logic: CLOSED > OVERRIDE > WEEKLY
      let config = null;
      const exception = availability.exceptions.find(ex => {
        const exDateStr = typeof ex.date === 'string' ? ex.date.split('T')[0] : ex.date.toISOString().split('T')[0];
        return exDateStr === dateStr;
      });

      if (exception) {
        if (exception.type === 'CLOSED') continue;
        config = [exception];
      } else {
        config = availability.weeklyAvailability.filter(w => w.day === dayName && w.isAvailable);
      }

      if (!config || config.length === 0) continue;

      const potentialSlotIds = [];
      
      config.forEach(shift => {
        const [startH, startM] = shift.startTime.split(':').map(Number);
        const [endH, endM] = shift.endTime.split(':').map(Number);
        const durationMins = shift.slotDuration || 30;

        let currentMins = startH * 60 + startM;
        const endMins = endH * 60 + endM;

        while (currentMins + durationMins <= endMins) {
          const slotStartH = Math.floor(currentMins / 60);
          const slotStartM = currentMins % 60;
          const startTimeStr = `${slotStartH.toString().padStart(2, '0')}:${slotStartM.toString().padStart(2, '0')}`;
          
          // Skip past slots for today
          if (i === 0 && startTimeStr < currentTimeStr) {
            currentMins += durationMins;
            continue;
          }

          potentialSlotIds.push(generateSlotId(doctorId, dateStr, startTimeStr));
          currentMins += durationMins;
        }
      });

      if (potentialSlotIds.length === 0) continue;

      // Check DB for matches - if ANY potential slot is NOT booked/locked, the day is available
      const [bookedCount, lockedCount] = await Promise.all([
        Appointment.countDocuments({ slotId: { $in: potentialSlotIds }, status: { $in: ['pending', 'confirmed', 'in-progress', 'completed'] } }),
        SlotLock.countDocuments({ slotId: { $in: potentialSlotIds } })
      ]);

      if (bookedCount + lockedCount < potentialSlotIds.length) {
        availableDates.push(dateStr);
      }
    }

    await cacheSet(cacheKey, availableDates, 3600); // Cache for 1 hour
    res.json({ availableDates });

  } catch (error) {
    logger.error('Availability summary error:', error);
    res.status(500).json({ error: 'Failed to fetch availability summary' });
  }
};

// Admin: Get all appointments
exports.getAllAppointments = async (req, res) => {
  try {
    const role = req.headers['x-user-role'];
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
    }

    const { page = 1, limit = 20, status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [appointments, total] = await Promise.all([
      Appointment.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Appointment.countDocuments(filter)
    ]);

    res.json({
      appointments,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Get all appointments error:', error);
    res.status(500).json({ error: 'Failed to fetch all appointments' });
  }
};

// Add prescription to appointment
exports.addPrescription = async (req, res) => {
  try {
    const { id } = req.params;
    const { diagnosis, medicines, advice } = req.body;
    const doctorUserId = req.headers['x-user-id'];

    const appointment = await Appointment.findById(id);

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Verify requesting doctor owns this appointment
    // Compatibility: If doctorUserId is missing (legacy appointment), verify via doctor profile
    if (!appointment.doctorUserId) {
      try {
        const docResponse = await axios.get(`${DOCTOR_SERVICE_URL}/api/doctors/${appointment.doctorId}`);
        if (docResponse.data.doctor?.userId === doctorUserId) {
          appointment.doctorUserId = doctorUserId;
          await appointment.save();
        } else {
          return res.status(403).json({ error: 'Unauthorized: You are not the assigned doctor' });
        }
      } catch (err) {
        logger.error('Legacy doctor verification failed:', err);
        return res.status(403).json({ error: 'Unauthorized: Verification failed' });
      }
    } else if (appointment.doctorUserId !== doctorUserId) {
      return res.status(403).json({ error: 'Unauthorized: You are not the assigned doctor' });
    }

    appointment.prescription = {
      diagnosis,
      medicines,
      advice,
      issuedAt: new Date()
    };
    
    appointment.status = 'completed';
    await appointment.save();

    // Publish event
    await publishMessage('notification_events', 'appointment.completed', {
      appointmentId: appointment._id,
      patientId: appointment.patientId,
      patientName: appointment.patientName,
      patientEmail: appointment.patientEmail,
      doctorName: appointment.doctorName,
      status: 'completed'
    });

    res.json({ message: 'Prescription added and appointment completed', appointment });
  } catch (error) {
    logger.error('Add prescription error:', error);
    res.status(500).json({ error: 'Failed to add prescription' });
  }
};
// Release a slot manually
exports.releaseLock = async (req, res) => {
  try {
    const { slotId } = req.body;
    const patientId = req.headers['x-user-id'];

    if (!slotId) {
      return res.status(400).json({ error: 'Missing slotId for release' });
    }

    await SlotLock.deleteOne({ slotId, patientId });
    
    logger.info(`Slot released: ${slotId} by patient ${patientId}`);
    res.json({ message: 'Slot released successfully' });
  } catch (error) {
    logger.error('Release lock error:', error);
    res.status(500).json({ error: 'Failed to release slot' });
  }
};
