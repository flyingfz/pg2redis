//@ts-check

/**
 * 从环境变量里获取配置值. 如果环境变量里未设置此名字且为提供默认值，则会退出进程.
 * @param {string} envName 环境变量的名字
 * @param {string} [dftValue] 如环境变量里没有，则使用此默认值.
 * @returns {string}
 */
 function getEnv(envName , dftValue) {
    let v_env = process.env[envName];
    if(!v_env){
        if(!dftValue){
            console.error(`未获取到 ${envName} 环境变量，且未提供默认值.`);
            process.exit();
        }
        else{
            return dftValue;
        }
    }
    return v_env;
}

module.exports = { getEnv }
