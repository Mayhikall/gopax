/**
 * Adds Privy as the canonical application identity while preserving existing
 * wallet-first accounts for an explicit migration/linking step.
 */
exports.up = async function (knex) {
  await knex.schema.alterTable("users", (table) => {
    table.string("privy_user_id", 128).nullable().unique();
    table.string("auth_method", 24).nullable();
    table.string("wallet_type", 24).nullable();
    table.string("email", 320).nullable();
  });

  await knex("users")
    .whereNull("auth_method")
    .update({ auth_method: "wallet", wallet_type: "external" });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("users", (table) => {
    table.dropColumn("email");
    table.dropColumn("wallet_type");
    table.dropColumn("auth_method");
    table.dropColumn("privy_user_id");
  });
};
