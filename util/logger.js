//@ts-check
const { getEnv } = require("./common.js");
const PINO = require("pino");

let hostname = require("os").hostname();
const logger = PINO({
    "level" : getEnv("LOG_LEVEL" , "debug")  ,
    "base" : { "h" :  hostname , "pid": process.pid} ,
});

module.exports = logger;
