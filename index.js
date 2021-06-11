//@ts-check
require('dotenv').config();
const logger = require("./util/logger.js");
const fs = require("fs");

const { getEnv } = require("./util/common.js");
let pg2redis = getConfig();

logger.debug(`start pg2redis`);

const pg = require("./util/pg.js");

const checkConfig   = require("./lib/checkConfig.js");
const ensureDbStuff = require("./lib/ensureDbStuff.js");
const processNotify = require("./lib/processNotify.js");

/** @type {import("pg").PoolClient} */
let client ;

void async function main() {
    try {
        let checkErrorMsgList = await checkConfig(pg2redis);
        if(checkErrorMsgList.length > 0){
            checkErrorMsgList.forEach(t => {
                logger.error(t);
            });
            throw new Error(`配置文件里 pg2redis 部分有错误.退出.`);
        }
        // 确保数据库里存在 触发器 、 函数
        await ensureDbStuff(pg2redis);
    } catch (error) {
        logger.error(`发生异常.退出.\n`,error);
        process.exit();
    }

    client = await pg.connect();
    logger.debug(`clent checkout.`);
    await client.query(`LISTEN data_sync;`);
    logger.debug(`ready receive notification.`);
    client.on("notification", async (msg)  => {
        // logger.debug(`收到 通知.payload: ${JSON.stringify(msg)}`);
        // 拿出这个表的 子配置 ，丢给 processNotify 处理
        /** @type {PGNotifyPayload} */
        const payload = JSON.parse(msg.payload);
        const { table } = payload ;
        let subConfigs = pg2redis[table];
        if(subConfigs == null){
            logger.info(`${table} 在配置里不存在。跳过处理.`);
            return;
        }
        try {
            await processNotify(payload , subConfigs);
        } catch (error) {
            logger.error(`${table} 的消息处理出错.`,payload,error);
        }

    });
}();


/**
 * 获取配置信息对象。
 *
 * @returns {object}
 */
function getConfig() {
    let configPath = getConfigFilePath();
    logger.info(`配置文件路径: ${configPath}`);
    let config ;
    try {
        config = JSON.parse(fs.readFileSync(configPath).toString());
    } catch (error) {
        logger.error(`配置文件不是合法的json.`, error);
        throw new Error("配置文件不是合法的json")
    }
    return config;
}

/**
 * 获取配置文件的路径
 * 从  环境变量里 获取配置文件路径。
 * @returns {string}
 */
function getConfigFilePath() {
    let configFilePath = getEnv("PG2REDIS_CONFIG");
    if(!fs.existsSync(configFilePath)){
        // 错误的路径。
        throw new Error(`文件不存在.[${configFilePath}]`)
    }
    return configFilePath;
}