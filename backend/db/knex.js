require("dotenv").config();

// PostgreSQL DATE is a calendar date, not a timestamp. Preserve it across time zones.
require("pg").types.setTypeParser(1082, (value) => value);
const knex = require("knex");
const config = require("../knexfile");

const env = process.env.NODE_ENV || "development";
const db = knex(config[env]);

module.exports = db;
