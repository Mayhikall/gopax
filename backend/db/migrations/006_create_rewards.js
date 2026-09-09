/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.createTable("rewards", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("user_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    table
      .uuid("trip_id")
      .notNullable()
      .unique() // One reward per trip
      .references("id")
      .inTable("trips")
      .onDelete("CASCADE");
    table.integer("amount").notNullable().defaultTo(0); // GOPAX token amount
    table
      .enum("status", ["AVAILABLE", "CLAIMED", "FAILED"])
      .notNullable()
      .defaultTo("AVAILABLE");
    // Keccak256 hash of assessment payload — stored as hex string
    table.string("assessment_hash", 66).notNullable().unique();
    // Nullable until transaction confirmed
    table.string("tx_hash", 66).nullable();
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("claimed_at").nullable();
  });

  await knex.schema.table("rewards", (table) => {
    table.index(["user_id", "status"]);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("rewards");
};
