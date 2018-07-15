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
     * 显示视频列表
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
                videoGet: (callback) => {
                    let videoSql = 'SELECT id,video_name,create_time,star,show_times,video_path,file_type,play_time FROM video ORDER BY video_name '+order+' LIMIT '+(currentPage-1)*Common.everyPage+','+Common.everyPage;
                    conn.query(videoSql, function (err, rs) {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        // conn.release();
                        async.map(rs,(video,call)=>{
                            let getItemSql = 'SELECT item_name FROM item i' +
                                ' JOIN itemVideo iv ON iv.item_id=i.id' +
                                ' WHERE video_id = '+video.id;
                            conn.query(getItemSql,(err,itemRs)=>{
                                if (err) {
                                    res.send("数据库查询错误。" + err.message);
                                    return;
                                }
                                itemRs.forEach((item)=>{
                                    if(video['item_name'] == undefined){
                                        video['item_name'] = '';
                                    }
                                    if(video['item_name'] != ''){
                                        video['item_name'] += ' ';
                                    }
                                    video['item_name'] += item.item_name;
                                })
                                call(null,rs);
                            });
                        },(err,result)=>{
                            callback(null,rs);
                        });
                    })
                },
                videoCount:(callback)=>{
                    let countSql = "SELECT count(id) count FROM video";
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
                let videoRes = results['videoGet'];
                let videoCount = results['videoCount'][0].count;
                let pageList = [];
                let length = videoCount;
                for(let index = 0; index<Math.ceil(length/Common.everyPage); index++){
                    pageList.push(index+1);
                }
                let totalPage = pageList[pageList.length-1];
                pageList = Common.getPageList(currentPage,pageList);  // 获取显示的列表码
                res.render('video', {videoRes: videoRes, pageList:pageList,
                    currentPage:currentPage,totalPage:totalPage, channel: 'video'});
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
                res.render('addvideo', {currentTime: time,brandRes: brandRes, channel: 'video'});
            });
            conn.release();
        });
    },
    /**
     * 删除视频
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
            let videoId = req.body.video_id;
            let videoSql = "DELETE FROM video WHERE id=?";
            conn.query(videoSql, [videoId], (err, rs) => {
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
            let deleteSql = "DELETE FROM itemVideo WHERE video_id=?";
            conn.query(deleteSql, [videoId], (err, rs) => {
                if (err) {
                    console.log(err.message);
                    return;
                }
            });
            conn.release();
        });
    },
    /**
     * 添加视频
     * @param req
     * @param res
     */
    add: (req, res, webUrl, storagePath) => {
        let data = req.body;
        let file = req.file;
        let videoOriginalName = file.originalname;
        let videoPath = storagePath + "/" + file.filename;
        let videoUrl = webUrl + "/" + file.filename;
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
                let addSql = "INSERT INTO video (video_name,star,show_times,video_url,video_path,file_type,play_time,create_time) values (?,?,?,?,?,?,?,?)";
                conn.query(addSql, [file.filename, 0, 0, videoUrl, videoPath, file.mimetype, 0, current_time], (err, addRes) => {
                  if (err) {
                        deferred.reject(err);
                    } else {
                     deferred.resolve({
                            video_id: addRes.insertId
                        });
                    }
                });
                return deferred.promise.nodeify(null);
            })().then((addRes) => {
                let addData = [];
                let itemIds = data.itemId.split(',');
                for (let index = 0; index < itemIds.length; index++) {
                    addData.push([itemIds[index], addRes.video_id]);
                }
                let addSql = "INSERT INTO itemVideo (item_id,video_id) VALUES ?"
                conn.query(addSql, [addData], (err, addRes) => {
                    if (err) {
                        res.json({
                            res: false,
                            mes: err.message
                        });
                        return;
                    }
                  console.log('1111addd');

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
     * 修改视频名称
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
            let videoName = req.body.videoName;
            let videoId = req.body.videoId;
            let modifySql = "UPDATE video SET video_name=? WHERE id=?";
            conn.query(modifySql, [videoName, videoId], (err, rs) => {
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