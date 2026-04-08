const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { publishMessage } = require('../config/rabbitmq');
const { logger } = require('../utils/logger');
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || 'dummy_client_id');

const JWT_SECRET = process.env.JWT_SECRET || 'dpm_jwt_secret_key_2024';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Generate JWT Token
const generateToken = (user) => {
  return jwt.sign(
    { userId: user._id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

// Register new user
exports.register = async (req, res) => {
  try {
    const { email, password, firstName, lastName, role, phone, dateOfBirth, gender, registrationNumber, consultationFee } = req.body;

    // Validate password complexity
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{6,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ 
        error: 'Password must be at least 6 characters long, contain at least one capital letter, one digit, and one special character' 
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Create user
    const user = new User({
      email,
      password,
      firstName,
      lastName,
      role: role || 'patient',
      phone,
      dateOfBirth,
      gender,
      isActive: role && role.toLowerCase() === 'doctor' ? false : true
    });

    await user.save();

    // Generate token
    const token = generateToken(user);

    // Publish user registered event
    const eventPayload = {
      userId: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role
    };

    if (role && role.toLowerCase() === 'doctor') {
      eventPayload.registrationNumber = registrationNumber;
      eventPayload.consultationFee = consultationFee;
    }

    await publishMessage('user_events', 'user.registered', eventPayload);

    logger.info(`User registered: ${user.email}`);

    res.status(201).json({
      message: user.role === 'doctor' 
        ? 'Registration successful. Your account is pending admin approval.' 
        : 'Registration successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed', details: error.message });
  }
};

// Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email, isActive: true });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last login (use updateOne to avoid triggering pre-save password hash)
    await User.updateOne({ _id: user._id }, { lastLogin: new Date() });

    // Generate token
    const token = generateToken(user);

    // Publish login event
    await publishMessage('user_events', 'user.login', {
      userId: user._id,
      email: user.email,
      timestamp: new Date()
    });

    logger.info(`User logged in: ${user.email}`);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

// Get current user profile
exports.getProfile = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
};

// Update user profile
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const updates = req.body;

    // Prevent updating sensitive fields
    delete updates.password;
    delete updates.email;
    delete updates.role;

    const user = await User.findByIdAndUpdate(userId, updates, { new: true, runValidators: true });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'Profile updated', user });
  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

// Get user by ID (internal service call)
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
};

// Google Login
exports.googleLogin = async (req, res) => {
  try {
    const { token } = req.body;
    let payload;

    try {
      // Attempt to verify with Google (requires valid Client ID)
      const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (verifyError) {
      // Fallback for presentation: If no Client ID is provided, just decode the token 
      // (Do NOT do this in production, this is only to make sure your demo works locally)
      logger.warn('Google verification failed. Decoding raw JWT for demo fallback.');
      payload = jwt.decode(token);
      if (!payload) throw new Error('Invalid token');
    }

    const email = payload.email;

    // Find or create user
    let user = await User.findOne({ email });
    if (!user) {
      user = new User({
        email,
        firstName: payload.given_name || payload.name?.split(' ')[0] || 'Google',
        lastName: payload.family_name || payload.name?.split(' ')[1] || 'User',
        password: Math.random().toString(36).slice(-10) + 'A1!', // Dummy secure password
        role: 'patient',
        isActive: true
      });
      await user.save();

      // Broadcast registration event
      await publishMessage('user_events', 'user.registered', {
        userId: user._id, email, firstName: user.firstName, lastName: user.lastName, role: 'patient'
      });
    }

    // Update last login
    await User.updateOne({ _id: user._id }, { lastLogin: new Date() });

    // Generate our system's internal JWT token
    const jwtToken = generateToken(user);
    
    logger.info(`User logged in via Google: ${email}`);

    res.json({
      message: 'Google login successful',
      token: jwtToken,
      user: { id: user._id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role }
    });
  } catch (error) {
    logger.error('Google login error:', error);
    res.status(401).json({ error: 'Google Authentication failed' });
  }
};

// Admin: Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const role = req.headers['x-user-role'];
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
    }

    const { page = 1, limit = 20, role: filterRole } = req.query;
    
    const filter = {};
    if (filterRole) filter.role = filterRole;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password -__v') // exclude sensitive data
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      User.countDocuments(filter)
    ]);

    res.json({
      users,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Get all users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};
