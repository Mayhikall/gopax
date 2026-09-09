/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.createTable("trip_proofs", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("trip_id")
      .notNullable()
      .references("id")
      .inTable("trips")
      .onDelete("CASCADE");
    // Needed for UNIQUE(user_id, proof_hash) duplicate prevention
    table
      .uuid("user_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    table.string("proof_type", 10).notNullable(); // jpg, png, pdf
    table.text("storage_key").notNullable(); // path in Supabase Storage
    table.string("proof_hash", 64).notNullable(); // SHA-256 hex string
    table.timestamp("created_at").defaultTo(knex.fn.now());
  });

  // UNIQUE constraint to prevent same user reusing same proof file
  await knex.schema.table("trip_proofs", (table) => {
    table.unique(["user_id", "proof_hash"]);
    table.index("trip_id");
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("trip_proofs");
};
