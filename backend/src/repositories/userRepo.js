import crypto from 'crypto';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createUserRepo(db) {
  return {
    async findByUsernameOrEmail(value) {
      return db('users')
        .select('id', 'username', 'email', 'password_hash', 'email_verified')
        .where('username', value)
        .orWhere('email', value)
        .first();
    },
    async findByEmail(email) {
      return db('users')
        .select('id', 'username', 'email', 'password_hash', 'email_verified')
        .where({ email })
        .first();
    },
    async createUser({ username, email, passwordHash, emailVerified = 0, emailVerifiedAt = null }) {
      const [id] = await db('users').insert({
        username,
        email,
        password_hash: passwordHash,
        email_verified: emailVerified,
        email_verified_at: emailVerifiedAt,
      });
      return { id, username, email };
    },
    async markVerified(userId) {
      await db('users').where({ id: userId }).update({
        email_verified: 1,
        email_verified_at: db.fn.now(),
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
