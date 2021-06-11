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

    logger.debug(`subConfigList.length:${subConfigList.length}`);
    for (const config of subConfigList) {
        let redisKey = getRedisKey(payload, config);

        if(op == "DELETE"){
            // 删除记录， 那就把 subConfigList 所有的key 删除掉
            logger.info(`delete redisKey: [${redisKey}]`);
            await redis.del(redisKey);
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
                    await redis.set(redisKey, redisValue);
                    if(config.expired != 0){
                        await redis.expire(redisKey, config.expired);
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
                    await redis.hmset(redisKey, redisValue);
                    if(config.expired != 0){
                        await redis.expire(redisKey, config.expired);
                    }
                }
                else{
                    logger.warn(`错误的类型。 redisValue:${redisValue}`);
                }
                continue;
            }

            if(config.value_type == "set"){
                if(Array.isArray(redisValue)){
                    await redis.sadd(redisKey , ...redisValue);
                    if(config.expired != 0){
                        await redis.expire(redisKey, config.expired);
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
                await redis.hmset(redisKey , redisValue);
                if(config.expired != 0){
                    await redis.expire(redisKey, config.expired);
                }
            }
            else{
                logger.warn(`config.value_type = "${config.value_type}" . config.value_field.length =${config.value_field.length} `);
            }
        }
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