/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.createTable("ai_assessments", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("trip_id")
      .notNullable()
      .unique() // One AI assessment per trip
      .references("id")
      .inTable("trips")
      .onDelete("CASCADE");
    table.enum("decision", ["REWARD", "NO_REWARD"]).notNullable();
    table.integer("recommended_reward").notNullable().defaultTo(0);
    table.text("reason").notNullable();
    table.timestamp("created_at").defaultTo(knex.fn.now());
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("ai_assessments");
};
