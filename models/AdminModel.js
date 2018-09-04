var connPool = require("./ConnPool");
var LoginBean = require("../jsBean/LoginBean");
var Promise = require('promise');
var async = require('async');
var CommonBean = require('../jsBean/CommonBean');
// var await = require('await');
var Q = require('q');
var PDFParser = require('pdf2json');
var PDFImage = require('pdf-image').PDFImage;
var sd = require('silly-datetime');
let Common = new CommonBean();

module.exports = {
    /**
     * 管理员登陆
     */
    adminLogin: (req, res) => {
        let pool = connPool().pool;
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }
            let param = [req.body['email'], req.body['pwd']];
            let adminLoginSql = "select uid from admin where email=? and pwd=?";

            console.log(req.body['email']);
            console.log(req.body['pwd']);
            console.log('-----------');

            conn.query(adminLoginSql, param, (err, rs) => {
                if (err) {
                    res.send("数据库查询错误。" + err.message);
                    return;
                }

                console.log(rs);
                console.log('+======');
                // if (rs.length == 0) {
                //     res.send("用户名/密码错误");
                // } else {
                //     res.redirect('/admin/brand');
                // }
                //

                if (rs.length > 0) {
                    loginbean = new LoginBean();
                    loginbean.uid = rs[0].uid;
                    loginbean.nicheng = rs[0].nicheng;
                    loginbean.socketId = rs[0].socketId;
                    req.session.loginbean = loginbean;
                    res.redirect('/admin/brand');
                } else {
                    res.send("用户名/密码错误");
                }
            });
            conn.release();
        });
    },

    /**
     * 操作手册
     */
    getPdfOri: (req, res) => {
        let pool = connPool().pool;
        // 从pool中获取连接(异步,取到后回调)
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }

            let brandId = req.query.brand_id == undefined ? 0 : req.query.brand_id;
            let currentPage = req.query['current_page'] ? req.query['current_page'] : 1;
            let order = req.query['order'] ? req.query['order'] : 'asc';
            async.series({

                // 品牌列表数据
                brandGet: (callback) => {
                    let brandSql = 'SELECT id,manuName FROM manufacturer ORDER BY manuName ASC';
                    conn.query(brandSql, function (err, rs) {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        callback(null, rs);
                        // conn.release();
                    })
                },
                // 选中品牌的货号
                itemGet: (callback) => {
                    let itemSql = 'SELECT im.id,item_name,manufacturer_id,manufacturer_sub_id,english_tag,english_tag,experiment_tag,video_tag,stock_tag,samples_tag,message_tag FROM item im' +
                        ' JOIN itemManufacturer imf ON im.id=imf.item_id' +
                        '  WHERE manufacturer_id =' + brandId + ' or manufacturer_sub_id=' + brandId + " ORDER BY item_name  " + order + " LIMIT " + (currentPage - 1) * Common.everyPage + ',' + Common.everyPage;
                    conn.query(itemSql, function (err, rs) {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        // 处理名称 如果该品牌是作为子品牌关联的货号在货号显示 (子品牌)货号
                        for (let index = 0; index < rs.length; index++) {
                            if (brandId == rs[index]['manufacturer_sub_id']) {
                                rs[index]['item_name'] = rs[index]['item_name'] + "（子品牌）";
                            }
                        }
                        // 提取出所有的货号id
                        let itemIds = [];
                        rs.forEach((item) => {
                            itemIds.push(item.id);
                        });
                        var itemIdIn = "'" + itemIds.join("','") + "'";
                        async.series({
                            getExperimentCount: (call) => {
                                let experimentCountSql = 'SELECT DISTINCT item_id,experiment_id FROM itemMaterials WHERE item_id in (' + itemIdIn + ')';
                                conn.query(experimentCountSql, (err, countRes) => {
                                    if (err) {
                                        res.send("数据库查询错误。" + err.message);
                                        return;
                                    }
                                    let itemExperimentCount = [];
                                    countRes.forEach((count) => {
                                        if (itemExperimentCount[count['item_id']] == undefined) {
                                            itemExperimentCount[count['item_id']] = 0;
                                        }
                                        itemExperimentCount[count['item_id']]++;
                                    });
                                    call(null, itemExperimentCount);
                                })
                            },
                            getVideoCount: (call) => {
                                let videoCountSql = 'SELECT DISTINCT item_id,video_id FROM itemVideo WHERE item_id in (' + itemIdIn + ')';
                                conn.query(videoCountSql, (err, countRes) => {
                                    if (err) {
                                        res.send("数据库查询错误。" + err.message);
                                        return;
                                    }
                                    let itemVideoCount = [];
                                    countRes.forEach((count) => {
                                        if (itemVideoCount[count['item_id']] == undefined) {
                                            itemVideoCount[count['item_id']] = 0;
                                        }
                                        itemVideoCount[count['item_id']]++;
                                    });
                                    call(null, itemVideoCount);
                                });
                            },
                            getAgencyCount: (call) => {
                                let agencyCountSql = 'SELECT DISTINCT item_id,agency_id FROM itemGoods WHERE item_id in (' + itemIdIn + ')';
                                conn.query(agencyCountSql, (ree, countRes) => {
                                    if (err) {
                                        res.send("数据库查询错误。" + err.message);
                                        return;
                                    }
                                    let itemAgencyCount = [];
                                    countRes.forEach((count) => {
                                        if (itemAgencyCount[count['item_id']] == undefined) {
                                            itemAgencyCount[count['item_id']] = 0;
                                        }
                                        itemAgencyCount[count['item_id']]++;
                                    });
                                    call(null, itemAgencyCount);
                                })
                            }
                        }, (err, results) => {
                            let experimentCountInfo = results['getExperimentCount'];
                            let videoCountInfo = results['getVideoCount'];
                            let agencyCountInfo = results['getAgencyCount'];
                            for (let index = 0; index < rs.length; index++) {
                                rs[index]['experiment_tag'] = experimentCountInfo[rs[index]['id']] ? experimentCountInfo[rs[index]['id']] : 0;
                                rs[index]['video_tag'] = videoCountInfo[rs[index]['id']] ? videoCountInfo[rs[index]['id']] : 0;
                                rs[index]['agency_tag'] = agencyCountInfo[rs[index]['id']] ? agencyCountInfo[rs[index]['id']] : 0;
                            }
                            callback(null, rs);
                        });
                        // conn.release();
                    })
                },
                pdfGet: (callback) => {
                    /*let itemSql = 'SELECT ' +
                        'i.item_name,p.id,language,pdf_name,pdf_path,download_num,print_num,collection_num,share_num,sub_pdf_id,txt' +
                        ' FROM pdf p JOIN itemPdf ipf ON ipf.pdf_id=p.id JOIN item i ON ipf.item_id=i.id' +
                        ' WHERE ipf.item_id in (SELECT item_id FROM itemManufacturer WHERE manufacturer_id=' + brandId + ' OR manufacturer_sub_id=' + brandId + ')' +
                        '  ORDER BY p.id  ASC LIMIT '+(currentPage-1)*Common.everyPage+','+Common.everyPage;*/
                    let itemSql = 'SELECT * FROM pdf WHERE id IN (SELECT' +
                        ' pdf_id FROM itemPdf  WHERE item_id IN ' +
                        '   (SELECT item_id FROM itemManufacturer WHERE manufacturer_id=' + brandId + ' OR manufacturer_sub_id=' + brandId + ')' +
                        ' ) ORDER BY pdf_name ' + order + ' LIMIT ' + (currentPage - 1) * Common.everyPage + ',' + Common.everyPage;
                    conn.query(itemSql, function (err, rs) {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        async.map(rs, (operation, call) => {
                            let getBrandSql = 'SELECT item_name FROM itemPdf ip' +
                                ' JOIN item i ON i.id=ip.item_id' +
                                ' JOIN itemManufacturer imf ON imf.item_id=ip.item_id' +
                                ' WHERE ip.pdf_id=' + operation.id;
                            conn.query(getBrandSql, (err, operationItemRs) => {
                                if (err) {
                                    res.send("数据库查询错误。" + err.message);
                                    return;
                                }
                                let operationItemInfo = [];
                                operationItemRs.forEach((item) => {
                                    if (operationItemInfo[operation.id] == undefined) {
                                        operation['item_name'] = "";
                                        operationItemInfo[operation.id] = [];
                                    }
                                    operation['item_name'] += " " + item.item_name;
                                });
                                call(null, operationItemRs);

                            })
                        }, (err, results) => {
                            callback(null, rs);
                        })
                    })
                },
                itemCount: (callback) => {
                    let countSql = 'SELECT count(im.id) count FROM item im' +
                        ' JOIN itemManufacturer imf ON im.id=imf.item_id' +
                        '  WHERE manufacturer_id =' + brandId + ' or manufacturer_sub_id=' + brandId;
                    conn.query(countSql, (err, rs) => {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        callback(null, rs);
                    })
                },
                pdfCount: (callback) => {
                    let countSql = 'SELECT count(id) count FROM pdf WHERE id IN (SELECT' +
                        ' pdf_id FROM itemPdf  WHERE item_id IN ' +
                        '   (SELECT item_id FROM itemManufacturer WHERE manufacturer_id=' + brandId + ' OR manufacturer_sub_id=' + brandId + ')' +
                        ' ) ';
                    conn.query(countSql, (err, rs) => {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        callback(null, rs);
                    })
                }
            }, (err, results) => {
                let type = req.query.type == undefined ? 0 : req.query.type;
                let brandRes = results['brandGet'];
                let itemRes = type == 0 ? results['itemGet'] : [];
                let pdfRes = type == 1 ? results['pdfGet'] : [];
                let itemCount = type == 0 ? results['itemCount'][0].count : 0;
                let pdfCount = type == 1 ? results['pdfCount'][0].count : 0;
                let pageList = [];
                let length = type == 0 ? itemCount : pdfCount;
                for (let index = 0; index < Math.ceil(length / Common.everyPage); index++) {
                    pageList.push(index + 1);
                }
                let totalPage = pageList[pageList.length - 1];
                pageList = Common.getPageList(currentPage, pageList);  // 获取显示的列表码

                res.render('pdf', {
                    brandRes: brandRes,
                    itemRes: itemRes,
                    pdfRes: pdfRes,
                    pageList: pageList,
                    currentPage: currentPage,
                    totalPage: totalPage,
                    type: type,
                    channel: 'handle'
                });
            });
            conn.release();
        });
    },

    getPdf0819: (req, res) => {
        let pool = connPool().pool;
        // 从pool中获取连接(异步,取到后回调)
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }
            let brandId = req.query.brand_id == undefined ? 0 : req.query.brand_id;
            let currentPage = req.query['current_page'] ? req.query['current_page'] : 1;
            let order = req.query['order'] ? req.query['order'] : 'asc';
            async.series({

                // 品牌列表数据
                brandGet: (callback) => {
                    let brandSql = 'SELECT id,manuName FROM manufacturer ORDER BY manuName ASC';
                    conn.query(brandSql, function (err, rs) {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        callback(null, rs);
                        // conn.release();
                    })
                },
                // 选中品牌的货号
                itemGet: (callback) => {
                    let itemSql = 'SELECT im.id,item_name,manufacturer_id,manufacturer_sub_id,english_tag,english_tag,experiment_tag,video_tag,stock_tag,samples_tag,message_tag FROM item im' +
                        ' JOIN itemManufacturer imf ON im.id=imf.item_id' +
                        '  WHERE manufacturer_id =' + brandId + ' or manufacturer_sub_id=' + brandId + " ORDER BY item_name  " + order + " LIMIT " + (currentPage - 1) * Common.everyPage + ',' + Common.everyPage;
                    conn.query(itemSql, function (err, rs) {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        // 处理名称 如果该品牌是作为子品牌关联的货号在货号显示 (子品牌)货号
                        for (let index = 0; index < rs.length; index++) {
                            if (brandId == rs[index]['manufacturer_sub_id']) {
                                rs[index]['item_name'] = rs[index]['item_name'] + "（子品牌）";
                            }
                        }
                        // 提取出所有的货号id
                        let itemIds = [];
                        rs.forEach((item) => {
                            itemIds.push(item.id);
                        });
                        var itemIdIn = "'" + itemIds.join("','") + "'";
                        async.series({
                            getExperimentCount: (call) => {
                                let experimentCountSql = 'SELECT DISTINCT item_id,experiment_id FROM itemMaterials WHERE item_id in (' + itemIdIn + ')';
                                conn.query(experimentCountSql, (err, countRes) => {
                                    if (err) {
                                        res.send("数据库查询错误。" + err.message);
                                        return;
                                    }
                                    let itemExperimentCount = [];
                                    countRes.forEach((count) => {
                                        if (itemExperimentCount[count['item_id']] == undefined) {
                                            itemExperimentCount[count['item_id']] = 0;
                                        }
                                        itemExperimentCount[count['item_id']]++;
                                    });
                                    call(null, itemExperimentCount);
                                })
                            },
                            getVideoCount: (call) => {
                                let videoCountSql = 'SELECT DISTINCT item_id,video_id FROM itemVideo WHERE item_id in (' + itemIdIn + ')';
                                conn.query(videoCountSql, (err, countRes) => {
                                    if (err) {
                                        res.send("数据库查询错误。" + err.message);
                                        return;
                                    }
                                    let itemVideoCount = [];
                                    countRes.forEach((count) => {
                                        if (itemVideoCount[count['item_id']] == undefined) {
                                            itemVideoCount[count['item_id']] = 0;
                                        }
                                        itemVideoCount[count['item_id']]++;
                                    });
                                    call(null, itemVideoCount);
                                });
                            },
                            getAgencyCount: (call) => {
                                let agencyCountSql = 'SELECT DISTINCT item_id,agency_id FROM itemGoods WHERE item_id in (' + itemIdIn + ')';
                                conn.query(agencyCountSql, (ree, countRes) => {
                                    if (err) {
                                        res.send("数据库查询错误。" + err.message);
                                        return;
                                    }
                                    let itemAgencyCount = [];
                                    countRes.forEach((count) => {
                                        if (itemAgencyCount[count['item_id']] == undefined) {
                                            itemAgencyCount[count['item_id']] = 0;
                                        }
                                        itemAgencyCount[count['item_id']]++;
                                    });
                                    call(null, itemAgencyCount);
                                })
                            }
                        }, (err, results) => {
                            let experimentCountInfo = results['getExperimentCount'];
                            let videoCountInfo = results['getVideoCount'];
                            let agencyCountInfo = results['getAgencyCount'];
                            for (let index = 0; index < rs.length; index++) {
                                rs[index]['experiment_tag'] = experimentCountInfo[rs[index]['id']] ? experimentCountInfo[rs[index]['id']] : 0;
                                rs[index]['video_tag'] = videoCountInfo[rs[index]['id']] ? videoCountInfo[rs[index]['id']] : 0;
                                rs[index]['agency_tag'] = agencyCountInfo[rs[index]['id']] ? agencyCountInfo[rs[index]['id']] : 0;
                            }
                            callback(null, rs);
                        });
                        // conn.release();
                    })
                },
                pdfGet: (callback) => {
                    /*let itemSql = 'SELECT ' +
                        'i.item_name,p.id,language,pdf_name,pdf_path,download_num,print_num,collection_num,share_num,sub_pdf_id,txt' +
                        ' FROM pdf p JOIN itemPdf ipf ON ipf.pdf_id=p.id JOIN item i ON ipf.item_id=i.id' +
                        ' WHERE ipf.item_id in (SELECT item_id FROM itemManufacturer WHERE manufacturer_id=' + brandId + ' OR manufacturer_sub_id=' + brandId + ')' +
                        '  ORDER BY p.id  ASC LIMIT '+(currentPage-1)*Common.everyPage+','+Common.everyPage;*/
                    let itemSql = 'SELECT * FROM pdf WHERE id IN (SELECT' +
                        ' pdf_id FROM itemPdf  WHERE item_id IN ' +
                        '   (SELECT item_id FROM itemManufacturer WHERE manufacturer_id=' + brandId + ' OR manufacturer_sub_id=' + brandId + ')' +
                        ' ) ORDER BY pdf_name ' + order + ' LIMIT ' + (currentPage - 1) * Common.everyPage + ',' + Common.everyPage;
                    conn.query(itemSql, function (err, rs) {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        async.map(rs, (operation, call) => {
                            let getBrandSql = 'SELECT item_name FROM itemPdf ip' +
                                ' JOIN item i ON i.id=ip.item_id' +
                                ' JOIN itemManufacturer imf ON imf.item_id=ip.item_id' +
                                ' WHERE ip.pdf_id=' + operation.id;
                            conn.query(getBrandSql, (err, operationItemRs) => {
                                if (err) {
                                    res.send("数据库查询错误。" + err.message);
                                    return;
                                }
                                let operationItemInfo = [];
                                operationItemRs.forEach((item) => {
                                    if (operationItemInfo[operation.id] == undefined) {
                                        operation['item_name'] = "";
                                        operationItemInfo[operation.id] = [];
                                    }
                                    operation['item_name'] += " " + item.item_name;
                                });
                                call(null, operationItemRs);

                            })
                        }, (err, results) => {
                            callback(null, rs);
                        })
                    })
                },
                itemCount: (callback) => {
                    let countSql = 'SELECT count(im.id) count FROM item im' +
                        ' JOIN itemManufacturer imf ON im.id=imf.item_id' +
                        '  WHERE manufacturer_id =' + brandId + ' or manufacturer_sub_id=' + brandId;
                    conn.query(countSql, (err, rs) => {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        callback(null, rs);
                    })
                },
                pdfCount: (callback) => {
                    let countSql = 'SELECT count(id) count FROM pdf WHERE id IN (SELECT' +
                        ' pdf_id FROM itemPdf  WHERE item_id IN ' +
                        '   (SELECT item_id FROM itemManufacturer WHERE manufacturer_id=' + brandId + ' OR manufacturer_sub_id=' + brandId + ')' +
                        ' ) ';
                    conn.query(countSql, (err, rs) => {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        callback(null, rs);
                    })
                }
            }, (err, results) => {
                let type = req.query.type == undefined ? 0 : req.query.type;
                let brandRes = results['brandGet'];
                let itemRes = type == 0 ? results['itemGet'] : [];
                let pdfRes = type == 1 ? results['pdfGet'] : [];
                let itemCount = type == 0 ? results['itemCount'][0].count : 0;
                let pdfCount = type == 1 ? results['pdfCount'][0].count : 0;
                let pageList = [];
                let length = type == 0 ? itemCount : pdfCount;
                for (let index = 0; index < Math.ceil(length / Common.everyPage); index++) {
                    pageList.push(index + 1);
                }
                let totalPage = pageList[pageList.length - 1];
                pageList = Common.getPageList(currentPage, pageList);  // 获取显示的列表码

                console.log(pdfRes);
                console.log('pdfRes');
                res.render('pdf', {
                    brandRes: brandRes,
                    itemRes: itemRes,
                    pdfRes: pdfRes,
                    pageList: pageList,
                    currentPage: currentPage,
                    totalPage: totalPage,
                    type: type,
                    channel: 'handle'
                });
            });
            conn.release();
        });
    },

    getPdf: (req, res) => {
        let pool = connPool().pool;
        // 从pool中获取连接(异步,取到后回调)
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }
            let brandId = req.query.brand_id == undefined ? 0 : req.query.brand_id;
            let currentPage = req.query['current_page'] ? req.query['current_page'] : 1;
            let order = req.query['order'] ? req.query['order'] : 'asc';



            async.series({

                // 品牌列表数据
                brandGet: (callback) => {
                    let brandSql = 'SELECT id,manuName FROM manufacturer ORDER BY manuName ASC';
                    conn.query(brandSql, function (err, rs) {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        callback(null, rs);
                        // conn.release();
                    })
                },

                // 选中品牌的货号
                itemGet: (callback) => {
                    let itemSql = 'SELECT im.id,item_name,manufacturer_id,manufacturer_sub_id,english_tag,english_tag,experiment_tag,video_tag,stock_tag,samples_tag,message_tag FROM item im' +
                        ' JOIN itemManufacturer imf ON im.id=imf.item_id' +
                        '  WHERE manufacturer_id =' + brandId + ' or manufacturer_sub_id=' + brandId + " ORDER BY item_name  " + order + " LIMIT " + (currentPage - 1) * Common.everyPage + ',' + Common.everyPage;
                    conn.query(itemSql, function (err, rs) {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        // 处理名称 如果该品牌是作为子品牌关联的货号在货号显示 (子品牌)货号
                        for (let index = 0; index < rs.length; index++) {
                            if (brandId == rs[index]['manufacturer_sub_id']) {
                                rs[index]['item_name'] = rs[index]['item_name'] + "（子品牌）";
                            }
                        }
                        // 提取出所有的货号id
                        let itemIds = [];
                        rs.forEach((item) => {
                            itemIds.push(item.id);
                        });
                        var itemIdIn = "'" + itemIds.join("','") + "'";
                        async.series({
                            getExperimentCount: (call) => {
                                let experimentCountSql = 'SELECT DISTINCT item_id,experiment_id FROM itemMaterials WHERE item_id in (' + itemIdIn + ')';
                                conn.query(experimentCountSql, (err, countRes) => {
                                    if (err) {
                                        res.send("数据库查询错误。" + err.message);
                                        return;
                                    }
                                    let itemExperimentCount = [];
                                    countRes.forEach((count) => {
                                        if (itemExperimentCount[count['item_id']] == undefined) {
                                            itemExperimentCount[count['item_id']] = 0;
                                        }
                                        itemExperimentCount[count['item_id']]++;
                                    });
                                    call(null, itemExperimentCount);
                                })
                            },
                            getVideoCount: (call) => {
                                let videoCountSql = 'SELECT DISTINCT item_id,video_id FROM itemVideo WHERE item_id in (' + itemIdIn + ')';
                                conn.query(videoCountSql, (err, countRes) => {
                                    if (err) {
                                        res.send("数据库查询错误。" + err.message);
                                        return;
                                    }
                                    let itemVideoCount = [];
                                    countRes.forEach((count) => {
                                        if (itemVideoCount[count['item_id']] == undefined) {
                                            itemVideoCount[count['item_id']] = 0;
                                        }
                                        itemVideoCount[count['item_id']]++;
                                    });
                                    call(null, itemVideoCount);
                                });
                            },
                            getAgencyCount: (call) => {
                                let agencyCountSql = 'SELECT DISTINCT item_id,agency_id FROM itemGoods WHERE item_id in (' + itemIdIn + ')';
                                conn.query(agencyCountSql, (ree, countRes) => {
                                    if (err) {
                                        res.send("数据库查询错误。" + err.message);
                                        return;
                                    }
                                    let itemAgencyCount = [];
                                    countRes.forEach((count) => {
                                        if (itemAgencyCount[count['item_id']] == undefined) {
                                            itemAgencyCount[count['item_id']] = 0;
                                        }
                                        itemAgencyCount[count['item_id']]++;
                                    });
                                    call(null, itemAgencyCount);
                                })
                            }
                        }, (err, results) => {
                            let experimentCountInfo = results['getExperimentCount'];
                            let videoCountInfo = results['getVideoCount'];
                            let agencyCountInfo = results['getAgencyCount'];
                            for (let index = 0; index < rs.length; index++) {
                                rs[index]['experiment_tag'] = experimentCountInfo[rs[index]['id']] ? experimentCountInfo[rs[index]['id']] : 0;
                                rs[index]['video_tag'] = videoCountInfo[rs[index]['id']] ? videoCountInfo[rs[index]['id']] : 0;
                                rs[index]['agency_tag'] = agencyCountInfo[rs[index]['id']] ? agencyCountInfo[rs[index]['id']] : 0;
                            }
                            callback(null, rs);
                        });
                        // conn.release();
                    })
                },

                pdfGet: (callback) => {
                    /*let itemSql = 'SELECT ' +
                        'i.item_name,p.id,language,pdf_name,pdf_path,download_num,print_num,collection_num,share_num,sub_pdf_id,txt' +
                        ' FROM pdf p JOIN itemPdf ipf ON ipf.pdf_id=p.id JOIN item i ON ipf.item_id=i.id' +
                        ' WHERE ipf.item_id in (SELECT item_id FROM itemManufacturer WHERE manufacturer_id=' + brandId + ' OR manufacturer_sub_id=' + brandId + ')' +
                        '  ORDER BY p.id  ASC LIMIT '+(currentPage-1)*Common.everyPage+','+Common.everyPage;*/

                    console.log(brandId);
                    console.log('========');

                    let itemSql = 'SELECT * FROM pdf WHERE id IN (SELECT' +
                        ' pdf_id FROM itemPdf  WHERE item_id IN ' +
                        '   (SELECT item_id FROM itemManufacturer WHERE manufacturer_id=' + brandId + ' OR manufacturer_sub_id=' + brandId + ')' +
                        ' ) ORDER BY pdf_name ' + order + ' LIMIT ' + (currentPage - 1) * Common.everyPage + ',' + Common.everyPage;
                    conn.query(itemSql, function (err, rs) {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        async.map(rs, (operation, call) => {
                            let getBrandSql = 'SELECT item_name FROM itemPdf ip' +
                                ' JOIN item i ON i.id=ip.item_id' +
                                ' JOIN itemManufacturer imf ON imf.item_id=ip.item_id' +
                                ' WHERE ip.pdf_id=' + operation.id;
                            conn.query(getBrandSql, (err, operationItemRs) => {
                                if (err) {
                                    res.send("数据库查询错误。" + err.message);
                                    return;
                                }
                                let operationItemInfo = [];
                                operationItemRs.forEach((item) => {
                                    if (operationItemInfo[operation.id] == undefined) {
                                        operation['item_name'] = "";
                                        operationItemInfo[operation.id] = [];
                                    }
                                    operation['item_name'] += " " + item.item_name;
                                });
                                call(null, operationItemRs);

                            })
                        }, (err, results) => {
                            callback(null, rs);
                        })
                    })
                },
                itemCount: (callback) => {
                    let countSql = 'SELECT count(im.id) count FROM item im' +
                        ' JOIN itemManufacturer imf ON im.id=imf.item_id' +
                        '  WHERE manufacturer_id =' + brandId + ' or manufacturer_sub_id=' + brandId;
                    conn.query(countSql, (err, rs) => {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        callback(null, rs);
                    })
                },
                pdfCount: (callback) => {
                    let countSql = 'SELECT count(id) count FROM pdf WHERE id IN (SELECT' +
                        ' pdf_id FROM itemPdf  WHERE item_id IN ' +
                        '   (SELECT item_id FROM itemManufacturer WHERE manufacturer_id=' + brandId + ' OR manufacturer_sub_id=' + brandId + ')' +
                        ' ) ';
                    conn.query(countSql, (err, rs) => {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        callback(null, rs);
                    })
                }
            }, (err, results) => {
                let type = req.query.type == undefined ? 0 : req.query.type;
                let brandRes = results['brandGet'];
                let itemRes = type == 0 ? results['itemGet'] : [];
                let pdfRes = type == 1 ? results['pdfGet'] : [];
                let itemCount = type == 0 ? results['itemCount'][0].count : 0;
                let pdfCount = type == 1 ? results['pdfCount'][0].count : 0;
                let pageList = [];
                let length = type == 0 ? itemCount : pdfCount;
                for (let index = 0; index < Math.ceil(length / Common.everyPage); index++) {
                    pageList.push(index + 1);
                }
                let totalPage = pageList[pageList.length - 1];
                pageList = Common.getPageList(currentPage, pageList);  // 获取显示的列表码

                console.log(pdfRes);
                console.log('pdfRes');
                res.render('pdf', {
                    brandRes: brandRes,
                    itemRes: itemRes,
                    pdfRes: pdfRes,
                    pageList: pageList,
                    currentPage: currentPage,
                    totalPage: totalPage,
                    type: type,
                    channel: 'handle'
                });
            });
            conn.release();
        });
    },





    /**
     * 搜索品牌
     * @param req
     * @param res
     */
    searchBrand: (req, res) => {
        let pool = connPool().pool;
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }
            let brandName = req.query['brand_name'];
            let brandSql = "SELECT id,manuName FROM manufacturer WHERE manuName like '%" + brandName + "%' ORDER BY manuName ASC";
            conn.query(brandSql, (err, rs) => {
                if (err) {
                    res.send("数据库查询错误。" + err.message);
                    return;
                }
                console.log(rs);
                let itemRes = [];
                let pdfRes = [];
                let pageList = [];
                let currentPage = 1;
                let totalPage = 1;
                res.render('pdf', {
                    brandRes: rs, itemRes: itemRes, pdfRes: pdfRes, type: 0, pageList: pageList,
                    currentPage: currentPage, totalPage: totalPage, channel: 'handle'
                });
            });
            conn.release();
        });
    },


    /**
     * 修改货号
     * @param req
     * @param res
     */
    modifyItemName: (req, res) => {
        let pool = connPool().pool;
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }
            let itemName = req.body.item_name;
            let itemId = req.body.item_id;
            let itemSql = "UPDATE item SET item_name=? WHERE id=?";
            conn.query(itemSql, [itemName, itemId], (err, rs) => {
                if (err) {
                    res.json({
                        res: false
                    });
                    return;
                }
                res.json({
                    res: true
                });
            });
            conn.release();
        });
    },

    /**
     * 修改pdf名称和点击量
     * @param req
     * @param res
     */
    modifyPdf: (req, res) => {
        let pool = connPool().pool;
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }
            let pdfName = req.body.pdf_name;
            let pdfId = req.body.pdf_id;
            let click_num = req.body.click_num;

            let pdfSql = "UPDATE pdf SET pdf_name=? ,click_num=? WHERE id=?";

            console.log(pdfName, click_num, pdfId);
            conn.query(pdfSql, [pdfName, click_num, pdfId], (err, rs) => {
                if (err) {
                    res.json({
                        res: false
                    })
                    return;
                }
                res.json({
                    res: true
                });
            });
            conn.release();
        });
    },

    /**
     * 删除pdf
     * @param req
     * @param res
     */
    deletePdf: (req, res) => {
        let pool = connPool().pool;
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }
            let pdfId = req.body.pdf_id;
            let pdfSql = "DELETE FROM pdf WHERE id=?";
            conn.query(pdfSql, [pdfId], (err, rs) => {
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
            let deleteSql = "DELETE FROM itemPdf WHERE pdf_id=?";
            conn.query(deleteSql, [pdfId], (err, rs) => {
                if (err) {
                    console.log(err.message);
                    return;
                }
            });
            conn.release();
        });
    },

    /**
     * 删除货号
     * @param req
     * @param res
     */
    deleteItem: (req, res) => {
        let pool = connPool().pool;
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }
            let itemId = req.body.item_id;

            async.series({
                getExperimentCount: (call) => {
                    let experimentCountSql = 'SELECT count(id) count FROM itemMaterials WHERE item_id=?';
                    conn.query(experimentCountSql, [itemId], (err, countRes) => {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        call(null, countRes);
                    })
                },
                getVideoCount: (call) => {
                    let videoCountSql = 'SELECT count(id) count FROM itemVideo WHERE item_id=?';
                    conn.query(videoCountSql, [itemId], (err, countRes) => {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        call(null, countRes);
                    });
                },
                getAgencyCount: (call) => {
                    let agencyCountSql = 'SELECT count(id) count FROM itemGoods WHERE item_id=?';
                    conn.query(agencyCountSql, [itemId], (ree, countRes) => {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        call(null, countRes);
                    })
                }
            }, (err, results) => {

                let experimentCount = results['getExperimentCount'][0];
                let videoCount = results['getVideoCount'][0];
                let agencyCount = results['getAgencyCount'][0];
                if (experimentCount.count == 0 && videoCount.count == 0 && agencyCount.count == 0) {

                    let itemSql = "DELETE FROM item WHERE id=?";
                    conn.query(itemSql, [itemId], (err, rs) => {
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
                    let deleteItemGoodsSql = "DELETE FROM itemGoods WHERE item_id=?";
                    conn.query(deleteItemGoodsSql, [itemId], (err, rs) => {
                        if (err) {
                            console.log(err.message);
                            return;
                        }
                    });
                    /*let deleteItemPdfSql = "DELETE FROM itemPdf WHERE item_id=?";
                    conn.query(deleteItemPdfSql, [itemId], (err, rs) => {
                        if (err) {
                            console.log(err.message);
                            return;
                        }
                    });
                    let deleteItemMaterials = "DELETE FROM itemMaterials WHERE item_id=?";
                    conn.query(deleteItemMaterials, [itemId], (err, rs) => {
                        if (err) {
                            console.log(err.message);
                            return;
                        }
                    });
                    let deleteItemManufacturer = "DELETE FROM itemManufacturer WHERE item_id=?";
                    conn.query(deleteItemManufacturer, [itemId], (err, rs) => {
                        if (err) {
                            console.log(err.message);
                            return;
                        }
                    });
                    let deleteItemGoods = "DELETE FROM itemGoods WHERE item_id=?";
                    conn.query(deleteItemGoods, [itemId], (err, rs) => {
                        if (err) {
                            console.log(err.message);
                            return;
                        }
                    });*/
                } else {
                    res.json({
                        res: false,
                        mes: "该货号下有视频、文献或者经销商，不能删除"
                    });
                }
            });
            conn.release();
        });
    },

    /**
     * 增加pdf打印次数
     * @param req
     * @param res
     */
    printPdf: (req, res) => {
        let pool = connPool().pool;
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }
            let pdfId = req.body.pdf_id;
            let pdfSql = "UPDATE pdf SET print_num=print_num+1 WHERE id=?";
            conn.query(pdfSql, [pdfId], (err, rs) => {
                if (err) {
                    res.json({
                        res: false
                    });
                    return;
                }
                res.json({
                    res: true
                });
            });
            let operation_time = sd.format(new Date(), "YYYY-MM-DD HH:mm:ss");
            let user_ip = req.connection.remoteAddress.replace(/::ffff:/, '') + '-' + Common.md5(req.headers['user-agent']);
            let addSql = "INSERT INTO operation (pdf_id,operation_type,operation_time,user_ip,user_id) VALUES (?,?,?,?,?)";
            conn.query(addSql, [pdfId, 1, operation_time, user_ip, 1], (err, rs) => {

                //todo:wen lb
            });
            conn.release();
        });
    },

    /**
     * 增加pdf下载次数
     * @param req
     * @param res
     */
    downloadPdf: (req, res) => {
        let pool = connPool().pool;
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }
            let pdfId = req.body.pdf_id;
            let pdfSql = "UPDATE pdf SET download_num=download_num+1 WHERE id=?";
            conn.query(pdfSql, [pdfId], (err, rs) => {
                if (err) {
                    res.json({
                        res: false
                    });
                    return;
                }
                res.json({
                    res: true
                });
            });

            let operation_time = sd.format(new Date(), "YYYY-MM-DD HH:mm:ss");
            let user_ip = req.connection.remoteAddress.replace(/::ffff:/, '') + '-' + Common.md5(req.headers['user-agent']);
            console.log(user_ip);
            let addSql = "INSERT INTO operation(pdf_id,operation_type,operation_time,user_ip,user_id) VALUES (?,?,?,?,?)";
            conn.query(addSql, [pdfId, 0, operation_time, user_ip, 1], (err, rs) => {

                //todo wen lb
            });
            conn.release();
        });
    },

    /**
     * 显示添加pdf页面
     * @param req
     * @param res
     */
    showAddPdf: (req, res) => {
        let pool = connPool().pool;
        let brand_id = req.query['brand_id'] ? req.query['brand_id'] : 0;
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }
            let brandName = req.query['brand_name'] ? req.query['brand_name'] : '';
           // let brandSql = "SELECT id,manuName FROM manufacturer WHERE manuName like '%" + brandName + "%'";

            let brandSql = "SELECT id,manuName FROM manufacturer ";

            conn.query(brandSql, (err, rs) => {
                if (err) {
                    res.send("数据库查询错误。" + err.message);
                    return;
                }
                for (let index = 0; index < rs.length; index++) {
                    if (rs[index].id == brand_id) {
                        brandName = rs[index].manuName;
                    }
                }
                console.log(rs);
                console.log('rsrs');


                res.render('addpdf', {brandRes: rs, brandId: brand_id, brandName: brandName, channel: 'brand'});
            });
            conn.release();
        });
    },


    //test
    testUpload: (req, res, webUrl, storagePath) => {

        res.json({
            res: true,
            code: 0
        });
    },


    /**
     * 上传pdf
     */
    //todo：上传不稳定，需要细节测试！！；


    parsePdfyoutunew: (req, res, webUrl, storagePath) => {
        let someData = req.body;
        someData.brandId = parseInt(someData.brandId);
        someData.subBrandId = parseInt(someData.subBrandId);
        someData.language = parseInt(someData.language);
        let file = req.file;

        //  console.log(file.originalname);

        let pdfOriginalName = file.originalname;
        let pdfPath = storagePath + "/" + file.filename;
        let pdfUrl = webUrl + "/" + file.filename;
        // 解析pdfName
        let leftBracketPos = pdfOriginalName.indexOf('{');
        let rightBracketPos = pdfOriginalName.indexOf('}');
        let pdfName = pdfOriginalName.substr(leftBracketPos + 1, rightBracketPos - leftBracketPos - 1);
        // 解析货号
        let leftMiddleBracketPos = pdfOriginalName.indexOf('(');
        let rightMiddleBracketPos = pdfOriginalName.indexOf(')');
        let itemNumbers = pdfOriginalName.substr(leftMiddleBracketPos + 1, rightMiddleBracketPos - leftMiddleBracketPos - 1);
        itemNumbers = itemNumbers.split(',');
        for (let item = 0; item < itemNumbers.length; item++) {
            itemNumbers[item] = itemNumbers[item].trim();
        }
        let pool = connPool().pool;
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }
            let deferred = Q.defer();
            // 首先判断该品牌下是否存在相应的货号
            let checkItemSql = 'SELECT item_name,item_id FROM itemManufacturer im' +
                ' LEFT JOIN item i ON i.id=im.item_id' +
                ' WHERE manufacturer_id=? and manufacturer_sub_id=?';
            conn.query(checkItemSql, [someData.brandId, someData.subBrandId], (err, checkRes) => {
                if (err) {
                    res.json({
                        res: false,
                        msg: "查询品牌和货号关系失败"
                    });
                    return;
                }
                //  console.log(file.filename);
                // 首先处理获取的结果 重新构造其结构
                let checkedItemRes = [];
                checkRes.forEach((item) => {
                    checkedItemRes[item['item_name']] = item['item_id'];
                });
                // 比对货号
                async.map(itemNumbers, (number, callback) => {
                    if (checkedItemRes[number] == undefined) {
                        if (someData.language == 0) var addSql = "INSERT INTO item (item_name,english_tag) VALUES(?,?)";  //更新英文文档数量
                        else var addSql = "INSERT INTO item (item_name,chinese_tag) VALUES(?,?)"; //更新中文文档数量
                        conn.query(addSql, [number, 1], (err, addRes) => {
                            if (err) {
                                console.log(err);
                            } else {
                                let itemId = addRes.insertId;
                                // 添加品牌和货号关联表
                                let addRelationSql = "INSERT INTO itemManufacturer(item_id,manufacturer_id,manufacturer_sub_id) VALUES (?,?,?)";
                                conn.query(addRelationSql, [itemId, someData.brandId, someData.subBrandId], (err, rs) => {
                                    if (err) {
                                        console.log(err);
                                    }
                                    else {
                                        callback(null, rs.insertId);
                                    }
                                });
                            }
                        });
                    } else {
                        callback(null, checkedItemRes[number]);
                    }
                }, (err, results) => {
                    (() => {
                        let pdfSql = "SELECT id, language from pdf WHERE pdf_name=? AND brand_id =? AND language=?";
                        conn.query(pdfSql, [pdfName, someData.brandId, someData.language], (err, idRes) => {
                            if (err) {
                                console.log(err);
                            } else {
                                //如果没有同名的pdf，就是新pdf
                                if (idRes.length == 0) {
                                    var addPdfSql = "INSERT INTO pdf (pdf_name,pdf_url,pdf_path,txt,language,brand_id,sub_brand_id) values(?,?,?,?,?,?,?)";

                                    let pdfImage = new PDFImage(req.file.path);
                                    pdfImage.convertPage(0).then((imagePath) => {
                                        //解析图片名
                                        let image_name = imagePath.substr(imagePath.lastIndexOf("/") + 1);
                                        let thumb_image_url = webUrl + "/" + image_name;  // 构造图片访问地址

                                        let pdfParser = new PDFParser(this, 1);
                                        pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError));
                                        pdfParser.on("pdfParser_dataReady", pdfData => {
                                            let pdfText = pdfParser.getRawTextContent(pdfData);
                                            conn.query(addPdfSql, [pdfName, pdfUrl, pdfPath, pdfText, someData.language, someData.brandId, someData.subBrandId], (err, addRes) => {
                                                if (err) {
                                                    console.log(err);
                                                    deferred.reject(err);
                                                } else {
                                                    let i = 1;
                                                    i++;
                                                    console.log(i);
                                                    deferred.resolve({
                                                        pdfId: addRes.insertId
                                                    });
                                                }
                                            });
                                        });
                                        pdfParser.loadPDF(req.file.path);
                                    });
                                }
                                else {
                                    console.log('updata new pdf for old pdf!');
                                    //更新pdf内容，删除原来的itemPdf数据
                                    let pdfImage = new PDFImage(req.file.path);
                                    pdfImage.convertPage(0).then((imagePath) => {
                                        //解析图片名
                                        let image_name = imagePath.substr(imagePath.lastIndexOf("/") + 1);
                                        let thumb_image_url = webUrl + "/" + image_name;  // 构造图片访问地址
                                        let pdfParser = new PDFParser(this, 1);
                                        pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError));
                                        pdfParser.on("pdfParser_dataReady", pdfData => {
                                            let pdfText = pdfParser.getRawTextContent(pdfData);
                                            let updateSql = "UPDATE pdf SET pdf_name=?,pdf_url=?,pdf_path=?,txt=?,language=?,brand_id=?,sub_brand_id=? WHERE id=" + _id;
                                            conn.query(updateSql, [pdfName, pdfUrl, pdfPath, pdfText, someData.language, someData.brandId, someData.subBrandId], (err, updateRes) => {
                                                if (err) {
                                                    console.log(err);
                                                } else {
                                                    let delItemPdfSql = "DELETE FROM itemPdf WHERE pdf_id = ?";
                                                    conn.query(delItemPdfSql, [_id], (err, delRes) => {
                                                        if (err) {
                                                            deferred.reject(err);
                                                        }
                                                        else {
                                                            deferred.resolve({
                                                                pdfId: item.id
                                                            });
                                                        }
                                                    })
                                                }
                                            });
                                        });
                                        pdfParser.loadPDF(req.file.path);
                                    });
                                }
                            }
                        })
                        return deferred.promise.nodeify(null);
                    })().then((data) => {
                        // 构造数组 关系 批量添加
                        let relations = [];
                        results.forEach((itemId) => {
                            relations.push([itemId, data.pdfId]);
                        })
                        let addItemPdfSql = "INSERT INTO itemPdf (item_id,pdf_id)  VALUES ? ";
                        conn.query(addItemPdfSql, [relations], (err, addRes) => {
                            if (err) {
                                res.json({
                                    res: false,
                                    msg: "添加货号和pdf失败"
                                })
                            } else {
                                res.json({
                                    res: true,
                                    msg: pdfOriginalName + " 添加成功",
                                    code: 0

                                })
                            }
                        });
                    }).catch((err) => {
                        res.json({
                            res: false,
                            msg: pdfOriginalName + " 添加失败",
                            err_info: err.message
                        })
                    })
                });
            });
            conn.release();
        });
    },

    parsePdf: (req, res, webUrl, storagePath) => {
        let someData = req.body;
        someData.brandId = parseInt(someData.brandId);
        someData.subBrandId = parseInt(someData.subBrandId);
        someData.language = parseInt(someData.language);
        let file = req.file;

        //  console.log(file.originalname);

        let pdfOriginalName = file.originalname;
        let pdfPath = storagePath + "/" + file.filename;
        let pdfUrl = webUrl + "/" + file.filename;
        // 解析pdfName
        let leftBracketPos = pdfOriginalName.indexOf('{');
        let rightBracketPos = pdfOriginalName.indexOf('}');
        let pdfName = pdfOriginalName.substr(leftBracketPos + 1, rightBracketPos - leftBracketPos - 1);
        // 解析货号
        let leftMiddleBracketPos = pdfOriginalName.indexOf('(');
        let rightMiddleBracketPos = pdfOriginalName.indexOf(')');
        let itemNumbers = pdfOriginalName.substr(leftMiddleBracketPos + 1, rightMiddleBracketPos - leftMiddleBracketPos - 1);
        itemNumbers = itemNumbers.split(',');
        for (let item = 0; item < itemNumbers.length; item++) {
            itemNumbers[item] = itemNumbers[item].trim();
        }

        console.log(itemNumbers);
        console.log('itemNumbers');
        let pool = connPool().pool;
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }
            let deferred = Q.defer();
            // 首先判断该品牌下是否存在相应的货号
            //todo: and manufacturer_sub_id 就不要查询了!
            let checkItemSql = 'SELECT item_name,item_id FROM itemManufacturer im' +
                ' LEFT JOIN item i ON i.id=im.item_id' +
                ' WHERE manufacturer_id=? and manufacturer_sub_id=?';
            conn.query(checkItemSql, [someData.brandId, someData.subBrandId], (err, checkRes) => {
                if (err) {
                    res.json({
                        res: false,
                        msg: "查询品牌和货号关系失败"
                    });
                    return;
                }
                  console.log(checkRes);
                console.log('checkRes');
                // 首先处理获取的结果 重新构造其结构
                let checkedItemRes = [];
                checkRes.forEach((item) => {
                    checkedItemRes[item['item_name']] = item['item_id'];
                });
                // 比对货号
                async.map(itemNumbers, (number, callback) => {
                    if (checkedItemRes[number] == undefined) {
                        // if (someData.language == 0) var addSql = "INSERT INTO item (item_name) VALUES(?)";  //更新英文文档数量
                        // else var addSql = "INSERT INTO item (item_name) VALUES(?)"; //更新中文文档数量
                        var addSql = "INSERT INTO item (item_name) VALUES(?)";

                        conn.query(addSql, [number], (err, addRes) => {
                            if (err) {
                                console.log(err);
                            } else {
                                let itemId = addRes.insertId;
                                // 添加品牌和货号关联表
                                let addRelationSql = "INSERT INTO itemManufacturer(item_id,manufacturer_id,manufacturer_sub_id) VALUES (?,?,?)";
                                conn.query(addRelationSql, [itemId, someData.brandId, someData.subBrandId], (err, rs) => {
                                    if (err) {
                                        console.log(err);
                                    }
                                    else {
                                        callback(null, rs.insertId);
                                    }
                                });
                            }
                        });
                    } else {
                        callback(null, checkedItemRes[number]);
                    }
                }, (err, results) => {
                    (() => {
                        //todo: someDat.language   is wrong???
                        let pdfSql = "SELECT id, language from pdf WHERE pdf_name=? AND brand_id =?";
                        conn.query(pdfSql, [pdfName, someData.brandId, someData.language], (err, idRes) => {
                            if (err) {
                                console.log(err);
                            } else {
                                //如果没有同名的pdf，就是全新pdf
                                if (idRes.length == 0) {
                                    var addPdfSql = "INSERT INTO pdf (pdf_name,pdf_url,pdf_path,language,brand_id,sub_brand_id) values(?,?,?,?,?,?)";
                                 //   let pdfImage = new PDFImage(req.file.path);
                               //     pdfImage.convertPage(0).then((imagePath) => {
                                        //解析图片名
                                   //     let image_name = imagePath.substr(imagePath.lastIndexOf("/") + 1);
                                   //     let thumb_image_url = webUrl + "/" + image_name;  // 构造图片访问地址
                                        //todo thumb_img  thumb_image_url,
                                        conn.query(addPdfSql, [pdfName, pdfUrl, pdfPath, someData.language, someData.brandId, someData.subBrandId], (err, rsId) => {
                                            if (err) {
                                                deferred.reject(err)
                                            }
                                            else {
                                                deferred.resolve({
                                                    pdfId: rsId.insertId
                                                })

                                                let pdfParser = new PDFParser(this, 1);
                                                pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError));
                                                pdfParser.on("pdfParser_dataReady", pdfData => {
                                                    let pdfText = pdfParser.getRawTextContent(pdfData);
                                                    let addTxtSql = "INSERT INTO pdfTxt (pdf_id,txt) VALUES (?,?)";
                                                    conn.query(addTxtSql, [rsId.insertId, pdfText], (err, addRes) => {
                                                        if (err) {
                                                            console.log(err);
                                                        }
                                                        else {
                                                            console.log('TxtPdf sucess');
                                                        }
                                                    });
                                                });
                                                pdfParser.loadPDF(req.file.path);
                                            }
                                        })
                                        //todo tupian
                                  //  });
                                }
                                else {
                                    let _id = idRes[0].id;
                                    let selLanguage = idRes[0].language;

                                    if(selLanguage == someData.language) {
                                        //如果名称相同，语言相同，则更新pdf内容，删除原来的itemPdf数据
                                   //     let pdfImage = new PDFImage(req.file.path);
                                    //    pdfImage.convertPage(0).then((imagePath) => {
                                            //解析图片名
                                     //       let image_name = imagePath.substr(imagePath.lastIndexOf("/") + 1);
                                     //       let thumb_image_url = webUrl + "/" + image_name;  // 构造图片访问地址
                                            //todo thumb_img  thumb_image_url,
                                            let updateSql = "UPDATE pdf SET sub_brand_id=? WHERE id=" + _id;
                                            conn.query(updateSql, [someData.subBrandId], (err, rs) => {
                                                if (err) {
                                                    console.log(err);
                                                }
                                                else {
                                                    let pdfParser = new PDFParser(this, 1);
                                                    pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError));
                                                    pdfParser.on("pdfParser_dataReady", pdfData => {
                                                        let pdfText = pdfParser.getRawTextContent(pdfData);
                                                        let updateTextSql = 'UPDATE pdfTxt SET txt = ? WHERE id =' + _id;
                                                        conn.query(updateTextSql, [pdfText], (err, updateRes) => {
                                                            if (err) {
                                                                console.log(err);
                                                            } else {
                                                                let delItemPdfSql = "DELETE FROM itemPdf WHERE pdf_id =" + _id;
                                                                conn.query(delItemPdfSql, (err, delRes) => {
                                                                    if (err) {
                                                                        deferred.reject(err);
                                                                        console.log(err);
                                                                    }
                                                                    else {
                                                                        console.log('delete itemPdf;');
                                                                        deferred.resolve({
                                                                            pdfId: _id
                                                                        });
                                                                    }
                                                                })
                                                            }
                                                        });
                                                    });
                                                    pdfParser.loadPDF(req.file.path);
                                                }
                                            })
                                     //   });
                                    }else {
                                        //如果名称相同，语言不同，则插入pdf，同时给查询到的pdf更新语言字段

                                        //todo thumb_img  thumb_image_url,
                                        if(someData.language == 0) var addPdfSql = "INSERT INTO pdf (pdf_name,pdf_url,pdf_path,language,brand_id,sub_brand_id, same_num,chi_id,main_id) values(?,?,?,?,?,?,1,?,?)";
                                        else var  addPdfSql = "INSERT INTO pdf (pdf_name,pdf_url,pdf_path,language,brand_id,sub_brand_id, same_num,eng_id,main_id) values(?,?,?,?,?,?,1,?,?)";

                                      //  let pdfImage = new PDFImage(req.file.path);
                                      //  pdfImage.convertPage(0).then((imagePath) => {
                                            //解析图片名
                                     //       let image_name = imagePath.substr(imagePath.lastIndexOf("/") + 1);
                                      //      let thumb_image_url = webUrl + "/" + image_name;  // 构造图片访问地址
                                            //todo thumb_img  thumb_image_url,
                                            conn.query(addPdfSql, [pdfName, pdfUrl, pdfPath, someData.language, someData.brandId, someData.subBrandId,_id,_id], (err, rsId) => {
                                                if (err) {
                                                    deferred.reject(err)
                                                }
                                                else {
                                                    deferred.resolve({
                                                        pdfId: rsId.insertId
                                                    })

                                                    let pdfParser = new PDFParser(this, 1);
                                                    pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError));
                                                    pdfParser.on("pdfParser_dataReady", pdfData => {
                                                        let pdfText = pdfParser.getRawTextContent(pdfData);
                                                        let addTxtSql = "INSERT INTO pdfTxt (pdf_id,txt) VALUES (?,?)";
                                                        conn.query(addTxtSql, [rsId.insertId, pdfText], (err, addRes) => {
                                                            if (err) {
                                                                console.log(err);
                                                            }
                                                            else {
                                                                if (someData.language == 0) var laguageSql = "UPDATE  pdf set eng_id = ?,same_num=1 WHERE id =" + _id;  //更新英文文档数量
                                                                else var laguageSql = "UPDATE  pdf set chi_id = ?,same_num=1 WHERE id =" + _id; //更新中文文档数量

                                                                console.log(_id);
                                                                console.log('_id');
                                                                conn.query( laguageSql,[rsId.insertId],(err, rs) =>{
                                                                    if(err){console.log(err);}
                                                                    else {console.log('添加另一个pdf语言');}
                                                                })
                                                            }
                                                        });
                                                    });
                                                    pdfParser.loadPDF(req.file.path);
                                                }
                                            })
                                            //todo tupian
                                       // });
                                    }

                                }
                            }
                        })
                        return deferred.promise.nodeify(null);
                    })().then((data) => {
                        // 构造数组 关系 批量添加
                        let relations = [];
                        results.forEach((itemId) => {
                            relations.push([itemId, data.pdfId]);
                        })
                        console.log('hwwwwwwwww?');
                        console.log(relations);


                        let addItemPdfSql = "INSERT INTO itemPdf (item_id,pdf_id)  VALUES ? ";
                        conn.query(addItemPdfSql, [relations], (err, addRes) => {
                            if (err) {
                                res.json({
                                    res: false,
                                    msg: "添加货号和pdf失败",
                                    code:-1
                                })
                            } else {
                                res.json({
                                    res: true,
                                    msg: pdfOriginalName + " 添加成功",
                                    code: 0
                                })
                            }
                        });
                    }).catch((err) => {
                        res.json({
                            res: false,
                            msg: pdfOriginalName + "添加失败" ,
                            err_info: err.message,
                            code:-1
                        })
                    })
                });
            });
            conn.release();
        });
    },
    parsePdf8: (req, res, webUrl, storagePath) => {
        let someData = req.body;
        someData.brandId = parseInt(someData.brandId);
        someData.subBrandId = parseInt(someData.subBrandId);
        someData.language = parseInt(someData.language);
        let file = req.file;

        //  console.log(file.originalname);

        let pdfOriginalName = file.originalname;
        let pdfPath = storagePath + "/" + file.filename;
        let pdfUrl = webUrl + "/" + file.filename;
        // 解析pdfName
        let leftBracketPos = pdfOriginalName.indexOf('{');
        let rightBracketPos = pdfOriginalName.indexOf('}');
        let pdfName = pdfOriginalName.substr(leftBracketPos + 1, rightBracketPos - leftBracketPos - 1);
        // 解析货号
        let leftMiddleBracketPos = pdfOriginalName.indexOf('(');
        let rightMiddleBracketPos = pdfOriginalName.indexOf(')');
        let itemNumbers = pdfOriginalName.substr(leftMiddleBracketPos + 1, rightMiddleBracketPos - leftMiddleBracketPos - 1);
        itemNumbers = itemNumbers.split(',');
        for (let item = 0; item < itemNumbers.length; item++) {
            itemNumbers[item] = itemNumbers[item].trim();
        }
        let pool = connPool().pool;
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }
            let deferred = Q.defer();
            // 首先判断该品牌下是否存在相应的货号
            //todo: and manufacturer_sub_id 就不要查询了!
            let checkItemSql = 'SELECT item_name,item_id FROM itemManufacturer im' +
                ' LEFT JOIN item i ON i.id=im.item_id' +
                ' WHERE manufacturer_id=? and manufacturer_sub_id=?';
            conn.query(checkItemSql, [someData.brandId, someData.subBrandId], (err, checkRes) => {
                if (err) {
                    res.json({
                        res: false,
                        msg: "查询品牌和货号关系失败"
                    });
                    return;
                }
                //  console.log(file.filename);
                // 首先处理获取的结果 重新构造其结构
                let checkedItemRes = [];
                checkRes.forEach((item) => {
                    checkedItemRes[item['item_name']] = item['item_id'];
                });
                // 比对货号
                async.map(itemNumbers, (number, callback) => {
                    if (checkedItemRes[number] == undefined) {
                        if (someData.language == 0) var addSql = "INSERT INTO item (item_name) VALUES(?)";  //更新英文文档数量
                        else var addSql = "INSERT INTO item (item_name) VALUES(?)"; //更新中文文档数量
                        conn.query(addSql, [number], (err, addRes) => {
                            if (err) {
                                console.log(err);
                            } else {
                                let itemId = addRes.insertId;
                                // 添加品牌和货号关联表
                                let addRelationSql = "INSERT INTO itemManufacturer(item_id,manufacturer_id,manufacturer_sub_id) VALUES (?,?,?)";
                                conn.query(addRelationSql, [itemId, someData.brandId, someData.subBrandId], (err, rs) => {
                                    if (err) {
                                        console.log(err);
                                    }
                                    else {
                                        callback(null, rs.insertId);
                                    }
                                });
                            }
                        });
                    } else {
                        callback(null, checkedItemRes[number]);
                    }
                }, (err, results) => {
                    (() => {
                        let pdfSql = "SELECT id, language from pdf WHERE pdf_name=? AND brand_id =?";
                        conn.query(pdfSql, [pdfName, someData.brandId, someData.language], (err, idRes) => {
                            if (err) {
                                console.log(err);
                            } else {
                                //如果没有同名的pdf，就是全新pdf
                                if (idRes.length == 0) {
                                    var addPdfSql = "INSERT INTO pdf (pdf_name,pdf_url,pdf_path,language,brand_id,sub_brand_id,thumb_img) values(?,?,?,?,?,?,?)";
                                    let pdfImage = new PDFImage(req.file.path);
                                    pdfImage.convertPage(0).then((imagePath) => {
                                        //解析图片名
                                        let image_name = imagePath.substr(imagePath.lastIndexOf("/") + 1);
                                        let thumb_image_url = webUrl + "/" + image_name;  // 构造图片访问地址
                                    //todo thumb_img  thumb_image_url,
                                        conn.query(addPdfSql, [pdfName, pdfUrl, pdfPath, someData.language, someData.brandId, someData.subBrandId,thumb_image_url], (err, rsId) => {
                                            if (err) {
                                                deferred.reject(err)
                                            }
                                            else {
                                                deferred.resolve({
                                                    pdfId: rsId.insertId
                                                })

                                                let pdfParser = new PDFParser(this, 1);
                                                pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError));
                                                pdfParser.on("pdfParser_dataReady", pdfData => {
                                                    let pdfText = pdfParser.getRawTextContent(pdfData);
                                                    let addTxtSql = "INSERT INTO pdfTxt (pdf_id,txt) VALUES (?,?)";
                                                    conn.query(addTxtSql, [rsId.insertId, pdfText], (err, addRes) => {
                                                        if (err) {
                                                            console.log(err);
                                                        }
                                                        else {
                                                            console.log('TxtPdf sucess');
                                                        }
                                                    });
                                                });
                                                pdfParser.loadPDF(req.file.path);
                                            }
                                        })
                                    //todo tupian
                                    });
                                }
                                else {
                                    let _id = idRes[0].id;
                                    let selLanguage = idRes[0].language;

                                    if(selLanguage == someData.language) {
                                        //如果名称相同，语言相同，则更新pdf内容，删除原来的itemPdf数据
                                        let pdfImage = new PDFImage(req.file.path);
                                        pdfImage.convertPage(0).then((imagePath) => {
                                            //解析图片名
                                            let image_name = imagePath.substr(imagePath.lastIndexOf("/") + 1);
                                            let thumb_image_url = webUrl + "/" + image_name;  // 构造图片访问地址
                                            //todo thumb_img  thumb_image_url,
                                            let updateSql = "UPDATE pdf SET sub_brand_id=? WHERE id=" + _id;
                                            conn.query(updateSql, [someData.subBrandId], (err, rs) => {
                                                if (err) {
                                                    console.log(err);
                                                }
                                                else {
                                                    let pdfParser = new PDFParser(this, 1);
                                                    pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError));
                                                    pdfParser.on("pdfParser_dataReady", pdfData => {
                                                        let pdfText = pdfParser.getRawTextContent(pdfData);
                                                        let updateTextSql = 'UPDATE pdfTxt SET txt = ? WHERE id =' + _id;
                                                        conn.query(updateTextSql, [pdfText], (err, updateRes) => {
                                                            if (err) {
                                                                console.log(err);
                                                            } else {
                                                                let delItemPdfSql = "DELETE FROM itemPdf WHERE pdf_id =" + _id;
                                                                conn.query(delItemPdfSql, (err, delRes) => {
                                                                    if (err) {
                                                                        deferred.reject(err);
                                                                        console.log(err);
                                                                    }
                                                                    else {
                                                                        console.log('delete itemPdf;');
                                                                        deferred.resolve({
                                                                            pdfId: _id
                                                                        });
                                                                    }
                                                                })
                                                            }
                                                        });
                                                    });
                                                    pdfParser.loadPDF(req.file.path);
                                                }
                                            })
                                        });
                                    }else {
                                        //如果名称相同，语言不同，则插入pdf，同时给查询到的pdf更新语言字段

                                        //todo thumb_img  thumb_image_url,
                                        if(someData.language == 0) var addPdfSql = "INSERT INTO pdf (pdf_name,pdf_url,pdf_path,language,brand_id,sub_brand_id, same_num,chi_id,main_id,thumb_img) values(?,?,?,?,?,?,1,?,?,?)";
                                        else var  addPdfSql = "INSERT INTO pdf (pdf_name,pdf_url,pdf_path,language,brand_id,sub_brand_id, same_num,eng_id,main_id,thumb_img) values(?,?,?,?,?,?,1,?,?,?)";

                                         let pdfImage = new PDFImage(req.file.path);
                                         pdfImage.convertPage(0).then((imagePath) => {
                                        //解析图片名
                                          let image_name = imagePath.substr(imagePath.lastIndexOf("/") + 1);
                                         let thumb_image_url = webUrl + "/" + image_name;  // 构造图片访问地址
                                        //todo thumb_img  thumb_image_url,
                                      //  conn.query(addPdfSql, [pdfName, pdfUrl, pdfPath, someData.language, someData.brandId, someData.subBrandId,_id,_id], (err, rsId) => {
                                            conn.query(addPdfSql, [pdfName, pdfUrl, pdfPath, someData.language, someData.brandId, someData.subBrandId,_id,_id,thumb_img], (err, rsId) => {
                                                if (err) {
                                                deferred.reject(err)
                                            }
                                            else {
                                                deferred.resolve({
                                                    pdfId: rsId.insertId
                                                })

                                                let pdfParser = new PDFParser(this, 1);
                                                pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError));
                                                pdfParser.on("pdfParser_dataReady", pdfData => {
                                                    let pdfText = pdfParser.getRawTextContent(pdfData);
                                                    let addTxtSql = "INSERT INTO pdfTxt (pdf_id,txt) VALUES (?,?)";
                                                    conn.query(addTxtSql, [rsId.insertId, pdfText], (err, addRes) => {
                                                        if (err) {
                                                            console.log(err);
                                                        }
                                                        else {
                                                            if (someData.language == 0) var laguageSql = "UPDATE  pdf set eng_id = ?,same_num=1 WHERE id =" + _id;  //更新英文文档数量
                                                            else var laguageSql = "UPDATE  pdf set chi_id = ?,same_num=1 WHERE id =" + _id; //更新中文文档数量

                                                            console.log(_id);
                                                            console.log('_id');
                                                            conn.query( laguageSql,[rsId.insertId],(err, rs) =>{
                                                                if(err){console.log(err);}
                                                                else {console.log('添加另一个pdf语言');}
                                                            })
                                                        }
                                                    });
                                                });
                                                pdfParser.loadPDF(req.file.path);
                                            }
                                        })
                                        //todo tupian
                                        });
                                    }

                                }
                            }
                        })
                        return deferred.promise.nodeify(null);
                    })().then((data) => {
                        // 构造数组 关系 批量添加
                        let relations = [];
                        results.forEach((itemId) => {
                            relations.push([itemId, data.pdfId]);
                        })
                        let addItemPdfSql = "INSERT INTO itemPdf (item_id,pdf_id)  VALUES ? ";
                        conn.query(addItemPdfSql, [relations], (err, addRes) => {
                            if (err) {
                                res.json({
                                    res: false,
                                    msg: "添加货号和pdf失败",
                                    code:-1
                                })
                            } else {
                                res.json({
                                    res: true,
                                    msg: pdfOriginalName + " 添加成功",
                                    code: 0
                                })
                            }
                        });
                    }).catch((err) => {
                        res.json({
                            res: false,
                            msg: pdfOriginalName + " 添加失败",
                            err_info: err.message,
                            code:-1
                        })
                    })
                });
            });
            conn.release();
        });
    },

    parsePdfyoutuyuanlai: (req, res, webUrl, storagePath) => {
        let someData = req.body;
        someData.brandId = parseInt(someData.brandId);
        someData.subBrandId = parseInt(someData.subBrandId);
        someData.language = parseInt(someData.language);
        let file = req.file;

        //  console.log(file.originalname);

        let pdfOriginalName = file.originalname;
        let pdfPath = storagePath + "/" + file.filename;
        let pdfUrl = webUrl + "/" + file.filename;
        // 解析pdfName
        let leftBracketPos = pdfOriginalName.indexOf('{');
        let rightBracketPos = pdfOriginalName.indexOf('}');
        let pdfName = pdfOriginalName.substr(leftBracketPos + 1, rightBracketPos - leftBracketPos - 1);
        // 解析货号
        let leftMiddleBracketPos = pdfOriginalName.indexOf('(');
        let rightMiddleBracketPos = pdfOriginalName.indexOf(')');
        let itemNumbers = pdfOriginalName.substr(leftMiddleBracketPos + 1, rightMiddleBracketPos - leftMiddleBracketPos - 1);
        itemNumbers = itemNumbers.split(',');
        for (let item = 0; item < itemNumbers.length; item++) {
            itemNumbers[item] = itemNumbers[item].trim();
        }
        let pool = connPool().pool;
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }
            let deferred = Q.defer();
            // 首先判断该品牌下是否存在相应的货号
            let checkItemSql = 'SELECT item_name,item_id FROM itemManufacturer im' +
                ' LEFT JOIN item i ON i.id=im.item_id' +
                ' WHERE manufacturer_id=? and manufacturer_sub_id=?';
            conn.query(checkItemSql, [someData.brandId, someData.subBrandId], (err, checkRes) => {
                if (err) {
                    res.json({
                        res: false,
                        msg: "查询品牌和货号关系失败"
                    });
                    return;
                }
                //  console.log(file.filename);
                // 首先处理获取的结果 重新构造其结构
                let checkedItemRes = [];
                checkRes.forEach((item) => {
                    checkedItemRes[item['item_name']] = item['item_id'];
                });
                // 比对货号
                async.map(itemNumbers, (number, callback) => {
                    if (checkedItemRes[number] == undefined) {
                        if (someData.language == 0) var addSql = "INSERT INTO item (item_name,english_tag) VALUES(?,?)";  //更新英文文档数量
                        else var addSql = "INSERT INTO item (item_name,chinese_tag) VALUES(?,?)"; //更新中文文档数量
                        conn.query(addSql, [number, 1], (err, addRes) => {
                            if (err) {
                                console.log(err);
                            } else {
                                let itemId = addRes.insertId;
                                // 添加品牌和货号关联表
                                let addRelationSql = "INSERT INTO itemManufacturer(item_id,manufacturer_id,manufacturer_sub_id) VALUES (?,?,?)";
                                conn.query(addRelationSql, [itemId, someData.brandId, someData.subBrandId], (err, rs) => {
                                    if (err) {
                                        console.log(err);
                                    }
                                    else {
                                        callback(null, rs.insertId);
                                    }
                                });
                            }
                        });
                    } else {
                        callback(null, checkedItemRes[number]);
                    }
                }, (err, results) => {
                    (() => {
                        let pdfSql = "SELECT id, language from pdf WHERE pdf_name=? AND brand_id =?";
                        conn.query(pdfSql, [pdfName, someData.brandId], (err, idRes) => {
                            if (err) {
                                console.log(err);
                            } else {
                                //如果没有同名的pdf，就是新pdf
                                if (idRes.length == 0) {
                                    var addPdfSql = "INSERT INTO pdf (pdf_name,pdf_url,pdf_path,txt,language,brand_id,sub_brand_id) values(?,?,?,?,?,?,?)";

                                    let pdfImage = new PDFImage(req.file.path);
                                    pdfImage.convertPage(0).then((imagePath) => {
                                        //解析图片名
                                        let image_name = imagePath.substr(imagePath.lastIndexOf("/") + 1);
                                        let thumb_image_url = webUrl + "/" + image_name;  // 构造图片访问地址

                                        let pdfParser = new PDFParser(this, 1);
                                        pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError));
                                        pdfParser.on("pdfParser_dataReady", pdfData => {
                                            let pdfText = pdfParser.getRawTextContent(pdfData);
                                            conn.query(addPdfSql, [pdfName, pdfUrl, pdfPath, pdfText, someData.language, someData.brandId, someData.subBrandId], (err, addRes) => {
                                                if (err) {
                                                    console.log(err);
                                                    deferred.reject(err);
                                                } else {
                                                    let i = 1;
                                                    i++;
                                                    console.log(i);
                                                    deferred.resolve({
                                                        pdfId: addRes.insertId
                                                    });
                                                }
                                            });
                                        });
                                        pdfParser.loadPDF(req.file.path);
                                    });
                                }
                                else {
                                    //相同名称的pdf
                                    async.map(idRes, function (item, callback) {
                                        var _id = item.id;
                                        var pdfLanguage = item.language;
                                        // 如果是语言也相同，那就是更新pdf
                                        if (someData.language == pdfLanguage) {
                                            console.log(item.pdf_name);
                                            console.log(file.originalname);
                                            console.log('updata new pdf for old pdf!');
                                            //更新pdf内容，删除原来的itemPdf数据
                                            let pdfImage = new PDFImage(req.file.path);
                                            pdfImage.convertPage(0).then((imagePath) => {
                                                //解析图片名
                                                let image_name = imagePath.substr(imagePath.lastIndexOf("/") + 1);
                                                let thumb_image_url = webUrl + "/" + image_name;  // 构造图片访问地址
                                                let pdfParser = new PDFParser(this, 1);
                                                pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError));
                                                pdfParser.on("pdfParser_dataReady", pdfData => {
                                                    let pdfText = pdfParser.getRawTextContent(pdfData);
                                                    let updateSql = "UPDATE pdf SET pdf_name=?,pdf_url=?,pdf_path=?,txt=?,language=?,brand_id=?,sub_brand_id=? WHERE id=" + _id;
                                                    conn.query(updateSql, [pdfName, pdfUrl, pdfPath, pdfText, someData.language, someData.brandId, someData.subBrandId], (err, updateRes) => {
                                                        if (err) {
                                                            deferred.reject(err);
                                                        } else {
                                                            let delItemPdfSql = "DELETE FROM itemPdf WHERE pdf_id = ?";
                                                            conn.query(delItemPdfSql, [_id], (err, delRes) => {
                                                                if (err) {
                                                                    console.log(err);
                                                                }
                                                                else {
                                                                    deferred.resolve({
                                                                        pdfId: item.id
                                                                    });
                                                                }
                                                            })
                                                        }
                                                    });
                                                });
                                                pdfParser.loadPDF(req.file.path);
                                            });
                                            //  callback(null,'1');
                                        } else {
                                            //如果名称相同而语言不同，则添加pdf
                                            console.log('language is not same,so add another new pdf');
                                            let eng_id = 0;
                                            let chi_id = 0;
                                            if (item.language == 1) chi_id = item.id;
                                            else eng_id = item.id;

                                            var addPdfSql = "INSERT INTO pdf (pdf_name,pdf_url,pdf_path,txt,language,same_num,eng_id,chi_id,brand_id,sub_brand_id) values(?,?,?,?,?,same_num+1,?,?,?,?)";
                                            let pdfImage = new PDFImage(req.file.path);
                                            pdfImage.convertPage(0).then((imagePath) => {
                                                //解析图片名
                                                let image_name = imagePath.substr(imagePath.lastIndexOf("/") + 1);
                                                let thumb_image_url = webUrl + "/" + image_name;  // 构造图片访问地址
                                                let pdfParser = new PDFParser(this, 1);
                                                pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError));
                                                pdfParser.on("pdfParser_dataReady", pdfData => {
                                                    let pdfText = pdfParser.getRawTextContent(pdfData);
                                                    conn.query(addPdfSql, [pdfName, pdfUrl, pdfPath, pdfText, someData.language, eng_id, chi_id, someData.brandId, someData.subBrandId], (err, addRes) => {
                                                        if (err) {
                                                            console.log(err);
                                                            deferred.reject(err);
                                                        } else {
                                                            deferred.resolve({
                                                                pdfId: addRes.insertId
                                                            });
                                                        }
                                                    });
                                                });
                                                pdfParser.loadPDF(req.file.path);
                                            });
                                        }
                                        // callback(null,'2');
                                    }, function (err, results) {
                                        if (err) {
                                            deferred.reject(err);
                                        } else {
                                            res.json({
                                                // res:true,
                                                //  code:0
                                            })
                                        }
                                    });
                                }
                            }
                        })
                        return deferred.promise.nodeify(null);
                    })().then((data) => {
                        // 构造数组 关系 批量添加
                        let relations = [];
                        results.forEach((itemId) => {
                            relations.push([itemId, data.pdfId]);
                        })
                        let addItemPdfSql = "INSERT INTO itemPdf (item_id,pdf_id)  VALUES ? ";
                        conn.query(addItemPdfSql, [relations], (err, addRes) => {
                            if (err) {
                                res.json({
                                    res: false,
                                    msg: "添加货号和pdf失败"
                                })
                            } else {
                                res.json({
                                    res: true,
                                    msg: pdfOriginalName + " 添加成功",
                                    code: 0

                                })
                            }
                        });
                    }).catch((err) => {
                        res.json({
                            res: false,
                            msg: pdfOriginalName + " 添加失败",
                            err_info: err.message
                        })
                    })
                });
            });
            conn.release();
        });
    },


    parsePdffb: (req, res, webUrl, storagePath) => {
        let someData = req.body;
        console.log(someData);
        console.log('111111');
        someData.brandId = parseInt(someData.brandId);
        someData.subBrandId = parseInt(someData.subBrandId);
        someData.language = parseInt(someData.language);
        let file = req.file;

        let pdfOriginalName = file.originalname;
        let pdfPath = storagePath + "/" + file.filename;
        let pdfUrl = webUrl + "/" + file.filename;
        // 解析pdfName
        let leftBracketPos = pdfOriginalName.indexOf('{');
        let rightBracketPos = pdfOriginalName.indexOf('}');
        let pdfName = pdfOriginalName.substr(leftBracketPos + 1, rightBracketPos - leftBracketPos - 1);
        // 解析货号
        let leftMiddleBracketPos = pdfOriginalName.indexOf('(');
        let rightMiddleBracketPos = pdfOriginalName.indexOf(')');
        let itemNumbers = pdfOriginalName.substr(leftMiddleBracketPos + 1, rightMiddleBracketPos - leftMiddleBracketPos - 1);
        itemNumbers = itemNumbers.split(',');
        for (let item = 0; item < itemNumbers.length; item++) {
            itemNumbers[item] = itemNumbers[item].trim();
        }

        console.log(itemNumbers);
        let pool = connPool().pool;
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }
            let deferred = Q.defer();
            // 首先判断该品牌下是否存在相应的货号
            let checkItemSql = 'SELECT item_name,item_id FROM itemManufacturer im' +
                ' LEFT JOIN item i ON i.id=im.item_id' +
                ' WHERE manufacturer_id=? and manufacturer_sub_id=?';
            conn.query(checkItemSql, [someData.brandId, someData.subBrandId], (err, checkRes) => {
                if (err) {
                    res.json({
                        res: false,
                        msg: "查询品牌和货号关系失败"
                    });
                    return;
                }
                // 首先处理获取的结果 重新构造其结构
                let checkedItemRes = [];
                checkRes.forEach((item) => {
                    checkedItemRes[item['item_name']] = item['item_id'];
                });

                // 比对货号
                async.map(itemNumbers, (number, callback) => {
                    if (checkedItemRes[number] == undefined) {
                        if (someData.language == 0) var addSql = "INSERT INTO item (item_name,english_tag) VALUES(?,?)";  //更新英文文档数量
                        else var addSql = "INSERT INTO item (item_name,chinese_tag) VALUES(?,?)"; //更新中文文档数量


                        console.log('fafaklsfjlasfjlasjfljalfj');
                        conn.query(addSql, [number, 1], (err, addRes) => {
                            if (err) {
                                console.log(err);
                            } else {
                                console.log('333333333333');
                                let itemId = addRes.insertId;
                                // 添加品牌和货号关联表
                                let addRelationSql = "INSERT INTO itemManufacturer(item_id,manufacturer_id,manufacturer_sub_id) VALUES (?,?,?)";
                                conn.query(addRelationSql, [itemId, someData.brandId, someData.subBrandId], (err, rs) => {
                                    console.log('6666');
                                    if (err) {
                                        console.log(err);
                                    } else {
                                        callback(null, rs.insertId);
                                    }
                                    console.log('22222222');
                                });
                            }
                        });
                    } else {
                        callback(null, checkedItemRes[number]);
                    }
                }, (err, results) => {
                    (() => {

                        console.log('aaaaaaaaa');
                        let pdfSql = "SELECT id, language from pdf WHERE pdf_name=?";
                        conn.query(pdfSql, [pdfName], (err, idRes) => {
                            if (err) {
                                console.log(err);
                            } else {
                                console.log('bbbbbbbbb');
                                //如果没有同名的pdf，就是新pdf
                                if (idRes.length == 0) {
                                    var addPdfSql = "INSERT INTO pdf (pdf_name,pdf_url,pdf_path,thumb_img,txt,language,brand_id,sub_brand_id ) values(?,?,?,?,?,?,?,?)";

                                    let pdfImage = new PDFImage(req.file.path);
                                    pdfImage.convertPage(0).then((imagePath) => {
                                        //解析图片名
                                        let image_name = imagePath.substr(imagePath.lastIndexOf("/") + 1);
                                        let thumb_image_url = webUrl + "/" + image_name;  // 构造图片访问地址

                                        let pdfParser = new PDFParser(this, 1);
                                        pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError));
                                        pdfParser.on("pdfParser_dataReady", pdfData => {
                                            let pdfText = pdfParser.getRawTextContent(pdfData);
                                            conn.query(addPdfSql, [pdfName, pdfUrl, pdfPath, thumb_image_url, pdfText, someData.language, someData.brandId, someData.subBrandId], (err, addRes) => {
                                                if (err) {
                                                    console.log(err);
                                                    deferred.reject(err);
                                                } else {
                                                    deferred.resolve({
                                                        pdfId: addRes.insertId
                                                    });
                                                }
                                            });
                                        });
                                        pdfParser.loadPDF(req.file.path);
                                    });
                                }
                                else {
                                    //相同名称的pdf
                                    async.map(idRes, function (item, callback) {
                                        var _id = item.id;
                                        var pdfLanguage = item.language;
                                        // 如果是语言也相同，那就是更新pdf
                                        if (someData.language == pdfLanguage) {
                                            //更新pdf内容，删除原来的itemPdf数据
                                            let pdfImage = new PDFImage(req.file.path);
                                            pdfImage.convertPage(0).then((imagePath) => {
                                                //解析图片名
                                                let image_name = imagePath.substr(imagePath.lastIndexOf("/") + 1);
                                                let thumb_image_url = webUrl + "/" + image_name;  // 构造图片访问地址
                                                let pdfParser = new PDFParser(this, 1);
                                                pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError));
                                                pdfParser.on("pdfParser_dataReady", pdfData => {
                                                    let pdfText = pdfParser.getRawTextContent(pdfData);
                                                    let updateSql = "UPDATE pdf SET pdf_name=?,pdf_url=?,pdf_path=?,thumb_img=?,txt=?,language=?,,brand_id=?,sub_brand_id=? WHERE id=" + _id;
                                                    conn.query(updateSql, [pdfName, pdfUrl, pdfPath, thumb_image_url, pdfText, someData.language], (err, updateRes) => {
                                                        if (err) {
                                                            deferred.reject(err);
                                                        } else {
                                                            console.log('haixuyaoshanchu!!!');
                                                            let delItemPdfSql = "DELETE FROM itemPdf WHERE pdf_id = ?";
                                                            conn.query(delItemPdfSql, [_id], (err, delRes) => {
                                                                if (err) {
                                                                    console.log(err);
                                                                }
                                                                else {
                                                                    deferred.resolve({
                                                                        pdfId: item.id
                                                                    });
                                                                }
                                                            })
                                                        }
                                                    });
                                                });
                                                pdfParser.loadPDF(req.file.path);
                                            });
                                            //  callback(null,'1');
                                        } else {
                                            //如果名称相同而语言不同，则添加pdf
                                            var eng_id = 0;
                                            var chi_id = 0;
                                            if (item.language == 1) var chi_id = item.id;
                                            else var eng_id = item.id;

                                            var addPdfSql = "INSERT INTO pdf (pdf_name,pdf_url,pdf_path,thumb_img,txt,language,same_num,eng_id,chi_id,brand_id,sub_brand_id) values(?,?,?,?,?,?,same_num+1,?,?,?,?)";
                                            let pdfImage = new PDFImage(req.file.path);
                                            pdfImage.convertPage(0).then((imagePath) => {
                                                //解析图片名
                                                let image_name = imagePath.substr(imagePath.lastIndexOf("/") + 1);
                                                let thumb_image_url = webUrl + "/" + image_name;  // 构造图片访问地址
                                                let pdfParser = new PDFParser(this, 1);
                                                pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError));
                                                pdfParser.on("pdfParser_dataReady", pdfData => {
                                                    let pdfText = pdfParser.getRawTextContent(pdfData);
                                                    conn.query(addPdfSql, [pdfName, pdfUrl, pdfPath, thumb_image_url, pdfText, someData.language, eng_id, chi_id, someData.brandId, someData.subBrandId], (err, addRes) => {
                                                        if (err) {
                                                            console.log(err);
                                                            deferred.reject(err);
                                                        } else {
                                                            deferred.resolve({
                                                                pdfId: addRes.insertId
                                                            });
                                                        }
                                                    });
                                                });
                                                pdfParser.loadPDF(req.file.path);
                                            });
                                        }
                                        // callback(null,'2');
                                    }, function (err, results) {
                                        if (err) {
                                            deferred.reject(err);
                                        } else {
                                            console.log('sop hereere?');
                                            res.json({
                                                res: true,
                                                code: 0
                                            })
                                        }
                                    });
                                }
                            }
                        })
                        return deferred.promise.nodeify(null);
                    })().then((data) => {
                        // 构造数组 关系 批量添加
                        console.log(data);
                        console.log('dta;');
                        let relations = [];
                        results.forEach((itemId) => {
                            relations.push([itemId, data.pdfId]);
                        })
                        let addItemPdfSql = "INSERT INTO itemPdf (item_id,pdf_id)  VALUES ? ";
                        conn.query(addItemPdfSql, [relations], (err, addRes) => {
                            if (err) {
                                res.json({
                                    res: false,
                                    msg: "添加货号和pdf失败"
                                })
                            } else {
                                console.log('zzzzzzzz');
                                res.json({
                                    res: true,
                                    code: 0

                                })
                            }
                        });
                    }).catch((err) => {
                        res.json({
                            res: false,
                            msg: pdfOriginalName + " 添加失败",
                            err_info: err.message
                        })
                    })
                });
            });
            conn.release();
        });
    },


    parsePdf1: (req, res, webUrl, storagePath) => {
        let someData = req.body;
        someData.brandId = parseInt(someData.brandId);
        someData.subBrandId = parseInt(someData.subBrandId);
        someData.language = parseInt(someData.language);
        let file = req.file;
        let pdfOriginalName = file.originalname;
        let pdfPath = storagePath + "/" + file.filename;
        let pdfUrl = webUrl + "/" + file.filename;
        // 解析pdfName
        let leftBracketPos = pdfOriginalName.indexOf('{');
        let rightBracketPos = pdfOriginalName.indexOf('}');
        let pdfName = pdfOriginalName.substr(leftBracketPos + 1, rightBracketPos - leftBracketPos - 1);

        // 解析货号
        let leftMiddleBracketPos = pdfOriginalName.indexOf('(');
        let rightMiddleBracketPos = pdfOriginalName.indexOf(')');
        let itemNumbers = pdfOriginalName.substr(leftMiddleBracketPos + 1, rightMiddleBracketPos - leftMiddleBracketPos - 1);
        itemNumbers = itemNumbers.split(',');
        for (let item = 0; item < itemNumbers.length; item++) {
            itemNumbers[item] = itemNumbers[item].trim();
        }

        console.log(itemNumbers);
        console.log('itemNumbers');
        let pool = connPool().pool;
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }
            let deferred = Q.defer();
            // 首先判断该品牌下是否存在相应的货号
            let checkItemSql = 'SELECT item_name,item_id FROM itemManufacturer im' +
                ' LEFT JOIN item i ON i.id=im.item_id' +
                ' WHERE manufacturer_id=? and manufacturer_sub_id=?';
            conn.query(checkItemSql, [someData.brandId, someData.subBrandId], (err, checkRes) => {
                if (err) {
                    res.json({
                        res: false,
                        msg: "查询品牌和货号关系失败"
                    });
                    return;
                }
                // 首先处理获取的结果 重新构造其结构
                let checkedItemRes = [];
                checkRes.forEach((item) => {
                    checkedItemRes[item['item_name']] = item['item_id'];
                });

                // 比对货号
                async.map(itemNumbers, (number, callback) => {

                    console.log(checkedItemRes[number]);
                    console.log('??????');
                    if (checkedItemRes[number] == undefined) {

                        console.log('undefied;');
                        if (someData.language == 0) var addSql = "INSERT INTO item (item_name,english_tag) VALUES(?,?)";  //更新英文文档数量
                        else var addSql = "INSERT INTO item (item_name,chinese_tag) VALUES(?,?)"; //更新中文文档数量
                        conn.query(addSql, [number, 1], (err, addRes) => {
                            if (err) {
                                console.log(err);
                            } else {
                                let itemId = addRes.insertId;
                                // 添加品牌和货号关联表
                                let addRelationSql = "INSERT INTO itemManufacturer(item_id,manufacturer_id,manufacturer_sub_id) VALUES (?,?,?)";
                                conn.query(addRelationSql, [itemId, someData.brandId, someData.subBrandId], (err, rs) => {
                                    if (err) {
                                        console.log(err);
                                    } else {
                                        console.log(rs.insertId);
                                    }
                                    callback(null, checkedItemRes[number]);
                                });

                            }
                        });

                    } else {
                        callback(null, checkedItemRes[number]);
                    }

                }, (err, results) => {
                    (() => {
                        //let pdfImage = new PDFImage(req.file.path);
                        //pdfImage.convertPage(0).then((imagePath) => {
                        //解析图片名
                        //  let image_name = imagePath.substr(imagePath.lastIndexOf("/") + 1);
                        //   let thumb_image_url = webUrl + "/" + image_name;  // 构造图片访问地址
                        let pdfParser = new PDFParser(this, 1);
                        pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError));
                        pdfParser.on("pdfParser_dataReady", pdfData => {
                            let pdfText = pdfParser.getRawTextContent(pdfData);
                            // 添加pdf
                            let addPdfSql = "INSERT INTO pdf (pdf_name,pdf_url,pdf_path,txt,language) values(?,?,?,?,?)";
                            conn.query(addPdfSql, [pdfName, pdfUrl, pdfPath, pdfText, someData.language], (err, addRes) => {
                                if (err) {
                                    deferred.reject(err);
                                } else {
                                    deferred.resolve({
                                        pdfId: addRes.insertId
                                    });
                                }
                            });
                        });
                        pdfParser.loadPDF(req.file.path);
                        // });
                        return deferred.promise.nodeify(null);
                    })().then((data) => {
                        // 构造数组 关系 批量添加
                        let relations = [];
                        results.forEach((itemId) => {
                            relations.push([itemId, data.pdfId]);
                        })
                        let addItemPdfSql = "INSERT INTO itemPdf (item_id,pdf_id) VALUES ?";
                        conn.query(addItemPdfSql, [relations], (err, addRes) => {
                            if (err) {
                                res.json({
                                    res: false,
                                    msg: "添加货号和pdf失败"
                                })
                            } else {
                                res.json({
                                    res: true,
                                    msg: pdfOriginalName + " 添加成功"
                                })
                            }
                        });
                    }).catch((err) => {
                        res.json({
                            res: false,
                            msg: pdfOriginalName + " 添加失败",
                            err_info: err.message
                        })
                    })
                });

            });
            conn.release();
        });
    }

}