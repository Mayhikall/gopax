/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.createTable("trips", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("user_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    table
      .enum("category", ["BUS", "MOTORCYCLE", "CAR", "TRAIN", "AIRPLANE"])
      .notNullable();
    table.string("origin", 255).notNullable();
    table.string("destination", 255).notNullable();
    table.date("travel_date").notNullable();
    table
      .enum("status", ["PENDING", "VERIFIED", "REJECTED"])
      .notNullable()
      .defaultTo("PENDING");
    table.timestamps(true, true);
  });

  // Index for common queries
  await knex.schema.table("trips", (table) => {
    table.index(["user_id", "status"]);
    table.index("user_id");
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("trips");
};
