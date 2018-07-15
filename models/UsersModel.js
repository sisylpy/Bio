var connPool = require("./ConnPool");
var LoginBean = require("../jsBean/LoginBean");
var Promise = require('promise');
var async = require('async');
var CommonBean = require('../jsBean/CommonBean');
// var await = require('await');
var Q = require('q');
var sd = require('silly-datetime');
var PDFParser = require('pdf2json');
var EXCELParser = require('node-xlsx');
let Common = new CommonBean();


module.exports = {

    show: (req, res) => {
        let pool = connPool().pool;
        // 从pool中获取连接(异步,取到后回调)
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }
            let currentPage = req.query['current_page']?req.query['current_page']:1;
            let order = req.query['order']?req.query['order']:'asc';
            async.series({
                messageGet: (callback) => {
                    let messageSql = 'SELECT im.id,pdf_name,create_time,user_ip,goods_name,message_content,check_status FROM itemMessage im' +
                        ' LEFT JOIN pdf p ON p.id=im.pdf_id' +
                        ' LEFT JOIN itemGoods ig ON ig.id=im.product_id ORDER BY pdf_name '+order+' LIMIT '+(currentPage-1)*Common.everyPage+','+Common.everyPage;
                    conn.query(messageSql, function (err, rs) {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        callback(null, rs);
                        // conn.release();
                    })
                },
                trailProductGet: (callback) => {
                    let productSql = 'SELECT id,product_name,apply_time,user_name,user_company,user_address,user_phone FROM itemApply' +
                        ' ORDER BY product_name '+order+' LIMIT '+(currentPage-1)*Common.everyPage+','+Common.everyPage;
                    conn.query(productSql, function (err, rs) {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        // 处理试用品申请
                        let applyProducts = [];
                        rs.forEach((product)=>{
                            if(applyProducts[product['id']] == undefined){
                                applyProducts[product['id']] = product;
                                applyProducts[product['id']]['mesCount'] = product['messageId']?1:0;
                            }else{
                                applyProducts[product['id']]['mesCount'] ++;
                            }
                        });
                        let applyProductRes = [];
                        for(let index in applyProducts){
                            applyProductRes.push(applyProducts[index]);
                        }
                        // 处理试用品申请结果结束
                        callback(null, applyProductRes);
                        // conn.release();
                    })
                },
                operationGet: (callback) => {
                    let current_time = sd.format(new Date(), "YYYY-MM");
                    let itemSql = 'SELECT * FROM operation WHERE operation_time >= "'+current_time+'" ORDER BY id ASC LIMIT '+(currentPage-1)*Common.everyPage+','+Common.everyPage;
                    conn.query(itemSql, function (err, rs) {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        // 处理操作统计
                        let operationInfo = {
                            0:'down_num',
                            1:'print_num',
                            2:'collect_num',
                            3:'share_num'
                        };
                        let operations = [];
                        rs.forEach((operation)=>{
                            if(operations[operation['user_ip']] == undefined){
                                operations[operation['user_ip']] = [];
                                operations[operation['user_ip']]['user_ip'] = operation['user_ip'];
                                operations[operation['user_ip']]['login_num_month'] = 0;
                                operations[operation['user_ip']]['down_num'] = 0;
                                operations[operation['user_ip']]['print_num'] = 0;
                                operations[operation['user_ip']]['collect_num'] = 0;
                                operations[operation['user_ip']]['share_num'] = 0;
                            }
                            operations[operation['user_ip']]['login_num_month'] ++;
                            operations[operation['user_ip']][operationInfo[operation['operation_type']]]++;
                        });
                        let operationRes = [];
                        for(let userIp in operations){
                            operationRes.push(operations[userIp]);
                        }
                        callback(null, operationRes);
                        // conn.release();
                    })
                },
                messageCount:(callback)=>{
                    let messageSql = 'SELECT count(im.id) count FROM itemMessage im' +
                        ' LEFT JOIN pdf p ON p.id=im.pdf_id' +
                        ' LEFT JOIN itemGoods ig ON ig.id=im.product_id';
                    conn.query(messageSql, function (err, rs) {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        callback(null, rs);
                        // conn.release();
                    })
                },
                trailProductCount:(callback)=>{
                    let productSql = 'SELECT count(id) count FROM itemApply';
                    conn.query(productSql, function (err, rs) {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        callback(null, rs);
                        // conn.release();
                    })
                },
                operationCount:(callback)=>{
                    let current_time = sd.format(new Date(), "YYYY-MM");
                    let itemSql = 'SELECT count(*) count FROM operation WHERE operation_time >= "'+current_time+'"';
                    conn.query(itemSql, function (err, rs) {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        callback(null, rs);
                        // conn.release();
                    })
                }

            }, (err, results) => {
                let type = req.query.type == undefined ? 0 : req.query.type;
                let messageRes = type == 0 ? results['messageGet']:[];
                let trailProductRes = type == 1 ? results['trailProductGet'] : [];
                let operationRes = type == 2 ? results['operationGet'] : [];
                let messageCount = type==0 ? results['messageCount'][0].count : 0;
                let trailProductCount = type==1 ? results['trailProductCount'][0].count : 0;
                let operationCount = type==2 ? results['operationCount'][0].count : 0;
                let pageList = [];
                let length;
                if(type == 0){
                    length = messageCount;
                }else if(type == 1){
                    length = trailProductCount;
                }else{
                    length = operationCount;
                }
                for(let index = 0; index<Math.ceil(length/Common.everyPage); index++){
                    pageList.push(index+1);
                }
                let totalPage = pageList[pageList.length-1];
                pageList = Common.getPageList(currentPage,pageList);  // 获取显示的列表码
                res.render('users', {
                    messageRes: messageRes,
                    trailProductRes: trailProductRes,
                    operationRes: operationRes,
                    pageList:pageList,
                    currentPage:currentPage,
                    totalPage:totalPage,
                    type: type,
                    channel: 'users'
                });
            });
            conn.release();
        });
    },
    /**
     * 审核通过
     * @param req
     * @param res
     */
    checkPassed:(req,res)=>{
        var pool = connPool().pool;
        // 从pool中获取连接(异步,取到后回调)
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }

            let message_id = req.body['message_id'];
            let collectSql = "UPDATE itemMessage SET check_status=1 WHERE id=?";
            conn.query(collectSql, [message_id], (err, rs) => {
                if (err) {
                    res.send("数据库查询错误。" + err.message);
                    return;
                }
                res.json({
                    res: true,
                    msg: '审核成功'
                })
                // conn.release();
            });
            conn.release();
        })
    },
    /**
     * 驳回
     * @param req
     * @param res
     */
    checkUnPassed:(req,res)=> {
        var pool = connPool().pool;
        // 从pool中获取连接(异步,取到后回调)
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }

            let message_id = req.body['message_id'];
            let collectSql = "UPDATE itemMessage SET check_status=2 WHERE id=?";
            conn.query(collectSql, [message_id], (err, rs) => {
                if (err) {
                    res.send("数据库查询错误。" + err.message);
                    return;
                }
                res.json({
                    res: true,
                    msg: '驳回成功'
                })
                // conn.release();
            });
            conn.release();
        })
    }
};