//@ts-check

const Redis = require("ioredis");
const { getEnv } = require("./common.js");

const redisOption = {
    host    : getEnv("REDIS_HOST","127.0.0.1"),
    port    : parseInt(getEnv("REDIS_PORT","6379")),
    password: getEnv("REDIS_PASS"),
    family  : 4,
    db      : parseInt(getEnv("REDIS_DB", "0"))
};

const redis = new Redis(redisOption);
module.exports = redis;
