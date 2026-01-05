import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import expressRateLimit from 'express-rate-limit';
import { validateUsername } from '../utils/usernameValidator.js';
import {
  validateEmail,
  validatePassword,
  validateVerificationCode,
} from '../utils/inputValidator.js';
import { sendVerificationEmail } from '../services/emailService.js';
import { isLocalRequest } from '../utils/requestUtils.js';

const router = express.Router();

// Constants
const VERIFICATION_CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const RESEND_COOLDOWN_MS = 30 * 1000; // 30 seconds
const resendCooldowns = new Map();

// Rate limiters
const loginLimiter = expressRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 login attempts per IP
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = expressRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 registrations per IP
  message: { error: 'Too many registration attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const verifyLimiter = expressRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 verification attempts per IP
  message: { error: 'Too many verification attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Helper functions
function generateVerificationCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

function hashVerificationCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

async function sendVerificationCode(user, code) {
  try {
    await sendVerificationEmail({
      to: user.email,
      username: user.username,
      code: code,
    });
  } catch (error) {
    console.error('[Send Verification Code] Error:', error.message);
    throw new Error('Failed to send verification email');
  }
}

// Routes
router.get('/me', (req, res) => {
  if (!req.session?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.json({ user: req.session.user });
});

router.get('/verify', async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const user = await req.userRepo.findByToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    res.json({ user: { id: user.id, username: user.username, email: user.email } });
  } catch (err) {
    next(err);
  }
});

router.post('/register', registerLimiter, async (req, res, next) => {
  try {
    if (isLocalRequest(req)) {
      return res.status(400).json({ error: 'Registration disabled on local' });
    }
    const username = String(req.body?.username || '').trim();
    const email = String(req.body?.email || '').trim();
    const password = String(req.body?.password || '');
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate username against reserved names and format rules
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      return res.status(400).json({ error: usernameValidation.reason });
    }

    // Validate email format
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return res.status(400).json({ error: emailValidation.reason });
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.reason });
    }

    // Check if email already exists
    const existingByEmail = await req.userRepo.findByEmail(email);
    if (existingByEmail && existingByEmail.email_verified) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    // Check if username already exists
    const existingByUsername = await req.userRepo.findByUsernameOrEmail(username);
    if (
      existingByUsername &&
      existingByUsername.username === username &&
      existingByUsername.email_verified
    ) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    // Determine which user to update (prioritize by email)
    let existingUser = existingByEmail;
    if (!existingUser && existingByUsername && existingByUsername.username === username) {
      existingUser = existingByUsername;
    }

    if (existingUser) {
      // User exists but not verified - update and resend
      const code = generateVerificationCode();
      const codeHash = hashVerificationCode(code);
      const newExpiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MS);
      const hash = await bcrypt.hash(password, 12);

      // Update username, email, password
      await req.db('users').where({ id: existingUser.id }).update({
        username: username,
        email: email,
        password_hash: hash,
      });

      // Create new verification code in verification_codes table
      await req.verificationCodeRepo.create(
        existingUser.id,
        codeHash,
        'email_verification',
        newExpiresAt
      );

      await sendVerificationCode({ ...existingUser, username, email }, code);
      return res.json({ verificationRequired: true, email });
    }

    // New user - create account
    const hash = await bcrypt.hash(password, 12);
    const code = generateVerificationCode();
    const codeHash = hashVerificationCode(code);
    const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MS);
    const created = await req.userRepo.createUser({
      username,
      email,
      passwordHash: hash,
      emailVerified: 0,
    });

    // Create verification code in separate table
    await req.verificationCodeRepo.create(created.id, codeHash, 'email_verification', expiresAt);
    await sendVerificationCode(created, code);
    res.json({ verificationRequired: true, email: created.email });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Username or email already exists' });
    }
    next(err);
  }
});

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    if (!username || !password) {
      return res.status(400).json({ error: 'Missing credentials' });
    }

    if (isLocalRequest(req) && username === '1' && password === '1') {
      req.session.user = { id: 1, username: 'local', email: 'local@localhost' };
      return res.json({ user: req.session.user });
    }

    // Validate password format
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const user = await req.userRepo.findByUsernameOrEmail(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (!user.email_verified) {
      return res.status(403).json({ error: 'Email not verified. Please contact support.' });
    }

    // Regenerate session to prevent session fixation
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.user = { id: user.id, username: user.username, email: user.email };
      res.json({ user: req.session.user });
    });
  } catch (err) {
    next(err);
  }
});

router.post('/verify-code', verifyLimiter, async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim();
    const code = String(req.body?.code || '').trim();
    if (!email || !code) {
      return res.status(400).json({ error: 'Missing verification info' });
    }

    // Validate email format
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return res.status(400).json({ error: emailValidation.reason });
    }

    // Validate verification code format
    const codeValidation = validateVerificationCode(code);
    if (!codeValidation.valid) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }
    const user = await req.userRepo.findByEmail(email);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (user.email_verified) {
      req.session.user = { id: user.id, username: user.username, email: user.email };
      return res.json({ user: req.session.user });
    }

    // Find valid verification code from verification_codes table
    const verificationCode = await req.verificationCodeRepo.findValid(
      user.id,
      'email_verification'
    );
    if (!verificationCode) {
      return res.status(400).json({ error: 'Verification code expired or not found' });
    }

    // Verify the code hash
    const codeHash = hashVerificationCode(code);
    if (codeHash !== verificationCode.code_hash) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Mark code as used and user as verified
    await req.verificationCodeRepo.markUsed(user.id, 'email_verification');
    await req.userRepo.markVerified(user.id);
    req.session.user = { id: user.id, username: user.username, email: user.email };
    res.json({ user: req.session.user });
  } catch (err) {
    next(err);
  }
});

router.post('/resend-code', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim();
    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    // Check cooldown
    const lastResend = resendCooldowns.get(email);
    if (lastResend && Date.now() - lastResend < RESEND_COOLDOWN_MS) {
      const remaining = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - lastResend)) / 1000);
      return res
        .status(429)
        .json({ error: `Please wait ${remaining} seconds before resending`, remaining });
    }

    const user = await req.userRepo.findByEmail(email);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.email_verified) {
      return res.status(400).json({ error: 'Email already verified' });
    }

    // Generate and send new code
    const code = generateVerificationCode();
    const codeHash = hashVerificationCode(code);
    const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MS);

    // Create new verification code in verification_codes table
    await req.verificationCodeRepo.create(user.id, codeHash, 'email_verification', expiresAt);
    await sendVerificationCode(user, code);

    // Update cooldown
    resendCooldowns.set(email, Date.now());

    res.json({ success: true, message: 'Verification code sent' });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  if (!req.session) {
    return res.json({ ok: true });
  }
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

// Request password change - sends verification code
router.post('/request-password-change', async (req, res, next) => {
  try {
    if (!req.session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const currentPassword = String(req.body?.currentPassword || '');
    if (!currentPassword) {
      return res.status(400).json({ error: 'Current password required' });
    }

    // Verify current password
    const user = await req.userRepo.findByUsernameOrEmail(req.session.user.email);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Generate and send verification code
    const code = generateVerificationCode();
    const codeHash = hashVerificationCode(code);
    const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MS);

    // Create verification code in verification_codes table
    await req.verificationCodeRepo.create(user.id, codeHash, 'password_reset', expiresAt);

    // Send email
    await sendVerificationEmail({
      to: user.email,
      username: user.username,
      code: code,
      emailType: 'password_change',
    });

    res.json({ success: true, message: 'Verification code sent to your email' });
  } catch (err) {
    next(err);
  }
});

// Change password with verification code
router.post('/change-password', async (req, res, next) => {
  try {
    if (!req.session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { newPassword, code } = req.body;
    if (!newPassword || !code) {
      return res.status(400).json({ error: 'New password and verification code required' });
    }

    // Validate new password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.reason });
    }

    // Validate verification code format
    const codeValidation = validateVerificationCode(code);
    if (!codeValidation.valid) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    const user = await req.userRepo.findByUsernameOrEmail(req.session.user.email);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find valid verification code
    const verificationCode = await req.verificationCodeRepo.findValid(user.id, 'password_reset');
    if (!verificationCode) {
      return res.status(400).json({ error: 'Verification code expired or not found' });
    }

    // Verify the code hash
    const codeHash = hashVerificationCode(code);
    if (codeHash !== verificationCode.code_hash) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Update password
    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    await req.db('users').where({ id: user.id }).update({ password_hash: newPasswordHash });

    // Mark code as used
    await req.verificationCodeRepo.markUsed(user.id, 'password_reset');

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
});

// Forgot password - request reset code (no authentication required)
router.post('/forgot-password', verifyLimiter, async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim();
    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return res.status(400).json({ error: emailValidation.reason });
    }

    const user = await req.userRepo.findByEmail(email);
    if (!user) {
      // Don't reveal if user exists
      return res.json({
        success: true,
        message: 'If this email is registered, a reset code will be sent',
      });
    }

    if (!user.email_verified) {
      return res.status(400).json({ error: 'Email not verified' });
    }

    const code = generateVerificationCode();
    const codeHash = hashVerificationCode(code);
    const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MS);

    await req.verificationCodeRepo.create(user.id, codeHash, 'password_reset', expiresAt);
    await sendVerificationEmail({
      to: user.email,
      username: user.username,
      code,
      emailType: 'password_change',
    });

    res.json({ success: true, message: 'Reset code sent to your email' });
  } catch (err) {
    next(err);
  }
});

// Reset password with verification code (no authentication required)
router.post('/reset-password', verifyLimiter, async (req, res, next) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'Email, code, and new password required' });
    }

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return res.status(400).json({ error: emailValidation.reason });
    }

    const codeValidation = validateVerificationCode(code);
    if (!codeValidation.valid) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.reason });
    }

    const user = await req.userRepo.findByEmail(email);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const verificationCode = await req.verificationCodeRepo.findValid(user.id, 'password_reset');
    if (!verificationCode) {
      return res.status(400).json({ error: 'Verification code expired or not found' });
    }

    const codeHash = hashVerificationCode(code);
    if (codeHash !== verificationCode.code_hash) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    await req.db('users').where({ id: user.id }).update({ password_hash: newPasswordHash });
    await req.verificationCodeRepo.markUsed(user.id, 'password_reset');

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    next(err);
  }
});

router.post('/token', (req, res, next) => {
  if (!req.session?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  (async () => {
    try {
      const token = crypto.randomBytes(32).toString('hex');
      await req.userRepo.updateToken(req.session.user.id, token);
      res.json({ token });
    } catch (err) {
      next(err);
    }
  })();
});

router.delete('/account', async (req, res, next) => {
  try {
    // Verify authentication
    if (!req.session?.user?.id) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { username } = req.body;

    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'Username required for confirmation' });
    }

    // Verify username matches (use session user directly)
    const user = req.session.user;

    // Username must match exactly (case-sensitive)
    if (user.username !== username.trim()) {
      return res.status(400).json({ error: 'Username does not match' });
    }

    // Cascading deletion: delete associated data first
    // Delete user's offers
    await req.db('offers').where('user_id', user.id).delete();

    // Delete verification codes
    await req.db('verification_codes').where('user_id', user.id).delete();

    // Delete user account
    await req.db('users').where('id', user.id).delete();

    // Clear session
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ success: true, message: 'Account deleted successfully' });
    });
  } catch (err) {
    next(err);
  }
});

export default router;
