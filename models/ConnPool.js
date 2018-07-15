var mysql = require('mysql');
var promise_mysql = require('promise-mysql');

module.exports = (function () {

    var mysqlInfo = {
        // host: '192.168.1.106',       //主机
        host: 'localhost',       //主机
        user: 'admin',               //MySQL认证用户名
        password: 'Swolo12345!@#$%',        //MySQL认证用户密码
        database: 'Bio',
        port: '3306',                   //端口号
        dateStrings:true,
        multipleStatements:true
    };
    var pool = mysql.createPool(mysqlInfo);
    pool.on('connection', function(connection) {
        connection.query('SET SESSION auto_increment_increment=1');
    });

    var mysql_promise = promise_mysql.createConnection(mysqlInfo);

    return function(){ //返回的唯一的一个pool
        return {
            pool:pool,
            mysql:mysql_promise
        };
    };


})();
