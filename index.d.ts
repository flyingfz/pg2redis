
/**每个表的配置项 */
interface SubConfig {

    /** redis 的key 的前缀 */
    key_prefix : string ;

    /** 组成 redis key 的字段 */
    key_field: Array<string> ;

    /** 过期设置 。  0 代表不过期  以秒为单位 */
    expired : number ;

    /** redis key 的类型 */
    value_type : "hash" | "set" | "string";

    /** 组成 redis key 的 value */
    value_field : Array<string>
}

class PGNotifyPayload {
    table : string ;

    op : "INSERT" | "UPDATE" | "DELETE";

}

interface RedisCmd {

    /** redis 的 key */
    key : string ;

    /** 设置到 key 的value */
    value : object ;

    /** 过期时间 */
    expire : number ;

    /** 该使用的 redis 命令 hmset  , del , set 之类 */
    cmd : string ;
}