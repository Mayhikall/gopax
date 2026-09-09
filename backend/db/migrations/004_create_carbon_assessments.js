/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.createTable("carbon_assessments", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("trip_id")
      .notNullable()
      .unique() // One assessment per trip
      .references("id")
      .inTable("trips")
      .onDelete("CASCADE");
    table.decimal("distance_km", 10, 4).notNullable();
    table.decimal("emission_factor", 10, 6).notNullable();
    table.decimal("carbon_emission_kg", 10, 4).notNullable();
    // Nullable — only set when valid comparison is available
    table.decimal("baseline_emission_kg", 10, 4).nullable();
    table.decimal("carbon_reduction_kg", 10, 4).nullable();
    table.decimal("reduction_percentage", 8, 4).nullable();
    table.timestamp("created_at").defaultTo(knex.fn.now());
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("carbon_assessments");
};
