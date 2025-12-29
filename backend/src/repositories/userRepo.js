import crypto from "crypto";

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createUserRepo(db) {
  return {
    async findByUsernameOrEmail(value) {
      return db("users")
        .select("id", "username", "email", "password_hash")
        .where("username", value)
        .orWhere("email", value)
        .first();
    },
    async createUser({ username, email, passwordHash }) {
      const [id] = await db("users").insert({
        username,
        email,
        password_hash: passwordHash
      });
      return { id, username, email };
    },
    async updateToken(userId, token) {
      const tokenHash = hashToken(token);
      await db("users").where({ id: userId }).update({ api_token_hash: tokenHash });
      return token;
    },
    async findByToken(token) {
      const tokenHash = hashToken(token);
      return db("users")
        .select("id", "username", "email")
        .where({ api_token_hash: tokenHash })
        .first();
    }
  };
}
