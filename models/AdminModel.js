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
            conn.query(adminLoginSql, param, (err, rs) => {
                if (err) {
                    res.send("数据库查询错误。" + err.message);
                    return;
                }
                if (rs.length == 0) {
                    res.send("用户名/密码错误");
                } else {
                    res.redirect('/admin/brand');
                }
            });
            conn.release();
        });
    },

    /**
     * 操作手册
     */
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
                let itemRes = [];
                let pdfRes = [];
                let pageList = [];
                let currentPage = 1;
                console.log(rs);

                res.render('pdf', {
                    brandRes: rs, itemRes: itemRes, pdfRes: pdfRes, type: 0, pageList: pageList,
                    currentPage: currentPage, channel: 'handle'
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
     * 修改pdf名称
     * @param req
     * @param res
     */
    modifyPdfName: (req, res) => {
        let pool = connPool().pool;
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }
            let pdfName = req.body.pdf_name;
            let pdfId = req.body.pdf_id;
            let pdfSql = "UPDATE pdf SET pdf_name=? WHERE id=?";

            console.log(pdfName,pdfId);
            conn.query(pdfSql, [pdfName, pdfId], (err, rs) => {
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
            let brandSql = "SELECT id,manuName FROM manufacturer WHERE manuName like '%" + brandName + "%'";
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
                res.render('addpdf', {brandRes: rs, brandId: brand_id, brandName: brandName, channel: 'brand'});
            });
            conn.release();
        });
    },

    /**
     * 上传pdf
     */
    //todo：上传不稳定，需要细节测试！！；

    parsePdf: (req, res, webUrl, storagePath) => {
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
                        conn.query(addSql, [number, 1], (err, addRes) => {
                            if (err) {
                                console.log(err);
                            } else {
                                let itemId = addRes.insertId;
                                // 添加品牌和货号关联表
                                let addRelationSql = "INSERT INTO itemManufacturer(item_id,manufacturer_id,manufacturer_sub_id) VALUES (?,?,?)";
                                conn.query(addRelationSql, [itemId, someData.brandId, someData.subBrandId], (err, rs) => {
                                });
                            }
                        });
                    } else {
                        callback(null, checkedItemRes[number]);
                    }

                }, (err, results) => {
                    (() => {
                        let pdfImage = new PDFImage(req.file.path);
                        pdfImage.convertPage(0).then((imagePath) => {
                            //解析图片名
                            let image_name = imagePath.substr(imagePath.lastIndexOf("/") + 1);
                            let thumb_image_url = webUrl + "/" + image_name;  // 构造图片访问地址
                            let pdfParser = new PDFParser(this, 1);
                            pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError));
                            pdfParser.on("pdfParser_dataReady", pdfData => {
                                let pdfText = pdfParser.getRawTextContent(pdfData);
                                // 添加pdf
                                let addPdfSql = "INSERT INTO pdf (pdf_name,pdf_url,pdf_path,thumb_img,txt,language) values(?,?,?,?,?,?)";
                                conn.query(addPdfSql, [pdfName, pdfUrl, pdfPath, thumb_image_url, pdfText, someData.language], (err, addRes) => {
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
                        });
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
};