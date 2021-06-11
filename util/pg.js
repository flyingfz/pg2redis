//@ts-check

const { Pool } = require("pg");
const { getEnv } = require("./common.js");



const pool = new Pool({
    "host"    : getEnv("PGHOST","127.0.0.1"),
    "port"    : parseInt(getEnv("PGPORT")),
    "database": getEnv("PGDATABASE"),
    "user"    : getEnv("PGUSER"),
    "password": getEnv("PGPASSWORD")
});

module.exports = pool;