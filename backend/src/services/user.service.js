const db = require("../../db/knex");

/**
 * Get user by ID.
 *
 * @param {string} userId
 * @returns {Promise<Object|null>}
 */
async function getById(userId) {
  return db("users").where({ id: userId }).first();
}

/**
 * Update user's display name.
 *
 * @param {string} userId
 * @param {string} name
 * @returns {Promise<Object>} updated user
 */
async function updateName(userId, name) {
  const [user] = await db("users")
    .where({ id: userId })
    .update({ name, updated_at: db.fn.now() })
    .returning("*");
  return user;
}

module.exports = { getById, updateName };
