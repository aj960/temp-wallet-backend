/**
 * User Controller
 * Handles user registration, login, and profile management
 */

const db = require('../db/index');
const authService = require('../security/auth.service');
const jwtService = require('../security/jwt.service');
const auditLogger = require('../security/audit-logger.service');
const { success, error } = require('../utils/response');

/**
 * Register a new user
 */
exports.register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    
    if (!name || !email || !password) {
      return error(res, 'Name, email, and password are required');
    }

    // Check if user already exists
    const existingUser = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return error(res, 'Email already registered');
    }

    // Hash password
    const hashedPassword = await authService.hashPassword(password);

    // Insert user
    const stmt = db.prepare(
      'INSERT INTO users (name, email, password, phone) VALUES (?, ?, ?, ?)'
    );
    
    const result = await stmt.run(name, email, hashedPassword, phone || null);
    const userId = result.insertId;

    auditLogger.logSecurityEvent({
      type: 'USER_REGISTERED',
      userId,
      email,
      ip: req.ip
    });

    success(res, {
      message: 'User registered successfully',
      userId
    }, 201);
  } catch (e) {
    if (e.message.includes('UNIQUE constraint') || e.message.includes('Duplicate entry')) {
      return error(res, 'Email already registered');
    }
    auditLogger.logError(e, { controller: 'register' });
    error(res, e.message);
  }
};

/**
 * User login
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return error(res, 'Email and password required');
    }

    const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    
    if (!user) {
      auditLogger.logAuthAttempt({
        success: false,
        email,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });
      return error(res, 'Invalid credentials');
    }

    // Check if user is active
    if (!user.is_active) {
      auditLogger.logAuthAttempt({
        success: false,
        email,
        reason: 'Account inactive',
        ip: req.ip
      });
      return error(res, 'Account is inactive. Please contact support.');
    }

    // Compare password
    const isValidPassword = await authService.comparePassword(password, user.password);
    
    if (!isValidPassword) {
      auditLogger.logAuthAttempt({
        success: false,
        email,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });
      return error(res, 'Invalid credentials');
    }

    // Generate tokens
    const tokens = jwtService.generateTokenPair({
      id: user.id,
      email: user.email,
      role: 'user' // Regular user role
    });

    auditLogger.logAuthAttempt({
      success: true,
      email,
      userId: user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    success(res, {
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone
      },
      ...tokens
    });
  } catch (e) {
    auditLogger.logError(e, { controller: 'login' });
    error(res, e.message);
  }
};

/**
 * Refresh access token
 */
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return error(res, 'Refresh token required');
    }

    const decoded = jwtService.verifyRefreshToken(refreshToken);
    
    const user = await db.prepare('SELECT id, email FROM users WHERE id = ? AND is_active = 1').get(decoded.id);
    
    if (!user) {
      return error(res, 'User not found or inactive');
    }

    const tokens = jwtService.generateTokenPair({
      id: user.id,
      email: user.email,
      role: 'user'
    });

    success(res, tokens);
  } catch (e) {
    auditLogger.logError(e, { controller: 'refreshToken' });
    error(res, e.message);
  }
};

/**
 * Get user profile
 */
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await db.prepare(
      'SELECT id, name, email, phone, is_active, created_at, updated_at FROM users WHERE id = ?'
    ).get(userId);
    
    if (!user) {
      return error(res, 'User not found');
    }
    
    success(res, user);
  } catch (e) {
    auditLogger.logError(e, { controller: 'getProfile' });
    error(res, e.message);
  }
};

/**
 * Update user profile
 */
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, phone } = req.body;
    
    const updates = [];
    const values = [];
    
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    
    if (phone !== undefined) {
      updates.push('phone = ?');
      values.push(phone);
    }
    
    if (updates.length === 0) {
      return error(res, 'No fields to update');
    }
    
    values.push(userId);
    
    await db.prepare(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`
    ).run(...values);
    
    auditLogger.logSecurityEvent({
      type: 'USER_PROFILE_UPDATED',
      userId,
      ip: req.ip
    });
    
    // Return updated profile
    const user = await db.prepare(
      'SELECT id, name, email, phone, is_active, created_at, updated_at FROM users WHERE id = ?'
    ).get(userId);
    
    success(res, {
      message: 'Profile updated successfully',
      user
    });
  } catch (e) {
    auditLogger.logError(e, { controller: 'updateProfile' });
    error(res, e.message);
  }
};

/**
 * Change password
 */
exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return error(res, 'Current password and new password are required');
    }
    
    // Get user
    const user = await db.prepare('SELECT password FROM users WHERE id = ?').get(userId);
    
    if (!user) {
      return error(res, 'User not found');
    }
    
    // Verify current password
    const isValidPassword = await authService.comparePassword(currentPassword, user.password);
    
    if (!isValidPassword) {
      auditLogger.logSecurityEvent({
        type: 'PASSWORD_CHANGE_FAILED',
        userId,
        reason: 'Invalid current password',
        ip: req.ip
      });
      return error(res, 'Current password is incorrect');
    }
    
    // Hash new password
    const hashedPassword = await authService.hashPassword(newPassword);
    
    // Update password
    await db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, userId);
    
    auditLogger.logSecurityEvent({
      type: 'PASSWORD_CHANGED',
      userId,
      ip: req.ip
    });
    
    success(res, { message: 'Password changed successfully' });
  } catch (e) {
    auditLogger.logError(e, { controller: 'changePassword' });
    error(res, e.message);
  }
};

