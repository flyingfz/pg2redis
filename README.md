# pg2redis

自动把pg里的数据同步到redis

### 原理

本程序启动之后，根据配置文件，在相关的表上创建触发器。

业务代码 ，对数据库操作之后，数据库会自动调用触发器。然后， 触发器内会通过pg 的 notify 功能，向 data_sync 的 channel 发出一个 消息。

本程序在运行过程中，会 使用 pg 的client , listen data_sync 这个 channel .

当收到了 notify 之后，遍历 配置 里 与此notify 相关表的所有子配置项。

如果 子配置项 的 value_field 有多个字段 (且 value_field 里面的数据库字段类型 不能包含 复合类型) ， 对应存储为 hash 。


如果 子配置项的 value_field 是单个字段，

根据字段的数据库类型:

    简单类型 对应存储成 string。 例如 text , number ...

    复合类型 , 必须单独配置为一个 子配置项 。
    text[],int[]  对应为 Set
    json ， 不能包含 nest object , 此时默认按照 hash 存储。


### 配置
总共需要3类配置 ， 使用 环境变量注入到进程中。

1. 配置文件

|环境变量|必填/默认值|意义|
|---|---|---|
|PG2REDIS_CONFIG|true/-|配置文件的路径|

演示配置文件:

```json
{
    "users" : [
        {
            "key_prefix": "user", "key_field": [ "id" ] , "expired": 0,
            "value_type" : "hash" ,
            "value_field":[ "id" , "nick_name" , "age" , "create_at"  ]
        },
        {
            "key_prefix": "user_age", "key_field": [ "id" ] , "expired": 0,
            "value_type" : "string" ,
            "value_field":[ "age"  ]
        },
        {
            "key_prefix": "user_tags", "key_field": [ "id" ] , "expired": 0,
            "value_type" : "set" ,
            "value_field":[ "tags"  ]
        },
        {
            "key_prefix": "user_profile", "key_field": [ "id" ] , "expired": 0,
            "value_type" : "hash" ,
            "value_field":[ "user_profile"  ]
        }
    ]
}
```
--------------------------------------

配置项说明:

|名称|类型/值域|含义|
|---|---|---|
|key_prefix|string|构造 redis key 时的前缀|
|key_field|字符串数组|构造 redis key 时 ，使用这些字段的值构造key.|
|expired|0或者正整数|0代表不过期，大于0，代表指定的秒数后过期|
|value_type|hash,set,string|设置到redis时，指定的redis数据类型|
|value_field|字符串数组|设置到redis时，存放到redis里的字段|


--------------------------------------

2. pg 环境变量:

|环境变量|必填/默认值|意义|
|---|---|---|
|PGHOST|false/127.0.0.1|pg主机名|
|PGPORT|false/5432|pg端口|
|PGDATABASE|true/-|pg数据库名称|
|PGUSER|false/postgres|pg用户|
|PGPASSWORD|true/-|密码|

--------------------------------------
3. redis 环境变量:

|环境变量|必填/默认值|意义|
|---|---|---|
|REDIS_HOST|false/127.0.0.1|redis主机名|
|REDIS_PORT|false/6379|redis端口|
|REDIS_PASS|true/-|密码|
|REDIS_DB|false/0|数据库序号|
--------------------------------------

demo 数据库 及 表
```sql
create database sample_db;

create table users (
    id text primary key ,
    nick_name text  ,
    age int ,
    create_at timestamp ,
    tags text[],
    user_profile jsonb
);
```


使用默认的示例配置文件  启动 进程之后， 执行以下 sql 语句:

```sql
insert into users(id, nick_name , age , create_at , tags, user_profile) values ('1','aaaa' , 23 , '2021-06-11 13:23:32' , '{"male", "student"}' , '{"address": "xxxxx" , "img": "http://xxxxxx" }' ) on conflict(id) do update set nick_name = excluded.nick_name , age = excluded.age , tags = excluded.tags , user_profile = excluded.user_profile;
```

查看 redis 里的 数据 :

```bash
192.168.1.12:6379> keys *
1) "user:1"
2) "user_profile:1"
3) "user_age:1"
4) "user_tags:1"
192.168.1.12:6379> hgetall user:1
1) "id"
2) "1"
3) "nick_name"
4) "aaaa"
5) "age"
6) "23"
7) "create_at"
8) "2021-06-11T13:23:32"
192.168.1.12:6379> hgetall user_profile:1
1) "img"
2) "http://xxxxxx"
3) "address"
4) "xxxxx"
192.168.1.12:6379> get user_age:1
"23"
192.168.1.12:6379> smembers user_tags:1
1) "student"
2) "male"
192.168.1.12:6379>
```


## TODO:
* redis 操作时使用 pipeline 优化性能
* 增加测试代码
* 冷数据加载
