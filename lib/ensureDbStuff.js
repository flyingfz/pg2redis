//@ts-check
const logger = require("../util/logger.js");
const pg = require("../util/pg.js");

/**
 * 创建或更新 数据库里的对象(触发器、函数)
 * @param {Object} pg2redis
 */
async function ensureDbStuff(pg2redis) {
    let tableNameList = Object.keys(pg2redis);
    logger.debug(`共:${tableNameList.length} 个表需要监控`);
    for (const tableName of tableNameList) {
        //属于同一个表的 配置项， 公用一个触发器的函数， 构造触发器函数里的字段信息

        /**@type {Array<SubConfig>} */
        let subConfigList = pg2redis[tableName];
        // 把 表名相同的 配置项里， 所有的字段名取出来，以这些字段名作为参数，创建触发器
        let fieldSet = new Set();
        for (const config of subConfigList) {
            config.key_field.forEach(t => { fieldSet.add(t) });
            config.value_field.forEach(t => { fieldSet.add(t) });
        }
        let fieldAry = Array.from(fieldSet);

        const triggerName = `t_${tableName}_notify`;
        const triggerFuncName = `f_${tableName}_notify_change`;
        //更新 函数 及 触发器
        await ensureFunction(triggerFuncName ,fieldAry);
        await ensureTrigger(tableName , triggerName, triggerFuncName);
    }
}

/**
 * 检查 触发器是否存在，不存在就创建.
 * @param {string} tableName
 * @param {string} triggerName
 * @param {string} triggerFuncName
 */
async function ensureTrigger(tableName ,triggerName , triggerFuncName) {
    // let dropSql = `drop trigger if exists ${triggerName} on ${tableName} ;`;
    let checkSql = `SELECT tgname FROM pg_trigger WHERE tgname = $1`;
    let { rows } = await pg.query(checkSql,[triggerName]);
    if(  rows.length == 0){
        // 还没有这个触发器.
        logger.info(`${triggerName} 还不存在. 创建。`);
        let createSql = `CREATE TRIGGER ${triggerName} AFTER INSERT OR UPDATE OR DELETE ON ${tableName} FOR EACH ROW EXECUTE PROCEDURE ${triggerFuncName}();`;
        await pg.query(createSql);
        logger.debug(createSql);
        logger.info(`在表[${tableName}]上，创建 触发器[${triggerName}] 成功.`);
    }
    else{
        logger.debug(`${triggerName} 已经存在。`);
    }
}

/**
 * 创建或更新 触发器函数.
 * @param {string} triggerFuncName
 * @param {Array<string>} fieldAry
 */
async function ensureFunction(triggerFuncName , fieldAry) {
    let payloadAry = [ "'table'" , "TG_RELNAME" , "'op'" , "TG_OP" ];

    const create_trigger_func =
`CREATE OR REPLACE FUNCTION ${triggerFuncName}() RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        PERFORM pg_notify('data_sync' , json_build_object(${payloadAry.join(',')} , ${fieldAry.map(t=> { return `'${t}', NEW.${t}`;}).join(',')})::text ); RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        PERFORM pg_notify('data_sync' , json_build_object(${payloadAry.join(',')} , ${fieldAry.map(t=> { return `'${t}', NEW.${t}`;}).join(',')})::text); RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        PERFORM pg_notify('data_sync' , json_build_object(${payloadAry.join(',')} , ${fieldAry.map(t=> { return `'${t}', OLD.${t}`;}).join(',')})::text); RETURN OLD;
    END IF;
END; $$ LANGUAGE plpgsql ;`
    await pg.query(create_trigger_func);
    logger.info(create_trigger_func);
    logger.info(`CREATE OR REPLACE [${triggerFuncName}] success`);
}

module.exports = ensureDbStuff;