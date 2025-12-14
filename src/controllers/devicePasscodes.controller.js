const db = require('../db/devicePasscodes.db');
const authService = require('../security/auth.service');
const auditLogger = require('../security/audit-logger.service');
const { success, error } = require('../utils/response');
const crypto = require('crypto');

const generateId = () => crypto.randomBytes(16).toString('hex');

exports.createDevicePassCode = async (req, res) => {
  try {
    const { name, passcode } = req.body;
    
    if (!name || !passcode) {
      return error(res, 'Name (device ID) and passcode are required');
    }

    // Mark old passcodes as obsolete
    const updateStmt = db.prepare(
      'UPDATE device_passcodes SET is_old = 1 WHERE name = ?'
    );
    updateStmt.run(name);

    // Hash the passcode
    const hashedPasscode = await authService.hashPasscode(passcode);

    const serverPasscodeId = generateId();
    const insertStmt = db.prepare(
      'INSERT INTO device_passcodes (id, name, passcode, is_old, is_biometric_enabled) VALUES (?, ?, ?, 0, 0)'
    );
    insertStmt.run(serverPasscodeId, name, hashedPasscode);

    auditLogger.logSecurityEvent({
      type: 'DEVICE_PASSCODE_CREATED',
      deviceId: serverPasscodeId,
      deviceName: name,
      ip: req.ip
    });

    success(res, { 
      message: 'Device passcode created successfully',
      serverPasscodeId,
      deviceName: name 
    });
  } catch (e) {
    auditLogger.logError(e, { controller: 'createDevicePassCode' });
    error(res, e.message);
  }
};

exports.validateDevicePassCode = async (req, res) => {
  try {
    const { name, passcode } = req.body;

    if (!name || !passcode) {
      return error(res, 'Device name and passcode are required');
    }

    const record = db
      .prepare('SELECT id, passcode FROM device_passcodes WHERE name = ? AND is_old = 0')
      .get(name);

    if (!record) {
      auditLogger.logSecurityEvent({
        type: 'DEVICE_VALIDATION_FAILED',
        deviceName: name,
        reason: 'Device not found',
        ip: req.ip
      });
      
      return success(res, { 
        valid: false, 
        message: 'Active device passcode not found',
        serverPasscodeId: null
      });
    }

    // Compare passcode
    const isValid = await authService.comparePasscode(passcode, record.passcode);

    auditLogger.logSecurityEvent({
      type: isValid ? 'DEVICE_VALIDATION_SUCCESS' : 'DEVICE_VALIDATION_FAILED',
      deviceName: name,
      deviceId: record.id,
      ip: req.ip
    });

    success(res, { 
      valid: isValid, 
      message: isValid ? 'Passcode valid' : 'Invalid passcode',
      serverPasscodeId: isValid ? record.id : null
    });
  } catch (e) {
    auditLogger.logError(e, { controller: 'validateDevicePassCode' });
    error(res, e.message);
  }
};

exports.listDevicePassCodes = (req, res) => {
  try {
    const passcodes = db.prepare(`
      SELECT 
        id, 
        name,
        is_biometric_enabled, 
        is_old, 
        created_at 
      FROM device_passcodes
    `).all();
    
    success(res, passcodes);
  } catch (e) {
    auditLogger.logError(e, { controller: 'listDevicePassCodes' });
    error(res, e.message);
  }
};

exports.getDevicePassCodeById = (req, res) => {
  try {
    const { id } = req.params;
    const passcode = db.prepare(`
      SELECT 
        id, 
        name, 
        is_biometric_enabled, 
        is_old, 
        created_at 
      FROM device_passcodes 
      WHERE id = ?
    `).get(id);
    
    if (!passcode) {
      return error(res, 'Device passcode record not found');
    }
    
    success(res, passcode);
  } catch (e) {
    auditLogger.logError(e, { controller: 'getDevicePassCodeById' });
    error(res, e.message);
  }
};

exports.updateDevicePassCode = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, passcode, isBiometricEnabled } = req.body;
    
    if (!name && !passcode && isBiometricEnabled === undefined) {
      return error(res, 'No fields provided for update');
    }
    
    let query = 'UPDATE device_passcodes SET ';
    const params = [];
    const updates = [];

    if (name) {
      updates.push('name = ?');
      params.push(name);
    }
    
    if (passcode) {
      const hashedPasscode = await authService.hashPasscode(passcode);
      updates.push('passcode = ?');
      params.push(hashedPasscode);
    }
    
    if (isBiometricEnabled !== undefined) {
      updates.push('is_biometric_enabled = ?');
      params.push(isBiometricEnabled ? 1 : 0);
    }
    
    query += updates.join(', ') + ' WHERE id = ?';
    params.push(id);

    const info = db.prepare(query).run(...params);

    if (info.changes === 0) {
      return error(res, 'Device passcode not found or no changes made');
    }

    auditLogger.logSecurityEvent({
      type: 'DEVICE_PASSCODE_UPDATED',
      deviceId: id,
      updates: Object.keys(req.body),
      ip: req.ip
    });

    success(res, { message: 'Device passcode updated successfully' });
  } catch (e) {
    auditLogger.logError(e, { controller: 'updateDevicePassCode' });
    error(res, e.message);
  }
};

exports.deleteDevicePassCode = (req, res) => {
  try {
    const { id } = req.params;
    const info = db.prepare('DELETE FROM device_passcodes WHERE id = ?').run(id);
    
    if (info.changes === 0) {
      return error(res, 'Device passcode not found');
    }
    
    auditLogger.logSecurityEvent({
      type: 'DEVICE_PASSCODE_DELETED',
      deviceId: id,
      ip: req.ip
    });
    
    success(res, { message: 'Device passcode deleted successfully' });
  } catch (e) {
    auditLogger.logError(e, { controller: 'deleteDevicePassCode' });
    error(res, e.message);
  }
};

exports.updateBiometricStatus = (req, res) => {
  try {
    const { name } = req.params;
    const { isBiometricEnabled } = req.body;
    
    if (isBiometricEnabled === undefined) {
      return error(res, 'isBiometricEnabled is required');
    }

    const status = isBiometricEnabled ? 1 : 0;

    const stmt = db.prepare(`
      UPDATE device_passcodes 
      SET is_biometric_enabled = ? 
      WHERE name = ? AND is_old = 0
    `);
    
    const info = stmt.run(status, name);

    if (info.changes === 0) {
      return error(res, 'Active device passcode record not found');
    }

    auditLogger.logSecurityEvent({
      type: 'BIOMETRIC_STATUS_UPDATED',
      deviceName: name,
      enabled: isBiometricEnabled,
      ip: req.ip
    });

    success(res, { 
      message: 'Biometric status updated successfully',
      deviceName: name,
      isBiometricEnabled
    });
  } catch (e) {
    auditLogger.logError(e, { controller: 'updateBiometricStatus' });
    error(res, e.message);
  }
};



