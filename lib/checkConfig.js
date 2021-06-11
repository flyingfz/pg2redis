//@ts-check

const pg = require("../util/pg.js");

/**
 * 检查 业务逻辑的配置是否合法
 * @param {object} pg2redis
 * @returns {Promise<Array<string>>}
 */
async function checkConfig(pg2redis) {
    // 1. 表名不能重复 . 且必须在数据库里存在
    // 2. 表名下的字段必须存在
    // 3. 所有的 key_prefix 的值不能重复
    // 4. 子配置项 的 value_field 有多个字段 ,  value_type 的值只能是 hash
    // 5. 子配置项 的 value_field 1 个字段    value_type 的值只能是 set  或者 string  hash

    let errMsg = [];
    let tableNameList = Object.keys(pg2redis);
    let tableNameSet = new Set(tableNameList);
    if(tableNameList.length != tableNameSet.size){
        // throw new Error(`pg2redis 配置里， 表名存在重复情况。`);
        errMsg.push(`pg2redis 配置里， 表名存在重复情况。`);
    }

    // 检查数据库表 是否都存在
    let dbTableNameList = await getDbTableNames(tableNameList);
    let notExistTableNames = tableNameList.filter(t => { return !dbTableNameList.includes(t)});
    if(notExistTableNames.length > 0){
        // throw new Error(`数据库中不存在 ${notExistTableNames.join(" , ")}.`);
        errMsg.push(`数据库中不存在 ${notExistTableNames.join(" , ")}.`);
    }

    // 检查每个表里，字段是否都存在.
    for (const tableName of tableNameList) {
        //拿出 这个表所有的字段名.
        let dbFieldList = await getDbTableField(tableName);

        /** @type {Array<SubConfig>} */
        let subConfig = pg2redis[tableName];
        // 把当前配置里 所有的 key_field 和 value_field 里的字段名，放入 一个Set .
        let fieldSet = new Set();
        let prefixSet = new Set();
        for (const config of subConfig) {
            config.key_field.forEach(t => { fieldSet.add(t)});
            config.value_field.forEach(t => { fieldSet.add(t)});

            prefixSet.add(config.key_prefix);

            if(config.value_field.length > 1 && config.value_type != "hash"){
                // value_field 有多个字段， 但 对应的不是 redis  的 hash 类型。
                errMsg.push(`${config.key_prefix} 的配置里， value_field 个数超过1个 ， 但 value_type 不是 hash .`);
            }else if(config.value_field.length == 1 && ![ "hash", "set" , "string" ].includes(config.value_type)){
                errMsg.push(`${config.key_prefix} 的配置里， value_field 个数是1个 ， 但 value_type 不是 hash 、set 、string .`);
            }
        }
        // 检查 fieldSet 是否全部在 dbFieldList 中。
        let invalidField = [];
        fieldSet.forEach(t => {
            if(!dbFieldList.includes(t)){
                invalidField.push(t);
            }
        });
        if(invalidField.length > 0){
            // throw new Error(`${tableName} 里 ， ${invalidField.join(" ， ")} 不存在`);
            errMsg.push(`${tableName} 里 ， ${invalidField.join(" ， ")} 不存在.`);
        }

        if(prefixSet.size != subConfig.length){
            // throw new Error(`${tableName} 的配置里 ， key_prefix 存在重复的情况.`);
            errMsg.push(`${tableName} 的配置里 ， key_prefix 存在重复的情况.`);
        }
    }

    return errMsg;
}

/**
 * 从数据库里拿出 指定 表里的所有字段名
 * @param {string} tableName
 * @returns {Promise<Array<string>>}
 */
async function getDbTableField(tableName) {
    let sql = `select column_name from information_schema.columns where table_name = $1`;
    let { rows } = await pg.query(sql, [tableName]);
    return rows.map(t => { return t.column_name ;});
}

/**
 * 从数据库里获取指定的表名。
 * @param {Array<string>} tableNameList
 * @returns {Promise<Array<string>>}
 */
async function getDbTableNames(tableNameList) {
    let sql = `select relname from pg_class where relname = ANY($1)`;
    let {rows} = await pg.query(sql , [ tableNameList ]);
    return rows.map(t => { return t.relname ;});
}

module.exports = checkConfig;