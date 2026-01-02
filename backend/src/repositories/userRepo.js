import crypto from 'crypto';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createUserRepo(db) {
  return {
    async findByUsernameOrEmail(value) {
      return db('users')
        .select(
          'id',
          'username',
          'email',
          'password_hash',
          'email_verified',
          'email_verify_code_hash',
          'email_verify_expires_at'
        )
        .where('username', value)
        .orWhere('email', value)
        .first();
    },
    async findByEmail(email) {
      return db('users')
        .select(
          'id',
          'username',
          'email',
          'password_hash',
          'email_verified',
          'email_verify_code_hash',
          'email_verify_expires_at'
        )
        .where({ email })
        .first();
    },
    async createUser({
      username,
      email,
      passwordHash,
      emailVerified = 0,
      emailVerifiedAt = null,
      emailVerifyCodeHash = null,
      emailVerifyExpiresAt = null,
    }) {
      const [id] = await db('users').insert({
        username,
        email,
        password_hash: passwordHash,
        email_verified: emailVerified,
        email_verified_at: emailVerifiedAt,
        email_verify_code_hash: emailVerifyCodeHash,
        email_verify_expires_at: emailVerifyExpiresAt,
      });
      return { id, username, email };
    },
    async setVerificationCode(userId, codeHash, expiresAt) {
      await db('users').where({ id: userId }).update({
        email_verify_code_hash: codeHash,
        email_verify_expires_at: expiresAt,
      });
    },
    async markVerified(userId) {
      await db('users').where({ id: userId }).update({
        email_verified: 1,
        email_verified_at: db.fn.now(),
        email_verify_code_hash: null,
        email_verify_expires_at: null,
      });
    },
    async updateToken(userId, token) {
      const tokenHash = hashToken(token);
      await db('users').where({ id: userId }).update({ api_token_hash: tokenHash });
      return token;
    },
    async findByToken(token) {
      const tokenHash = hashToken(token);
      return db('users')
        .select('id', 'username', 'email')
        .where({ api_token_hash: tokenHash })
        .first();
    },
  };
}
