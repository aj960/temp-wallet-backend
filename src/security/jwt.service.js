const jwt = require('jsonwebtoken');

class JWTService {
  constructor() {
    this.secret = process.env.JWT_SECRET;
    this.refreshSecret = process.env.JWT_REFRESH_SECRET;
    this.expiresIn = process.env.JWT_EXPIRE || '7d';
    this.refreshExpiresIn = process.env.JWT_REFRESH_EXPIRE || '30d';

    if (!this.secret || !this.refreshSecret) {
      throw new Error('JWT secrets must be defined in environment variables');
    }
  }

  /**
   * Generate access token
   * @param {object} payload - User data to encode
   * @returns {string} - JWT token
   */
  generateAccessToken(payload) {
    return jwt.sign(
      {
        id: payload.id,
        email: payload.email,
        role: payload.role,
        type: 'access'
      },
      this.secret,
      {
        expiresIn: this.expiresIn,
        issuer: 'trustwallet-backend',
        audience: 'trustwallet-api'
      }
    );
  }

  /**
   * Generate refresh token
   * @param {object} payload - User data to encode
   * @returns {string} - JWT refresh token
   */
  generateRefreshToken(payload) {
    return jwt.sign(
      {
        id: payload.id,
        type: 'refresh'
      },
      this.refreshSecret,
      {
        expiresIn: this.refreshExpiresIn,
        issuer: 'trustwallet-backend',
        audience: 'trustwallet-api'
      }
    );
  }

  /**
   * Generate both access and refresh tokens
   * @param {object} payload - User data
   * @returns {object} - { accessToken, refreshToken }
   */
  generateTokenPair(payload) {
    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
      expiresIn: this.expiresIn
    };
  }

  /**
   * Verify access token
   * @param {string} token - JWT token
   * @returns {object} - Decoded payload
   */
  verifyAccessToken(token) {
    try {
      return jwt.verify(token, this.secret, {
        issuer: 'trustwallet-backend',
        audience: 'trustwallet-api'
      });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token has expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      }
      throw new Error('Token verification failed');
    }
  }

  /**
   * Verify refresh token
   * @param {string} token - JWT refresh token
   * @returns {object} - Decoded payload
   */
  verifyRefreshToken(token) {
    try {
      return jwt.verify(token, this.refreshSecret, {
        issuer: 'trustwallet-backend',
        audience: 'trustwallet-api'
      });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Refresh token has expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid refresh token');
      }
      throw new Error('Refresh token verification failed');
    }
  }

  /**
   * Decode token without verification (for inspection)
   * @param {string} token - JWT token
   * @returns {object} - Decoded payload
   */
  decodeToken(token) {
    return jwt.decode(token);
  }
}

module.exports = new JWTService();



