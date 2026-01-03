/**
 * Repository for managing verification codes
 */
export function createVerificationCodeRepo(db) {
  return {
    /**
     * Create a new verification code
     * @param {number} userId - User ID
     * @param {string} codeHash - SHA-256 hash of the verification code
     * @param {string} type - Type of verification ('email_verification', 'password_reset')
     * @param {Date} expiresAt - Expiration datetime
     */
    async create(userId, codeHash, type, expiresAt) {
      await db('verification_codes').insert({
        user_id: userId,
        code_hash: codeHash,
        type,
        expires_at: expiresAt,
      });
    },

    /**
     * Find valid (unused and not expired) verification code for user
     * @param {number} userId - User ID
     * @param {string} type - Type of verification
     * @returns {Object|null} Verification code record or null
     */
    async findValid(userId, type) {
      return db('verification_codes')
        .where({ user_id: userId, type, used: 0 })
        .where('expires_at', '>', db.fn.now())
        .orderBy('created_at', 'desc')
        .first();
    },

    /**
     * Mark verification code as used
     * @param {number} userId - User ID
     * @param {string} type - Type of verification
     */
    async markUsed(userId, type) {
      await db('verification_codes')
        .where({ user_id: userId, type, used: 0 })
        .where('expires_at', '>', db.fn.now())
        .update({ used: 1 });
    },

    /**
     * Delete all expired verification codes (cleanup)
     */
    async deleteExpired() {
      await db('verification_codes').where('expires_at', '<', db.fn.now()).del();
    },

    /**
     * Delete all verification codes for a user and type
     * @param {number} userId - User ID
     * @param {string} type - Type of verification
     */
    async deleteByUserAndType(userId, type) {
      await db('verification_codes').where({ user_id: userId, type }).del();
    },
  };
}
