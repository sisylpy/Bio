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

   
    /**
     * 添加经销商
     * @param req
     * @param res
     */
    addAgency: (req, res) => {
        var pool = connPool().pool;
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }
            var agencyName = req.body.agency_name;
            var agencyStatus = req.body.agency_status;
            // 首先判断经销商名称是否重复
            let checkMulti = "SELECT count(*) count FROM agency WHERE agencyName=?";
            conn.query(checkMulti, [agencyName], (err, checkRes) => {
                if (err) {
                    res.json({
                        res: false,
                        msg: err.message,
                    });
                    return;
                }
                if (checkRes[0].count > 0) {
                    res.json({
                        res: false,
                        msg: "品牌名称已经存在，不能添加！",
                    });
                    return;
                } else {
                    let addAgencySql = "INSERT INTO agency (agencyName,agencyStatus) values(?,?)";
                    conn.query(addAgencySql, [agencyName, agencyStatus], (err, rs) => {
                        if (err) {
                            res.json({
                                res: false,
                                msg: err.message
                            })
                            return;
                        }
                        res.json({
                            res: true,
                            msg: '添加成功'
                        });
                    });
                }
            });
            conn.release();
        });
    },
   
    /**
     * 修改经销商名称
     * @param req
     * @param res
     */
    modify: (req, res) => {
        var pool = connPool().pool;
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }
            var agencyName = req.body.agency_name;
            var agencyStatus = req.body.agency_status;
            var agencyId = req.body.agency_id;
            var agencySql = "UPDATE agency SET agencyName=?,agencyStatus=? WHERE id=?";
            conn.query(agencySql, [agencyName, agencyStatus, agencyId], (err, rs) => {
                if (err) {
                    res.json({
                        res: false,
                        msg: err.message
                    })
                    return;
                }
                res.json({
                    res: true,
                    msg: '修改成功'
                });
            });
            conn.release();
        });
    },

    /**
     * 删除经销商
     * @param req
     * @param res
     */
    delete: (req, res) => {
        var pool = connPool().pool;
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }
            var agencyId = req.body.agency_id;
            var deleteSql = "DELETE FROM agency WHERE id=?";
            conn.query(deleteSql, [agencyId], (err, rs) => {
                if (err) {
                    res.json({
                        res: false,
                        msg: err.message
                    })
                    return;
                }
                res.json({
                    res: true,
                    msg: '删除成功'
                });
            });
            conn.release();
        });
    },

    /**
     * 导入商品和试用品Excel
     * @param req
     * @Param res
     */
    importExcel: (req, res, webUrl, storagePage) => {
        let data = req.body;
        let file = req.file;
        let nameToKey = {
            '品牌': 'manufacturer_name',
            '货号': 'item_name',
            '货品名称': 'goods_name',
            '货品规格': 'goods_standard',
            '试用数量': 'sample_amount',
            '库存数量': 'stock',
            '单位': 'unit',
            '目录价': 'manufactur_price',
            '销售价': 'sale_price',
            '经销商': 'agency',
            '销售区域': 'sales_area',
            '联系人': 'person_name',
            '联系电话': 'person_phone'
        };
        const workSheetsFromFile = EXCELParser.parse(file.path);
        var excelData = [];
        for (var sheet in workSheetsFromFile) {
            if (workSheetsFromFile.hasOwnProperty(sheet)) { // sheet is '0', '1', ...
                excelData[sheet] = [];
                var sheetData = workSheetsFromFile[sheet].data; // data inside a sheet, which is an two-dimention array
                var rowCount = sheetData.length;
                var keyName = sheetData[0];  // 表头
                var keys = [];  // 存储表头对应的key
                // 转换表头名称为实际key
                for (var index = 0; index < keyName.length; index++) {
                    keys.push(nameToKey[keyName[index]]);
                }
                for (var i = 1; i < rowCount; i++) {
                    var rowData = sheetData[i]; // data inside one row, which is an one-dimention array
                    var columnCount = rowData.length;
                    for (var j = 0; j < columnCount; j++) {
                        if (excelData[sheet][keys[j]] == undefined) {
                            excelData[sheet][keys[j]] = [];
                        }
                        excelData[sheet][keys[j]].push(rowData[j].toString()); // data in j column of the given row
                    }
                }
            }
        }
        // 首先获取货号对应的id 和 经销商对应的id
        let item = excelData[0]['item_name'];
        let agency = excelData[0]['agency'];
        item = Array.from(new Set(item));  // 去重
        agency = Array.from(new Set(agency));// 去重
        let itemIn = "'" + item.join("','") + "'";
        let agencyIn = "'" + agency.join("','") + "'";
        let pool = connPool().pool;
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }
            async.series({
                getItem: (callback) => {
                    let itemSql = "SELECT id,item_name FROM item WHERE item_name IN (" + itemIn + ")";
                    conn.query(itemSql, (err, itemRs) => {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        callback(null, itemRs);
                    })
                },
                getAgency: (callback) => {
                    let agencySql = "SELECT id,agencyName FROM agency WHERE agencyName IN (" + agencyIn + ")";
                    conn.query(agencySql, (err, agencyRs) => {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        callback(null, agencyRs);
                    })
                }
            }, (err, results) => {
                // 首先删除原先的商品  和用户申请的试用品
                let deleteSqls = 'DELETE FROM itemGoods WHERE type_id=' + data.type_id;
                /*let deleteSqls =
                    'DELETE FROM itemGoods;'+
                    'DELETE FROM itemApply';*/
                conn.query(deleteSqls, (err, deleteRes) => {
                    if (err) {
                        res.json({
                            res: false,
                            mes: err.message
                        });
                        return;
                    }
                    let type_id = data.type_id;
                    let itemRes = results['getItem'];
                    let agencyRes = results['getAgency'];
                    let buildItem = [];
                    let buildAgency = [];
                    itemRes.forEach((item) => {
                        buildItem[item.item_name] = item.id;
                    });
                    agencyRes.forEach((agency) => {
                        buildAgency[agency.agencyName] = agency.id;
                    });
                    // 插入商品  首先构造商品数据结构
                    let dataLength = excelData[0]['item_name'].length; // 获取长度
                    let addData = [];
                    let current_time = sd.format(new Date(), "YYYY-MM-DD HH:mm:ss");
                    for (let index = 0; index < dataLength; index++) {
                        addData.push([
                            buildAgency[excelData[0]['agency'][index]] ? buildAgency[excelData[0]['agency'][index]] : 0,
                            buildItem[excelData[0]['item_name'][index]] ? buildItem[excelData[0]['item_name'][index]] : 0,
                            excelData[0]['manufacturer_name'][index],
                            excelData[0]['goods_name'][index],
                            data.type_id == 0 ? excelData[0]['goods_standard'][index] : '',
                            data.type_id == 0 ? (excelData[0]['stock'][index] == undefined ? 0 : excelData[0]['stock'][index]) : 0,
                            data.type_id == 0 ? excelData[0]['unit'][index] : '',
                            data.type_id == 0 ? excelData[0]['manufactur_price'][index] : 0,
                            data.type_id == 0 ? excelData[0]['sale_price'][index] : 0,
                            excelData[0]['sales_area'][index],
                            excelData[0]['person_name'][index],
                            excelData[0]['person_phone'][index],
                            current_time,
                            data.type_id,
                            data.type_id == 1 ? (excelData[0]['sample_amount'][index] == undefined ? 0 : excelData[0]['sample_amount'][index]) : 0
                            // data.type_id == 1 ? excelData[0]['sample_amount'][index] : 0
                        ])
                    }
                    let addSql = "INSERT INTO itemGoods(agency_id,item_id,manufacturer_name,goods_name,goods_standard,stock,unit,manufactur_price,sale_price,sales_area,person_name,person_phone,update_time,type_id,sample_amount) VALUES ?";
                    conn.query(addSql, [addData], (err, rs) => {
                        if (err) {
                            console.log(err.message);
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
                });
            });
            conn.release();
        })
    },

    
    
    
    
//========== 以下no use



    /** no use
     * 显示经销商
     * @param
     */
    // showProduct: (req, res) => {
    //     var pool = connPool().pool;
    //     // 从pool中获取连接(异步,取到后回调)
    //     pool.getConnection((err, conn) => {
    //         if (err) {
    //             res.send("获取连接错误,错误原因:" + err.message);
    //             return;
    //         }
    //         let agencyId = req.query.agency_id == undefined ? 0 : req.query.agency_id;
    //         let currentPage = req.query['current_page'] ? req.query['current_page'] : 1;
    //         let order = req.query['order'] ? req.query['order'] : 'asc';
    //         async.series({
    //             agencyGet: (callback) => {
    //                 let getSql = 'SELECT id,agencyName,agencyStatus FROM agency';
    //                 conn.query(getSql, function (err, rs) {
    //                     if (err) {
    //                         res.send("数据库查询错误。" + err.message);
    //                         return;
    //                     }
    //                     callback(null, rs)
    //                     // conn.release();
    //                 })
    //             },
    //             productsGet: (callback) => {
    //                 // 查看该经销商的状态
    //                 let agencyStatusSql = "SELECT agencyStatus FROM agency WHERE id=?";
    //                 conn.query(agencyStatusSql, [agencyId], (err, checkRes) => {
    //                     if (err) {
    //                         res.send("数据库查询错误。" + err.message);
    //                         return;
    //                     }
    //                     if (checkRes[0] != undefined && checkRes[0].agencyStatus == 'Y') {
    //                         let productSql = 'SELECT ig.id,im.item_name,manufacturer_name,item_id,goods_name,goods_standard,stock,update_time FROM itemGoods ig' +
    //                             ' LEFT JOIN item im ON im.id=ig.item_id WHERE agency_id =' + agencyId + ' and type_id=0 ORDER BY goods_name ' + order + ' LIMIT ' + (currentPage - 1) * Common.everyPage + ',' + Common.everyPage;
    //                         conn.query(productSql, (err, rs) => {
    //                             if (err) {
    //                                 res.send("数据库查询错误。" + err.message);
    //                                 return;
    //                             }
    //                             callback(null, rs)
    //                         })
    //                     } else {
    //                         callback(null, []);
    //                     }
    //                 });
    //
    //             },
    //             trailProductsGet: (callback) => {
    //                 // 查看该经销商的状态
    //                 let agencyStatusSql = "SELECT agencyStatus FROM agency WHERE id=? ";
    //                 conn.query(agencyStatusSql, [agencyId], (err, checkRes) => {
    //                     if (err) {
    //                         res.send("数据库查询错误。" + err.message);
    //                         return;
    //                     }
    //                     if (checkRes[0] != undefined && checkRes[0].agencyStatus == 'Y') {
    //                         let productSql = 'SELECT ig.id,im.item_name,manufacturer_name,item_id,goods_name,goods_standard,stock,sample_amount,update_time FROM itemGoods ig' +
    //                             ' LEFT JOIN item im ON im.id=ig.item_id WHERE agency_id =' + agencyId + ' and type_id=1 ORDER BY goods_name ' + order + ' LIMIT ' + (currentPage - 1) * Common.everyPage + ',' + Common.everyPage;
    //                         conn.query(productSql, function (err, rs) {
    //                             if (err) {
    //                                 res.send("数据库查询错误。" + err.message);
    //                                 return;
    //                             }
    //                             callback(null, rs)
    //                             // conn.release();
    //                         })
    //                     } else {
    //                         callback(null, []);
    //                     }
    //                 });
    //             },
    //             productCount: (callback) => {
    //                 let agencyStatusSql = "SELECT agencyStatus FROM agency WHERE id=? ";
    //                 conn.query(agencyStatusSql, [agencyId], (err, checkRes) => {
    //                     if (err) {
    //                         res.send("数据库查询错误。" + err.message);
    //                         return;
    //                     }
    //                     if (checkRes[0] != undefined && checkRes[0].agencyStatus == 'Y') {
    //                         let productSql = 'SELECT count(ig.id) count FROM itemGoods ig' +
    //                             ' LEFT JOIN item im ON im.id=ig.item_id WHERE agency_id =' + agencyId + ' and type_id=0';
    //                         conn.query(productSql, function (err, rs) {
    //                             if (err) {
    //                                 res.send("数据库查询错误。" + err.message);
    //                                 return;
    //                             }
    //                             callback(null, rs)
    //                             // conn.release();
    //                         })
    //                     } else {
    //                         callback(null, [{count: 0}]);
    //                     }
    //                 });
    //             },
    //             trailProductCount: (callback) => {
    //                 let agencyStatusSql = "SELECT agencyStatus FROM agency WHERE id=? ";
    //                 conn.query(agencyStatusSql, [agencyId], (err, checkRes) => {
    //                     if (err) {
    //                         res.send("数据库查询错误。" + err.message);
    //                         return;
    //                     }
    //                     if (checkRes[0] != undefined && checkRes[0].agencyStatus == 'Y') {
    //                         let productSql = 'SELECT count(ig.id) count FROM itemGoods ig' +
    //                             ' LEFT JOIN item im ON im.id=ig.item_id WHERE agency_id =' + agencyId + ' and type_id=1';
    //                         conn.query(productSql, function (err, rs) {
    //                             if (err) {
    //                                 res.send("数据库查询错误。" + err.message);
    //                                 return;
    //                             }
    //                             callback(null, rs)
    //                             // conn.release();
    //                         })
    //                     } else {
    //                         callback(null, [{count: 0}]);
    //                     }
    //                 });
    //             }
    //         }, (err, results) => {
    //             var type = req.query.type == undefined ? 0 : req.query.type;
    //             var agencyRes = results['agencyGet'];
    //             var productsRes = type == 0 ? results['productsGet'] : [];
    //             var trailProductsRes = type == 1 ? results['trailProductsGet'] : [];
    //             let productCount = type == 0 ? results['productCount'][0].count : 0;
    //             let trailProductCount = type == 1 ? results['trailProductCount'][0].count : 0;
    //             let pageList = [];
    //             let length = type == 0 ? productCount : trailProductCount;
    //             for (let index = 0; index < Math.ceil(length / Common.everyPage); index++) {
    //                 pageList.push(index + 1);
    //             }
    //             let totalPage = pageList[pageList.length - 1];
    //             pageList = Common.getPageList(currentPage, pageList);  // 获取显示的列表码
    //             res.render('product', {
    //                 agencyRes: agencyRes,
    //                 productsRes: productsRes,
    //                 trailProductsRes: trailProductsRes,
    //                 pageList: pageList,
    //                 currentPage: currentPage,
    //                 totalPage: totalPage,
    //                 type: type,
    //                 channel: 'product'
    //             });
    //         });
    //         conn.release();
    //     });
    // },
    /**
     * no use
     * @param
     */
    // show: (req, res) => {
    //     let pool = connPool().pool;
    //     pool.getConnection((err, conn) => {
    //         if (err) {
    //             res.send("获取连接错误,错误原因:" + err.message);
    //             return;
    //         }
    //         let agencySql = 'SELECT id,agencyName,agencyStatus FROM agency';
    //         conn.query(agencySql, function (err, rs) {
    //             if (err) {
    //                 res.send("数据库查询错误。" + err.message);
    //                 return;
    //             }
    //             res.render('agency', {
    //                 agencyRes: rs,
    //                 channel: 'agency'
    //             });
    //             // conn.release();
    //         });
    //         conn.release();
    //     });
    // },

    /** no use
     * 搜索经销商
     * @param req
     * @param res
     */
    // searchAgency: (req, res) => {
    //     var pool = connPool().pool;
    //     pool.getConnection((err, conn) => {
    //         if (err) {
    //             res.send("获取连接错误,错误原因:" + err.message);
    //             return;
    //         }
    //         var agencyName = req.query['agency_name'];
    //         var agencySql = "SELECT id,agencyName,agencyStatus FROM agency WHERE agencyName like '%" + agencyName + "%'";
    //         conn.query(agencySql, (err, rs) => {
    //             if (err) {
    //                 res.send("数据库查询错误。" + err.message);
    //                 return;
    //             }
    //             var productsRes = [];
    //             var trailProductsRes = [];
    //             res.render('agency', {
    //                 agencyRes: rs,
    //                 productsRes: productsRes,
    //                 trailProductsRes: trailProductsRes,
    //                 type: 0
    //             });
    //         });
    //         conn.release();
    //     });
    // },

    /** no use!
     * 修改商品名称
     * @param req
     * @param res
     */
    // modifyProductName: (req, res) => {
    //     var pool = connPool().pool;
    //     pool.getConnection((err, conn) => {
    //         if (err) {
    //             res.send("获取连接错误,错误原因:" + err.message);
    //             return;
    //         }
    //         var goodsName = req.body.product_name;
    //         var goodsId = req.body.product_id;
    //         var goodsSql = "UPDATE itemGoods SET goods_name=? WHERE id=?";
    //         conn.query(goodsSql, [goodsName, goodsId], (err, rs) => {
    //             if (err) {
    //                 res.json({
    //                     res: false
    //                 })
    //                 return;
    //             }
    //             res.json({
    //                 res: true
    //             });
    //         });
    //         conn.release();
    //     });
    // },


    /** no use!
     * 修改pdf名称
     * @param req
     * @param res
     */
    // modifyPdfName: (req, res) => {
    //     let pool = connPool().pool;
    //     pool.getConnection((err, conn) => {
    //         if (err) {
    //             res.send("获取连接错误,错误原因:" + err.message);
    //             return;
    //         }
    //         let pdfName = req.body.pdf_name;
    //         let pdfId = req.body.pdf_id;
    //         let pdfSql = "UPDATE pdf SET pdf_name=? WHERE id=?";
    //         conn.query(pdfSql, [pdfName, pdfId], (err, rs) => {
    //             if (err) {
    //                 res.json({
    //                     res: false
    //                 })
    //                 return;
    //             }
    //             res.json({
    //                 res: true
    //             });
    //         });
    //         conn.release();
    //     });
    // },

    /** no use!
     * 删除商品/试用品
     * @param req
     * @param res
     */
    // deleteProduct: (req, res) => {
    //     let pool = connPool().pool;
    //     pool.getConnection((err, conn) => {
    //         if (err) {
    //             res.send("获取连接错误,错误原因:" + err.message);
    //             return;
    //         }
    //         let productId = req.body.product_id;
    //         let productSql = "DELETE FROM itemGoods WHERE id=?";
    //         conn.query(productSql, [productId], (err, rs) => {
    //             if (err) {
    //                 res.json({
    //                     res: false,
    //                     mes: "删除失败"
    //                 });
    //                 return;
    //             }
    //             res.json({
    //                 res: true,
    //                 mes: "删除成功"
    //             });
    //         });
    //         conn.release();
    //     });
    // }
};