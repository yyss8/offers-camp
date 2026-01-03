import validator from 'validator';

/**
 * Validates email format and length
 * @param {string} email - Email to validate
 * @returns {{valid: boolean, reason?: string}} Validation result
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, reason: 'Email is required' };
  }

  const trimmed = email.trim();

  if (!validator.isEmail(trimmed)) {
    return { valid: false, reason: 'Invalid email format' };
  }

  if (trimmed.length > 254) {
    return { valid: false, reason: 'Email too long' };
  }

  return { valid: true };
}

/**
 * Validates password strength and length
 * @param {string} password - Password to validate
 * @returns {{valid: boolean, reason?: string}} Validation result
 */
export function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, reason: 'Password is required' };
  }

  if (password.length < 6) {
    return { valid: false, reason: 'Password must be at least 6 characters' };
  }

  if (password.length > 128) {
    return { valid: false, reason: 'Password too long' };
  }

  return { valid: true };
}

/**
 * Validates verification code format (6 digits)
 * @param {string} code - Verification code to validate
 * @returns {{valid: boolean, reason?: string}} Validation result
 */
export function validateVerificationCode(code) {
  if (!code || typeof code !== 'string') {
    return { valid: false, reason: 'Verification code is required' };
  }

  if (!/^\d{6}$/.test(code.trim())) {
    return { valid: false, reason: 'Invalid verification code format' };
  }

  return { valid: true };
}
