//@ts-check

const logger = require("../util/logger.js");
const redis = require("../util/redis.js");
/**
 * 处理 数据库的消息通知。 根据消息 和 配置 ，操作 redis
 * @param {PGNotifyPayload} payload
 * @param {Array<SubConfig>} subConfigList
 */
async function processNotify(payload ,subConfigList) {
    let { op } = payload ;
    const pipeline = redis.pipeline();
    for (const config of subConfigList) {
        let redisKey = getRedisKey(payload, config);

        if(op == "DELETE"){
            // 删除记录， 那就把 subConfigList 所有的key 删除掉
            logger.info(`del ${redisKey}`);
            pipeline.del(redisKey);
            continue;
        }
        // insert 或者 update
        // 根据 value_field 的长度， 以及 value_type .  生成redis 操作的命令

        if(config.value_field.length == 1){
            //#region  value_field 只有一个 的情况
            let redisValue = payload[config.value_field[0]];
            if(config.value_type == "string"){
                //redisValue  应该是个 string 或者 number 或者 date.
                let vt = typeof redisValue ;
                if(vt == "string" || vt == "number" || vt == "boolean" || vt == "bigint" || redisValue instanceof Date){
                    logger.info(`set ${redisKey} ${redisValue}`);
                    pipeline.set(redisKey, redisValue);
                    if(config.expired > 0){
                        logger.info(`expire ${redisKey} ${config.expired}`);
                        pipeline.expire(redisKey, config.expired);
                    }
                }else{
                    logger.warn(`不支持的类型. redisValue:${redisValue} . config.value_field[0]:${config.value_field[0]}` );
                }

                continue;
            }
            //

            if(config.value_type == "hash") {
                //redisValue  应该是个 json 对象
                let vt = typeof redisValue ;
                if(vt == "object"){
                    // await redis.hmset(redisKey, redisValue);
                    // hash 的话 ， 要先删除 原来的 key ， 再重新设置 。否则 ， 会有一些数据还保留在 这个 key 中。
                    logger.info(`del ${redisKey}`);
                    logger.info(`hmset ${redisKey} ${JSON.stringify(redisValue)}`);
                    pipeline.del(redisKey).hmset(redisKey, redisValue);

                    if(config.expired > 0){
                        logger.info(`expire ${redisKey} ${config.expired}`);
                        pipeline.expire(redisKey, config.expired);
                    }
                }
                else{
                    logger.warn(`错误的类型。 redisValue:${redisValue}`);
                }
                continue;
            }

            if(config.value_type == "set"){
                if(Array.isArray(redisValue)){
                    logger.info(`del ${redisKey}`);
                    logger.info(`sadd ${redisKey} ${ [...redisValue]}`);
                    pipeline.del(redisKey).sadd(redisKey , ...redisValue);
                    if(config.expired > 0){
                        logger.info(`expire ${redisKey} ${config.expired}`);
                        pipeline.expire(redisKey, config.expired);
                    }
                }
                else{
                    logger.warn(`redisValue:${redisValue} 不是数组。`);
                }
            }
            //#endregion
        }
        else{
            // value_field 有多个 的情况 。 只支持 hash
            if(config.value_type == "hash"){
                let redisValue = getRedisValue(payload, config.value_field);
                logger.info(`del ${redisKey}`);
                logger.info(`hmset ${redisKey} ${JSON.stringify(redisValue)}`);
                pipeline.del(redisKey).hmset(redisKey, redisValue);
                if(config.expired > 0){
                    logger.info(`expire ${redisKey} ${config.expired}`);
                    pipeline.expire(redisKey, config.expired);
                }
            }
            else{
                logger.warn(`config.value_type = "${config.value_type}" . config.value_field.length =${config.value_field.length} `);
            }
        }
    }

    try {
        const result = await pipeline.exec();
        logger.debug(`redis op success. result:${JSON.stringify(result)}` );
    } catch (error) {
        logger.error(`payload:${JSON.stringify(payload)}`);
        logger.error(`redis op error.message ${error.message}`);
        logger.error(`stack: ${error.stack}`);
    }
}

/**
*
* @param {object} data
* @param {SubConfig} configItem
* @returns {string}
*/
function getRedisKey(data, configItem) {
    let keySuffixAry = [];
    for (const key of configItem.key_field) {
      let fieldValue = data[key];
      keySuffixAry.push(fieldValue);
    }
    let key = `${configItem.key_prefix}:${keySuffixAry.join(":")}`;
    return key;
  }

  /**
  *
  * @param {object} data
  * @param {Array<string>} value_field
  * @returns {object}
  */
  function getRedisValue(data, value_field) {
    let value = {};
    for (const fieldName of value_field) {
      let fieldValue = data[fieldName];
      value[fieldName] = fieldValue;
    }
    return value;
  }

module.exports = processNotify;