/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  // 1. Create vouchers catalog table
  await knex.schema.createTable("vouchers", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.string("title").notNullable();
    table.text("description").notNullable();
    table.string("category", 32).notNullable().defaultTo("TRANSIT");
    table.integer("price").notNullable().defaultTo(1); // Price in whole GOPAX tokens
    table.integer("stock").notNullable().defaultTo(100);
    table.string("code").notNullable(); // Template / base promo code
    table.string("image_url").nullable();
    table.boolean("is_active").notNullable().defaultTo(true);
    table.timestamps(true, true);
  });

  // 2. Create voucher redemptions history table
  await knex.schema.createTable("voucher_redemptions", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("user_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    table
      .uuid("voucher_id")
      .notNullable()
      .references("id")
      .inTable("vouchers")
      .onDelete("RESTRICT");
    table.string("voucher_code").notNullable();
    table.integer("amount_paid").notNullable();
    table.string("tx_hash", 66).notNullable().unique(); // On-chain anti-replay
    table.timestamp("created_at").defaultTo(knex.fn.now());
  });

  await knex.schema.table("voucher_redemptions", (table) => {
    table.index(["user_id"]);
    table.index(["voucher_id"]);
  });

  // 3. Seed initial default vouchers
  await knex("vouchers").insert([
    {
      title: "Suburban Rail Pass Discount",
      description: "Get IDR 10,000 off your next suburban train transit ticket.",
      category: "TRANSIT",
      price: 5,
      stock: 50,
      code: "RAIL-PASS-10K",
    },
    {
      title: "City Metro Transit Pass",
      description: "IDR 15,000 credit for urban underground and elevated metro lines.",
      category: "TRANSIT",
      price: 10,
      stock: 40,
      code: "METRO-PASS-15K",
    },
    {
      title: "Eco Cafe 50% Off",
      description: "Enjoy 50% off beverages and baked goods at participating sustainable cafes.",
      category: "FNB",
      price: 8,
      stock: 75,
      code: "ECO-CAFE-50",
    },
    {
      title: "Clean Energy Household Credit",
      description: "IDR 25,000 deduction on clean electricity utility bills for low-emission homes.",
      category: "UTILITY",
      price: 15,
      stock: 30,
      code: "CLEAN-POWER-25K",
    },
    {
      title: "Electric Bus Network Pass",
      description: "IDR 20,000 fare credit for municipal electric and rapid bus transit.",
      category: "TRANSIT",
      price: 12,
      stock: 60,
      code: "BUS-PASS-20K",
    },
  ]);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("voucher_redemptions");
  await knex.schema.dropTableIfExists("vouchers");
};
