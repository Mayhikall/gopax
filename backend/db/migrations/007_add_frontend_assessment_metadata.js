/**
 * Add metadata required by the frontend to explain distance and comparisons.
 *
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
  await knex.schema.alterTable("carbon_assessments", (table) => {
    table.string("comparison_type", 16).nullable();
    table.string("comparison_category", 20).nullable();
    table.string("distance_source", 32).nullable();
  });

  // Preserve historical assessment values used by existing hashes and rewards.
  // New metadata remains null for existing rows; new trips populate it in the backend.
  await knex.schema.alterTable("rewards", (table) => {
    table.unique(["tx_hash"]);
  });
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
  await knex.schema.alterTable("rewards", (table) => {
    table.dropUnique(["tx_hash"]);
  });

  await knex.schema.alterTable("carbon_assessments", (table) => {
    table.dropColumn("comparison_type");
    table.dropColumn("comparison_category");
    table.dropColumn("distance_source");
  });
};
