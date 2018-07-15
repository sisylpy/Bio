var connPool = require("./ConnPool");
var LoginBean = require("../jsBean/LoginBean");
var Promise = require('promise');
var async = require('async');
var CommonBean = require('../jsBean/CommonBean');
// var await = require('await');
var Q = require('q');
var sd = require('silly-datetime');
let Common = new CommonBean();


module.exports = {
    /**
     * 显示文献列表
     * @param req
     * @param res
     */
    show: (req, res) => {
        let pool = connPool().pool;
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }
            let currentPage = req.query['current_page']?req.query['current_page']:1;
            let order = req.query['order']?req.query['order']:'asc';
            async.series({
                literatureGet: (callback) => {
                    let literatureSql = 'SELECT id,experiment_name,issue_time,magazine_name,author,address,summary,create_time FROM experiment ORDER BY experiment_name '+order+' LIMIT '+(currentPage-1)*Common.everyPage+','+Common.everyPage;
                    conn.query(literatureSql, function (err, rs) {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        // conn.release();
                        async.map(rs,(literature,call)=>{
                            let getItemSql = 'SELECT item_name FROM item i' +
                                ' JOIN itemMaterials im ON im.item_id=i.id' +
                                ' WHERE experiment_id = '+literature.id;
                            conn.query(getItemSql,(err,itemRs)=>{
                                if (err) {
                                    res.send("数据库查询错误。" + err.message);
                                    return;
                                }
                                itemRs.forEach((item)=>{
                                    if(literature['item_name'] == undefined){
                                        literature['item_name'] = '';
                                    }
                                    if(literature['item_name'] != ''){
                                        literature['item_name'] += ' ';
                                    }
                                    literature['item_name'] += item.item_name;
                                })
                                call(null,rs);
                            });
                        },(err,result)=>{
                            callback(null,rs);
                        })
                    })
                },
                literatureCount:(callback)=>{
                    let countSql = "SELECT count(id) count FROM experiment";
                    conn.query(countSql, function (err, rs) {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        callback(null, rs)
                        // conn.release();
                    })
                }
            }, (err, results) => {
                let literatureRes = results['literatureGet'];
                let literatureCount = results['literatureCount'][0].count;
                let pageList = [];
                let length = literatureCount;
                for(let index = 0; index<Math.ceil(length/Common.everyPage); index++){
                    pageList.push(index+1);
                }
                let totalPage = pageList[pageList.length-1];
                pageList = Common.getPageList(currentPage,pageList);  // 获取显示的列表码
                res.render('literature', {literatureRes: literatureRes, pageList:pageList,
                    currentPage:currentPage,totalPage:totalPage, channel: 'literature'});
            });
            conn.release();
        });
    },
    showAdd:(req,res)=>{
        let pool = connPool().pool;
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }
            async.series({
                brandGet: (callback) => {
                    let literatureSql = 'SELECT id,manuName FROM manufacturer';
                    conn.query(literatureSql, function (err, rs) {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        callback(null, rs)
                        // conn.release();
                    })
                }
            }, (err, results) => {
                let brandRes = results['brandGet'];
                let time = sd.format(new Date(), "YYYY-MM-DD HH:mm:ss");
                res.render('addliterature', {currentTime: time,brandRes: brandRes, channel: 'literature'});
            });
            conn.release();
        });
    },
    showEdit:(req,res)=>{
        let pool = connPool().pool;
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }
            async.series({
                brandGet: (callback) => {
                    let literatureSql = 'SELECT id,manuName FROM manufacturer';
                    conn.query(literatureSql, function (err, rs) {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        callback(null, rs)
                        // conn.release();
                    })
                },
                literatureOne: (callback) => {
                    let literatureId = req.query['literature_id'];
                    let literatureOneSql = "SELECT * FROM experiment WHERE id=" + literatureId;
                    conn.query(literatureOneSql, (err, rs) => {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        callback(null, rs);
                    })
                }
            }, (err, results) => {
                let brandRes = results['brandGet'];
                let literatureOne = results['literatureOne'][0];
                let time = sd.format(new Date(), "YYYY-MM-DD HH:mm:ss");
                res.render('editliterature', {currentTime: time, brandRes: brandRes,literatureOne:literatureOne, channel: 'literature'});
            });
            conn.release();
        });
    },
    /**
     * 删除文献
     * @param req
     * @param res
     */
    delete: (req, res) => {
        let pool = connPool().pool;
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }
            let literatureId = req.body.literature_id;
            let literatureSql = "DELETE FROM experiment WHERE id=?";
            conn.query(literatureSql, [literatureId], (err, rs) => {
                if (err) {
                    res.json({
                        res: false,
                        mes: "删除失败"
                    });
                    return;
                }
                res.json({
                    res: true,
                    mes: "删除成功"
                });
            });
            let deleteSql = "DELETE FROM itemMaterials WHERE experiment_id=?";
            conn.query(deleteSql, [literatureId], (err, rs) => {
                if (err) {
                    console.log(err.message);
                    return;
                }
            });
            conn.release();
        });
    },
    /**
     * 添加文献
     * @param req
     * @param res
     */
    add: (req, res) => {
        let data = req.body;
        let pool = connPool().pool;
        pool.getConnection((err, conn) => {
            if (err) {
                res.json({
                    res: false,
                    mes: "数据库连接错误"
                });
                return;
            }
            (() => {
                let deferred = Q.defer();
                let current_time = sd.format(new Date(), "YYYY-MM-DD HH:mm:ss");
                let addSql = "INSERT INTO experiment (experiment_name,author,issue_year,issue_time,magazine_name,address,experiment_result,experiment_method,summary,user_id,create_time) values (?,?,?,?,?,?,?,?,?,?,?)";
                conn.query(addSql, [data.experiment_name,data.author, data.issue_year, data.issue_time, data.magazine_name, data.address, data.experiment_result, data.experiment_method, data.summary, 1, current_time], (err, addRes) => {
                    if (err) {
                        deferred.reject(err);
                    } else {
                        deferred.resolve({
                            experiment_id: addRes.insertId
                        });
                    }
                });
                return deferred.promise.nodeify(null);
            })().then((addRes) => {
                let addData = [];
                for (let index = 0; index < data.itemId.length; index++) {
                    var itemId = data.itemId[index] == '' ? 0 : data.itemId[index];
                    addData.push([itemId, addRes.experiment_id, data.materials[index]]);
                }
                let addSql = "INSERT INTO itemMaterials (item_id,experiment_id,material_name) VALUES ?";
                conn.query(addSql, [addData], (err, addRes) => {
                    if (err) {
                        res.json({
                            res: false,
                            mes: err.message
                        });
                        return;
                    }
                    res.json({
                        res: true,
                        mes: '添加成功'
                    })
                })
            }).catch((err) => {
                res.json({
                    res: false,
                    mes: err.message
                })
            });
            conn.release();
        })
    },
    /**
     * 修改文献名称
     * @param req
     * @param res
     */
    modifyName: (req, res) => {
        let pool = connPool().pool;
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }
            let experimentName = req.body.experimentName;
            let experimentId = req.body.experimentId;
            let modifySql = "UPDATE experiment SET experiment_name=? WHERE id=?";
            conn.query(modifySql, [experimentName, experimentId], (err, rs) => {
                if (err) {
                    res.json({
                        res: false,
                        mes: err.message
                    });
                    return;
                }
                res.json({
                    res: true,
                    mes: '修改成功'
                });
            });
            conn.release();
        });
    }
    
};