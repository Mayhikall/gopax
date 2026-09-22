require("dotenv").config();
const dns = require("dns");
const net = require("net");

// Prioritize IPv4 and prevent hanging on unreachable IPv6 routes
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}
if (typeof net.setDefaultAutoSelectFamily === "function") {
  net.setDefaultAutoSelectFamily(false);
}

/**
 * @type { Object.<string, import("knex").Knex.Config> }
 */
const isRemoteDb =
  process.env.DB_HOST &&
  process.env.DB_HOST !== "localhost" &&
  process.env.DB_HOST !== "127.0.0.1";

module.exports = {
  development: {
    client: "pg",
    connection: {
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432", 10),
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "postgres",
      database: process.env.DB_NAME || "gopax",
      ssl: isRemoteDb ? { rejectUnauthorized: false } : false,
    },
    migrations: {
      directory: "./db/migrations",
      tableName: "knex_migrations",
    },
    seeds: {
      directory: "./db/seeds",
    },
    pool: {
      min: 2,
      max: 10,
    },
  },

  production: {
    client: "pg",
    connection: {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || "5432", 10),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: { rejectUnauthorized: false },
    },
    migrations: {
      directory: "./db/migrations",
      tableName: "knex_migrations",
    },
    pool: {
      min: 2,
      max: 10,
    },
  },
};
