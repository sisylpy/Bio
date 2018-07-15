var connPool = require("./ConnPool");
var LoginBean = require("../jsBean/LoginBean");
var Promise = require('promise');
var async = require('async');
// var await = require('await');
var Q = require('q');
var sd = require('silly-datetime');
var PDFParser = require('pdf2json');
var EXCELParser = require('node-xlsx');
var crypto = require('crypto');
var CommonBean = require('../jsBean/CommonBean');
let Common = new CommonBean();


module.exports = {

    getPdf:(req,res)=>{
        var pool = connPool().pool;
        // 从pool中获取连接(异步,取到后回调)
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }
            let searchByValue = req.query['value']==undefined?'':req.query['value'];
            let page = req.query['page']==undefined?1:req.query['page'];
            async.series({
                pdfGet: (callback) => {
                    let getSql = 'SELECT id,pdf_name,pdf_url,language,thumb_img FROM pdf WHERE id IN' +
                        ' (SELECT p.id FROM pdf p' +
                        ' LEFT JOIN itemPdf ip ON ip.pdf_id=p.id' +
                        ' JOIN item i ON ip.item_id=i.id' +
                        ' JOIN itemManufacturer imf ON imf.item_id=ip.item_id' +
                        ' WHERE i.item_name like "%'+searchByValue+'%" OR p.pdf_name like "%'+searchByValue+'%"' +
                        ' OR p.txt like "%'+searchByValue+'%") ORDER BY id ASC LIMIT '+(page-1)*Common.everyPage+','+Common.everyPage;

                    conn.query(getSql, (err, rs) => {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        async.map(rs,(operation,call)=>{
                            let getBrandSql = 'SELECT item_name,manufacturer_id,manufacturer_sub_id FROM itemPdf ip' +
                                ' JOIN item i ON i.id=ip.item_id' +
                                ' JOIN itemManufacturer imf ON imf.item_id=ip.item_id' +
                                ' WHERE ip.pdf_id='+operation.id;
                            conn.query(getBrandSql, (err, operationItemRs) => {
                                if (err) {
                                    res.send("数据库查询错误。" + err.message);
                                    return;
                                }
                                let operationItemInfo = [];
                                operationItemRs.forEach((item)=>{
                                    if(operationItemInfo[operation.id] == undefined){
                                        operation['manufacturer_id'] = item.manufacturer_id;
                                        operation['manufacturer_sub_id'] = item.manufacturer_sub_id;
                                        operation['item_name'] = "";
                                        operationItemInfo[operation.id] = [];
                                    }
                                    operation['item_name'] += " "+item.item_name;
                                });
                                call(null,operationItemRs);

                            })
                        },(err,result)=>{
                            callback(null, rs);
                        });
                        // conn.release();
                    })
                },
                brandGet: (callback)=>{
                    let getSql = 'SELECT id,manuName FROM manufacturer';
                    conn.query(getSql,(err,rs)=>{
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        callback(null, rs)
                    })
                }
            }, (err, results) => {
                var type = req.query.type == undefined ? 0 : req.query.type;
                var pdfs = results['pdfGet'];
                var brandRes = [];
                results['brandGet'].forEach((brand)=>{
                      brandRes[brand['id']] = brand['manuName'];
                });
                pdfs.forEach((pdf)=>{
                    pdf['manuName'] = brandRes[pdf['manufacturer_id']];
                    pdf['manuSubName'] = brandRes[pdf['manufacturer_sub_id']];
                });

                // 获取pdf下面的视频 文献 现货 试用品 留言
                async.map(pdfs,(pdf,callback)=>{
                     async.series({
                         materialsGet: (callfunc) => { // 获取pdf信息
                             let getSql = 'SELECT id,experiment_name,issue_year,magazine_name,address,issue_time,author,summary FROM experiment' +
                                 ' WHERE id IN (' +
                                 ' SELECT experiment_id FROM itemMaterials ' +
                                 ' WHERE item_id IN (SELECT item_id FROM itemPdf WHERE pdf_id ='+pdf.id+'))';
                             conn.query(getSql, (err, rs) => {
                                 if (err) {
                                     res.send("数据库查询错误。" + err.message);
                                     return;
                                 }
                                 callfunc(null, rs);
                                 // conn.release();
                             })
                         },
                         videoGet: (callfunc)=>{
                             let getSql = 'SELECT id,video_name,create_time,show_times,star,video_url FROM video' +
                                 ' WHERE id IN (' +
                                 ' SELECT video_id FROM itemVideo WHERE item_id IN (' +
                                 '  SELECT item_id FROM itemPdf WHERE pdf_id='+pdf.id+'))';
                             conn.query(getSql, (err, rs) => {
                                 if (err) {
                                     res.send("数据库查询错误。" + err.message);
                                     return;
                                 }
                                 callfunc(null, rs)
                                 // conn.release();
                             })
                         },
                         recGet: (callfunc)=>{
                             let getSql = 'SELECT id,pdf_name,pdf_url,language,thumb_img FROM pdf WHERE id IN' +
                                 ' (SELECT p.id FROM pdf p' +
                                 ' LEFT JOIN itemPdf ip ON ip.pdf_id=p.id' +
                                 ' JOIN item i ON ip.item_id=i.id' +
                                 ' JOIN itemManufacturer imf ON imf.item_id=ip.item_id' +
                                 ' WHERE i.id IN (SELECT item_id FROM itemPdf WHERE pdf_id='+pdf.id+')' +
                                 ' AND ip.pdf_id !='+pdf.id+') ORDER BY id ASC LIMIT 0,10';
                             // ' ORDER BY id ASC LIMIT '+(page-1)*Common.everyPage+','+Common.everyPage;
                             conn.query(getSql, (err, rs) => {
                                 if (err) {
                                     res.send("数据库查询错误。" + err.message);
                                     return;
                                 }
                                 async.map(rs,(operation,call)=>{
                                     let getBrandSql = 'SELECT item_name,manufacturer_id,manufacturer_sub_id FROM itemPdf ip' +
                                         ' JOIN item i ON i.id=ip.item_id' +
                                         ' JOIN itemManufacturer imf ON imf.item_id=ip.item_id' +
                                         ' WHERE ip.pdf_id='+operation.id;
                                     conn.query(getBrandSql, (err, operationItemRs) => {
                                         if (err) {
                                             res.send("数据库查询错误。" + err.message);
                                             return;
                                         }
                                         let operationItemInfo = [];
                                         operationItemRs.forEach((item)=>{
                                             if(operationItemInfo[operation.id] == undefined){
                                                 operation['manufacturer_id'] = item.manufacturer_id;
                                                 operation['manufacturer_sub_id'] = item.manufacturer_sub_id;
                                                 operation['item_name'] = "";
                                                 operationItemInfo[operation.id] = [];
                                             }
                                             operation['item_name'] += " "+item.item_name;
                                         });
                                         call(null,operationItemRs);

                                     })
                                 },(err,result)=>{
                                     callfunc(null, rs);
                                 });
                                 // conn.release();
                             })
                         },
                         productGet: (callfunc) => {
                             let getSql = 'SELECT ig.id,manufacturer_name,agencyName,item_name,goods_name,goods_standard,stock,unit,manufactur_price' +
                                 ' sale_price,sales_area,person_name,person_phone,update_time FROM itemGoods ig' +
                                 ' JOIN agency a ON a.id=ig.agency_id' +
                                 ' JOIN item i ON i.id=ig.item_id' +
                                 ' WHERE type_id=0 and ig.item_id IN (SELECT item_id FROM itemPdf WHERE pdf_id='+pdf.id+')';
                             conn.query(getSql, (err, rs) => {
                                 if (err) {
                                     res.send("数据库查询错误。" + err.message);
                                     return;
                                 }
                                 callfunc(null, rs);
                                 // conn.release();
                             })
                         },
                         trailProductGet: (callfunc) => {
                             let getSql = 'SELECT ig.id,manufacturer_name,agencyName,item_name,goods_name,goods_standard,sample_amount,unit,manufactur_price' +
                                 ' sale_price,sales_area,person_name,person_phone FROM itemGoods ig' +
                                 ' JOIN agency a ON a.id=ig.agency_id' +
                                 ' JOIN item i ON i.id=ig.item_id' +
                                 ' WHERE type_id=1 and ig.item_id IN (SELECT item_id FROM itemPdf WHERE pdf_id='+pdf.id+')';
                             conn.query(getSql, (err, rs) => {
                                 if (err) {
                                     res.send("数据库查询错误。" + err.message);
                                     return;
                                 }
                                 callfunc(null, rs);
                                 // conn.release();
                             })
                         },
                         messageGet: (callfunc) => {
                             let getSql = 'SELECT im.id,pdf_name,pdf_id,user_id,create_time,type_id,message_content,product_id,user_ip,check_status,parent_id FROM itemMessage im' +
                                 ' LEFT JOIN pdf p ON p.id=im.pdf_id WHERE check_status=1 AND parent_id=0 AND pdf_id='+pdf.id;
                             conn.query(getSql, (err, rs) => {
                                 if (err) {
                                     res.send("数据库查询错误。" + err.message);
                                     return;
                                 }
                                 callfunc(null,rs);
                             })
                         },
                     },(err,result)=>{
                         var materials = result['materialsGet'];
                         var videos = result['videoGet'];
                         var recs = result['recGet'];
                         var products = result['productGet'];
                         var trailProducts = result['trailProductGet'];
                         var messages = result['messageGet'];

                         pdf['materialCount'] = materials.length;
                         pdf['videoCount'] = videos.length;
                         pdf['recCount'] = recs.length;
                         pdf['productCount'] = products.length;
                         pdf['trailProductCount'] = trailProducts.length;
                         pdf['messageCount'] = messages.length;

                         callback(null,pdf);
                     })
                },(err,results)=>{
                    res.json({
                        res: true,
                        data:pdfs
                    });
                });
            });
            conn.release();
        });
    },
    searchPdf:(req,res)=>{
        var pool = connPool().pool;
        // 从pool中获取连接(异步,取到后回调)
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }

            let searchByValue = req.query['value'];
            async.series({
                pdfGet: (callback) => {
                    let getSql = 'SELECT p.id,pdf_name,pdf_url,language,thumb_img,i.item_name,manufacturer_id,manufacturer_sub_id FROM pdf p' +
                        ' LEFT JOIN itemPdf ip ON ip.pdf_id=p.id' +
                        ' JOIN item i ON ip.item_id=i.id' +
                        ' JOIN itemManufacturer imf ON imf.item_id=ip.item_id' +
                        ' WHERE i.item_name like "%'+searchByValue+'%" OR p.pdf_name like "%'+searchByValue+'%"' +
                        ' OR p.txt like "%'+searchByValue+'%"';
                    conn.query(getSql, (err, rs) => {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        callback(null, rs)
                        // conn.release();
                    })
                },
                brandGet: (callback)=>{
                    let getSql = 'SELECT id,manuName FROM manufacturer';
                    conn.query(getSql,(err,rs)=>{
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        callback(null, rs)
                    })
                }
            }, (err, results) => {
                var type = req.query.type == undefined ? 0 : req.query.type;
                var pdfs = results['pdfGet'];
                var brandRes = [];
                results['brandGet'].forEach((brand)=>{
                    brandRes[brand['id']] = brand['manuName'];
                });
                var pdfInfo = [];
                var pdfId = [];
                pdfs.forEach((pdf)=>{
                    pdf['manuName'] = brandRes[pdf['manufacturer_id']];
                    pdf['manuSubName'] = brandRes[pdf['manufacturer_sub_id']];
                    if(pdfInfo[pdf['id']] == undefined){
                        pdfInfo[pdf['id']] = pdf;
                    }else{
                        pdfInfo[pdf['id']]['item_name'] += " "+pdf['item_name']
                    }
                });
                var pdfRes = [];
                for(let pdf in pdfInfo){
                    pdfRes.push(pdfInfo[pdf]);
                }
                res.json({
                    res: true,
                    data:pdfRes
                });
            });
            conn.release();
        });
    },
    getOnePdf:(req,res)=>{
        var pool = connPool().pool;
        // 从pool中获取连接(异步,取到后回调)
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }

            let pdf_id = req.query['pdf_id'];
            async.series({
                pdfGet: (callback) => {
                    let getSql = 'SELECT p.id,pdf_name,pdf_url,language,thumb_img,i.item_name,manufacturer_id,manufacturer_sub_id FROM pdf p' +
                        ' LEFT JOIN itemPdf ip ON ip.pdf_id=p.id' +
                        ' JOIN item i ON ip.item_id=i.id' +
                        ' JOIN itemManufacturer imf ON imf.item_id=ip.item_id' +
                        ' WHERE p.id='+pdf_id;
                    conn.query(getSql, (err, rs) => {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        callback(null, rs)
                        // conn.release();
                    })
                },
                brandGet: (callback)=>{
                    let getSql = 'SELECT id,manuName FROM manufacturer';
                    conn.query(getSql,(err,rs)=>{
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        callback(null, rs)
                    })
                }
            }, (err, results) => {
                var pdfs = results['pdfGet'];
                var brandRes = [];
                results['brandGet'].forEach((brand)=>{
                    brandRes[brand['id']] = brand['manuName'];
                });
                var pdfInfo = [];
                var pdfId = [];
                pdfs.forEach((pdf)=>{
                    pdf['manuName'] = brandRes[pdf['manufacturer_id']];
                    pdf['manuSubName'] = brandRes[pdf['manufacturer_sub_id']];
                    if(pdfInfo[pdf['id']] == undefined){
                        pdfInfo[pdf['id']] = pdf;
                    }else{
                        pdfInfo[pdf['id']]['item_name'] += " "+pdf['item_name']
                    }
                });
                var pdfRes = [];
                for(let pdf in pdfInfo){
                    pdfRes.push(pdfInfo[pdf]);
                }

                if(pdfRes.length>0){
                    pdfRes = pdfRes[0];
                }

                res.json({
                    res: true,
                    data:pdfRes
                });
            });
            conn.release();
        });
    },
    getPdfOtherInfo:(req,res)=>{
        var pool = connPool().pool;
        // 从pool中获取连接(异步,取到后回调)
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }

            let pdf_id = req.query['pdf_id'];
            async.series({
                materialsGet: (callback) => { // 获取pdf信息
                    let getSql = 'SELECT id,experiment_name,issue_year,magazine_name,address,issue_time,author,summary FROM experiment' +
                        ' WHERE id IN (' +
                        ' SELECT experiment_id FROM itemMaterials ' +
                        ' WHERE item_id IN (SELECT item_id FROM itemPdf WHERE pdf_id ='+pdf_id+'))';
                    conn.query(getSql, (err, rs) => {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        callback(null, rs);
                        // conn.release();
                    })
                },
                videoGet: (callback)=>{
                    let getSql = 'SELECT id,video_name,create_time,show_times,star,video_url FROM video' +
                        ' WHERE id IN (' +
                        ' SELECT video_id FROM itemVideo WHERE item_id IN (' +
                        '  SELECT item_id FROM itemPdf WHERE pdf_id='+pdf_id+'))';
                    conn.query(getSql, (err, rs) => {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        callback(null, rs)
                        // conn.release();
                    })
                },
                recGet: (callback)=>{
                    let getSql = 'SELECT id,pdf_name,pdf_url,language,thumb_img FROM pdf WHERE id IN' +
                        ' (SELECT p.id FROM pdf p' +
                        ' LEFT JOIN itemPdf ip ON ip.pdf_id=p.id' +
                        ' JOIN item i ON ip.item_id=i.id' +
                        ' JOIN itemManufacturer imf ON imf.item_id=ip.item_id' +
                        ' WHERE i.id IN (SELECT item_id FROM itemPdf WHERE pdf_id='+pdf_id+')' +
                        ' AND ip.pdf_id !='+pdf_id+') ORDER BY id ASC LIMIT 0,10';
                    // ' ORDER BY id ASC LIMIT '+(page-1)*Common.everyPage+','+Common.everyPage;
                    conn.query(getSql, (err, rs) => {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        async.map(rs,(operation,call)=>{
                            let getBrandSql = 'SELECT item_name,manufacturer_id,manufacturer_sub_id FROM itemPdf ip' +
                                ' JOIN item i ON i.id=ip.item_id' +
                                ' JOIN itemManufacturer imf ON imf.item_id=ip.item_id' +
                                ' WHERE ip.pdf_id='+operation.id;
                            conn.query(getBrandSql, (err, operationItemRs) => {
                                if (err) {
                                    res.send("数据库查询错误。" + err.message);
                                    return;
                                }
                                let operationItemInfo = [];
                                operationItemRs.forEach((item)=>{
                                    if(operationItemInfo[operation.id] == undefined){
                                        operation['manufacturer_id'] = item.manufacturer_id;
                                        operation['manufacturer_sub_id'] = item.manufacturer_sub_id;
                                        operation['item_name'] = "";
                                        operationItemInfo[operation.id] = [];
                                    }
                                    operation['item_name'] += " "+item.item_name;
                                });
                                call(null,operationItemRs);

                            })
                        },(err,result)=>{
                            callback(null, rs);
                        });
                        // conn.release();
                    })
                },
                productGet: (callback) => {
                    let getSql = 'SELECT ig.id,manufacturer_name,agencyName,item_name,goods_name,goods_standard,stock,unit,manufactur_price' +
                        ' sale_price,sales_area,person_name,person_phone,update_time FROM itemGoods ig' +
                        ' JOIN agency a ON a.id=ig.agency_id' +
                        ' JOIN item i ON i.id=ig.item_id' +
                        ' WHERE type_id=0 and ig.item_id IN (SELECT item_id FROM itemPdf WHERE pdf_id='+pdf_id+')';
                    conn.query(getSql, (err, rs) => {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        callback(null, rs)
                        // conn.release();
                    })
                },
                trailProductGet: (callback) => {
                    let getSql = 'SELECT ig.id,manufacturer_name,agencyName,item_name,goods_name,goods_standard,sample_amount,unit,manufactur_price' +
                        ' sale_price,sales_area,person_name,person_phone FROM itemGoods ig' +
                        ' JOIN agency a ON a.id=ig.agency_id' +
                        ' JOIN item i ON i.id=ig.item_id' +
                        ' WHERE type_id=1 and ig.item_id IN (SELECT item_id FROM itemPdf WHERE pdf_id='+pdf_id+')';
                    conn.query(getSql, (err, rs) => {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        callback(null, rs)
                        // conn.release();
                    })
                },
                messageGet: (callback) => {
                    let getSql = 'SELECT im.id,pdf_name,pdf_id,user_id,create_time,type_id,message_content,product_id,user_ip,check_status,parent_id FROM itemMessage im' +
                        ' LEFT JOIN pdf p ON p.id=im.pdf_id WHERE check_status=1 AND parent_id=0 AND pdf_id='+pdf_id;
                    conn.query(getSql, (err, rs) => {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        callback(null,rs);
                    })
                },
            }, (err, results) => {
                var materials = results['materialsGet'];
                var videos = results['videoGet'];
                var recs = results['recGet'];
                var products = results['productGet'];
                var trailProducts = results['trailProductGet'];
                var messages = results['messageGet'];

                res.json({
                    res: true,
                    data:{
                        materialCount:materials.length,
                        videoCount:videos.length,
                        recCount:recs.length,
                        productCount:products.length,
                        trailProductCount:trailProducts.length,
                        messageCount:messages.length
                    }
                });
            });
            conn.release();
        });
    },
    getPdfNoteBook:(req,res)=>{
        var pool = connPool().pool;
        // 从pool中获取连接(异步,取到后回调)
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }

            let pdf_id = req.query['pdf_id'];
            async.series({
                noteBookGet: (callback) => { // 获取pdf信息
                    let getSql = 'SELECT language,pdf_url FROM pdf ' +
                        ' WHERE id='+pdf_id;
                    conn.query(getSql, (err, rs) => {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        callback(null, rs)
                        // conn.release();
                    })
                }
            }, (err, results) => {
                var pdf = results['noteBookGet'];
                if(pdf.length>0){
                    pdf = pdf[0];
                }

                res.json({
                    res: true,
                    data:pdf
                });
            });
            conn.release();
        });
    },
    /**
     * 获取文献
     * @param req
     * @param res
     */
    getMaterials:(req,res)=>{
        var pool = connPool().pool;
        // 从pool中获取连接(异步,取到后回调)
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }

            let pdf_id = req.query['pdf_id'];
            async.series({
                materialsGet: (callback) => { // 获取pdf信息
                    let getSql = 'SELECT e.id,experiment_name,issue_year,magazine_name,address,issue_time,author,summary,material_name FROM experiment e' +
                        ' LEFT JOIN itemMaterials im ON e.id=im.experiment_id' +
                        ' WHERE item_id IN (SELECT item_id FROM itemPdf WHERE pdf_id ='+pdf_id+')';
                    conn.query(getSql, (err, rs) => {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        callback(null, rs);
                        // conn.release();
                    })
                }
            }, (err, results) => {
                var materials = results['materialsGet'];
                console.log(materials);
                var materialsInfo = [];
                materials.forEach((material) => {
                    if(materialsInfo[material['id']] == undefined){
                        materialsInfo[material['id']] = material;
                        materialsInfo[material['id']]['materials'] = [material['material_name']];
                    }else{
                        materialsInfo[material['id']]['materials'].push(material['material_name']);
                    }
                });
                materials = [];
                for(let materialId in materialsInfo){
                    materials.push(materialsInfo[materialId]);
                }

                res.json({
                    res: true,
                    data:materials
                });
            });
            conn.release();
        });
    },
    getVideo:(req,res)=>{
        var pool = connPool().pool;
        // 从pool中获取连接(异步,取到后回调)
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }

            let pdf_id = req.query['pdf_id'];
            async.series({
                videoGet: (callback) => { // 获取pdf信息
                    let getSql = 'SELECT id,video_name,create_time,show_times,star,video_url FROM video' +
                        ' WHERE id IN (' +
                        ' SELECT video_id FROM itemVideo WHERE item_id IN (' +
                        '  SELECT item_id FROM itemPdf WHERE pdf_id='+pdf_id+'))';
                    conn.query(getSql, (err, rs) => {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        callback(null, rs)
                        // conn.release();
                    })
                }
            }, (err, results) => {
                var videos = results['videoGet'];

                res.json({
                    res: true,
                    data:videos
                });
            });
            conn.release();
        });
    },
    getRec:(req,res)=>{
        var pool = connPool().pool;
        // 从pool中获取连接(异步,取到后回调)
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }

            let pdf_id = req.query['pdf_id'];
            async.series({
                pdfGet: (callback) => {
                    /*let getSql = 'SELECT p.id,pdf_name,pdf_url,language,thumb_img,i.item_name,manufacturer_id,manufacturer_sub_id FROM pdf p' +
                        ' LEFT JOIN itemPdf ip ON ip.pdf_id=p.id' +
                        ' JOIN item i ON ip.item_id=i.id' +
                        ' JOIN itemManufacturer imf ON imf.item_id=ip.item_id' +
                        ' WHERE i.id IN (SELECT item_id FROM itemPdf WHERE pdf_id='+pdf_id+') ' +
                        ' AND ip.pdf_id !='+pdf_id;*/
                    let getSql = 'SELECT id,pdf_name,pdf_url,language,thumb_img FROM pdf WHERE id IN' +
                        ' (SELECT p.id FROM pdf p' +
                        ' LEFT JOIN itemPdf ip ON ip.pdf_id=p.id' +
                        ' JOIN item i ON ip.item_id=i.id' +
                        ' JOIN itemManufacturer imf ON imf.item_id=ip.item_id' +
                        ' WHERE i.id IN (SELECT item_id FROM itemPdf WHERE pdf_id='+pdf_id+')' +
                        ' AND ip.pdf_id !='+pdf_id+') ORDER BY id ASC LIMIT 0,10';
                        // ' ORDER BY id ASC LIMIT '+(page-1)*Common.everyPage+','+Common.everyPage;
                    conn.query(getSql, (err, rs) => {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        async.map(rs,(operation,call)=>{
                            let getBrandSql = 'SELECT item_name,manufacturer_id,manufacturer_sub_id FROM itemPdf ip' +
                                ' JOIN item i ON i.id=ip.item_id' +
                                ' JOIN itemManufacturer imf ON imf.item_id=ip.item_id' +
                                ' WHERE ip.pdf_id='+operation.id;
                            conn.query(getBrandSql, (err, operationItemRs) => {
                                if (err) {
                                    res.send("数据库查询错误。" + err.message);
                                    return;
                                }
                                let operationItemInfo = [];
                                operationItemRs.forEach((item)=>{
                                    if(operationItemInfo[operation.id] == undefined){
                                        operation['manufacturer_id'] = item.manufacturer_id;
                                        operation['manufacturer_sub_id'] = item.manufacturer_sub_id;
                                        operation['item_name'] = "";
                                        operationItemInfo[operation.id] = [];
                                    }
                                    operation['item_name'] += " "+item.item_name;
                                });
                                call(null,operationItemRs);

                            })
                        },(err,result)=>{
                            callback(null, rs);
                        });
                        // conn.release();
                    })
                },
                brandGet: (callback)=>{
                    let getSql = 'SELECT id,manuName FROM manufacturer';
                    conn.query(getSql,(err,rs)=>{
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        callback(null, rs)
                    })
                }
            }, (err, results) => {
                var pdfs = results['pdfGet'];
                var brandRes = [];
                results['brandGet'].forEach((brand)=>{
                    brandRes[brand['id']] = brand['manuName'];
                });
                /*var pdfInfo = [];
                var pdfId = [];*/
                pdfs.forEach((pdf)=>{
                    pdf['manuName'] = brandRes[pdf['manufacturer_id']];
                    pdf['manuSubName'] = brandRes[pdf['manufacturer_sub_id']];
                    /*if(pdfInfo[pdf['id']] == undefined){
                        pdfInfo[pdf['id']] = pdf;
                    }else{
                        pdfInfo[pdf['id']]['item_name'] += " "+pdf['item_name']
                    }*/
                });
                /*var pdfRes = [];
                for(let pdf in pdfInfo){
                    pdfRes.push(pdfInfo[pdf]);
                }*/
                res.json({
                    res: true,
                    data:pdfs
                });
            });
            conn.release();
        });
    },
    getProduct:(req,res)=>{
        let pool = connPool().pool;
        // 从pool中获取连接(异步,取到后回调)
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }

            let pdf_id = req.query['pdf_id'];
            async.series({
                productGet: (callback) => {
                    let getSql = 'SELECT ig.id,manufacturer_name,agencyName,item_name,goods_name,goods_standard,stock,unit,manufactur_price' +
                        ' sale_price,sales_area,person_name,person_phone,update_time FROM itemGoods ig' +
                        ' JOIN agency a ON a.id=ig.agency_id' +
                        ' JOIN item i ON i.id=ig.item_id' +
                        ' WHERE type_id=0 and ig.item_id IN (SELECT item_id FROM itemPdf WHERE pdf_id='+pdf_id+')';
                    conn.query(getSql, (err, rs) => {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        callback(null, rs)
                        // conn.release();
                    })
                },
            }, (err, results) => {
                var products = results['productGet'];
                res.json({
                    res: true,
                    data:products
                });
            });
            conn.release();
        });
    },
    getTrailProduct:(req,res)=>{
        var pool = connPool().pool;
        // 从pool中获取连接(异步,取到后回调)
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }

            let pdf_id = req.query['pdf_id'];
            async.series({
                productGet: (callback) => {
                    let getSql = 'SELECT ig.id,manufacturer_name,agencyName,item_name,goods_name,goods_standard,sample_amount,unit,manufactur_price' +
                        ' sale_price,sales_area,person_name,person_phone FROM itemGoods ig' +
                        ' JOIN agency a ON a.id=ig.agency_id' +
                        ' JOIN item i ON i.id=ig.item_id' +
                        ' WHERE type_id=1 and ig.item_id IN (SELECT item_id FROM itemPdf WHERE pdf_id='+pdf_id+')';
                    conn.query(getSql, (err, rs) => {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        callback(null, rs)
                        // conn.release();
                    })
                },
            }, (err, results) => {
                var products = results['productGet'];
                res.json({
                    res: true,
                    data:products
                });
            });
            conn.release();
        });
    },
    getComment:(req,res)=>{
        let pool = connPool().pool;
        // 从pool中获取连接(异步,取到后回调)
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }

            let pdf_id = req.query['pdf_id'];
            let user_ip = req.connection.remoteAddress.replace(/::ffff:/, '')+'-'+Common.md5(req.headers['user-agent']);
            async.series({
                messageGet: (callback) => {
                    let getSql = 'SELECT im.id,pdf_name,pdf_id,user_id,create_time,type_id,message_content,product_id,user_ip,check_status,parent_id FROM itemMessage im' +
                        ' LEFT JOIN pdf p ON p.id=im.pdf_id WHERE check_status IN (0,1) AND parent_id=0 AND pdf_id='+pdf_id;
                    conn.query(getSql, (err, rs) => {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        let messageIds = [];
                        let messRes = [];
                        rs.forEach((message,index)=>{
                            if(message.check_status == 0){
                                if(message.user_ip == user_ip){
                                    message.message_content = "您的留言正在审核";
                                    messRes.push(message);
                                }
                            }else {
                                messRes.push(message);
                                messageIds.push(message.id);
                            }
                        });
                        // 获取得到的评论下面的回复
                        let messageIdIn = "'" + messageIds.join("','") + "'";
                        let childSql = 'SELECT im.id,pdf_id,pdf_name,user_id,create_time,type_id,message_content,product_id,user_ip,check_status,parent_id FROM itemMessage im' +
                            ' LEFT JOIN pdf p ON p.id=im.pdf_id WHERE check_status IN (0,1) AND parent_id IN ('+messageIdIn+')';
                        conn.query(childSql,(err,childRes)=>{
                            if (err) {
                                res.send("数据库查询错误。" + err.message);
                                return;
                            }
                            let mesRes = [];
                            childRes.forEach((message)=>{
                                let addFlag = false;
                                if(message.check_status == 0){
                                    if(message.user_ip == user_ip){
                                        addFlag = true;
                                        message.message_content = "您的留言正在审核";
                                    }
                                }else{
                                    addFlag = true;
                                }
                                if(addFlag) {
                                    if (mesRes[message.parent_id] == undefined) {
                                        mesRes[message.parent_id] = [];
                                    }
                                    mesRes[message.parent_id].push(message);
                                }
                            });

                            messRes.forEach((message)=>{
                                message['reply'] = mesRes[message.id]==undefined?[]:mesRes[message.id];
                            });
                            callback(null,messRes);
                        });
                        // conn.release();
                    })
                },
            }, (err, results) => {
                var products = results['messageGet'];
                res.json({
                    res: true,
                    data:products
                });
            });
            conn.release();
        });
    },
    issueComment:(req,res)=>{
        let pool = connPool().pool;
        // 从pool中获取连接(异步,取到后回调)
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }

            let pdfId = req.body['pdf_id'];
            let userId = 1;
            let createTime = sd.format(new Date(), "YYYY-MM-DD HH:mm:ss");
            let typeId = req.body['type_id'];
            let messageContent = req.body['message_content'];
            let productId = 1;
            let userIp = req.connection.remoteAddress.replace(/::ffff:/, '')+'-'+Common.md5(req.headers['user-agent']);
            let parent_id = req.body['parent_id'];
            let addMessageSql = "INSERT INTO itemMessage(pdf_id,user_id,create_time,type_id,message_content,product_id,user_ip,parent_id)" +
                " VALUES (?,?,?,?,?,?,?,?)";
            conn.query(addMessageSql, [pdfId,userId,createTime,typeId,messageContent,productId,userIp,parent_id],(err, rs) => {
                if (err) {
                    res.json({
                        res:false,
                        msg:"数据库查询错误"+ err.message
                    });
                    return;
                }
                res.json({
                    res:true,
                    msg:'发表评论成功'
                })
                // conn.release();
            });
            conn.release();
        });
    },
    sharePdf:(req,res)=>{
        let pool = connPool().pool;
        // 从pool中获取连接(异步,取到后回调)
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }

            let pdf_id = req.body['pdf_id'];
            let collectSql = "UPDATE pdf SET share_num=share_num+1 WHERE id=?";
            conn.query(collectSql, [pdf_id],(err, rs) => {
                if (err) {
                    res.send("数据库查询错误。" + err.message);
                    return;
                }
                res.json({
                    res:true,
                    msg:'收藏成功'
                })
                // conn.release();
            });
            let operation_time = sd.format(new Date(), "YYYY-MM-DD HH:mm:ss");
            let user_ip = req.connection.remoteAddress.replace(/::ffff:/, '')+'-'+Common.md5(req.headers['user-agent']);
            let addSql = "INSERT INTO operation(pdf_id,operation_type,operation_time,user_ip,user_id) VALUES (?,?,?,?,?)";
            conn.query(addSql,[pdf_id,3,operation_time,user_ip,1],(err,rs)=>{

            });
            conn.release();
        });
    },
    /**
     * 收藏pdf
     * @param req
     * @param res
     */
    collectPdf:(req,res)=>{
        let pool = connPool().pool;
        // 从pool中获取连接(异步,取到后回调)
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }

            let pdf_id = req.body['pdf_id'];
            let collectSql = "UPDATE pdf SET collection_num=collection_num+1 WHERE id=?";
            conn.query(collectSql, [pdf_id],(err, rs) => {
                if (err) {
                    res.send("数据库查询错误。" + err.message);
                    return;
                }
                res.json({
                    res:true,
                    msg:'收藏成功'
                })
                // conn.release();
            });
            let operation_time = sd.format(new Date(), "YYYY-MM-DD HH:mm:ss");
            let user_ip = req.connection.remoteAddress.replace(/::ffff:/, '')+'-'+Common.md5(req.headers['user-agent']);
            let addSql = "INSERT INTO operation(pdf_id,operation_type,operation_time,user_ip,user_id) VALUES (?,?,?,?,?)";
            conn.query(addSql,[pdf_id,2,operation_time,user_ip,1],(err,rs)=>{

            });
            conn.release();
        });
    },
    /**
     * 取消收藏
     * @param req
     * @param res
     */
    cancelCollect:(req,res)=>{
        var pool = connPool().pool;
        // 从pool中获取连接(异步,取到后回调)
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }

            let pdf_id = req.body['pdf_id'];
            let collectSql = "UPDATE pdf SET collection_num=collection_num-1 WHERE id=?";
            conn.query(collectSql, [pdf_id],(err, rs) => {
                if (err) {
                    res.send("数据库查询错误。" + err.message);
                    return;
                }
                res.json({
                    res:true,
                    msg:'取消收藏成功'
                });
                // conn.release();
            });
            let user_ip = req.connection.remoteAddress.replace(/::ffff:/, '')+'-'+Common.md5(req.headers['user-agent']);
            let deleteSql = "DELETE FROM operation WHERE pdf_id=? AND user_ip=?";
            conn.query(deleteSql,[pdf_id,user_ip],(err,rs)=>{

            });
            conn.release();
        });
    },
    checkIsCollect:(req,res)=>{
        var pool = connPool().pool;
        // 从pool中获取连接(异步,取到后回调)
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }

            let pdf_id = req.query['pdf_id'];
            let user_ip = req.connection.remoteAddress.replace(/::ffff:/, '')+'-'+Common.md5(req.headers['user-agent']);
            let deleteSql = "SELECT count(*) count FROM operation WHERE pdf_id=? AND user_ip=?";
            conn.query(deleteSql,[pdf_id,user_ip],(err,rs)=>{
                if (err) {
                    res.json({
                        res:false,
                        msg:"数据库查询错误。" + err.message
                    });
                    return;
                }
                res.json({
                    res:true,
                    data:rs[0].count
                })
            });
            conn.release();
        });
    },
    getCollect:(req,res)=>{
        var pool = connPool().pool;
        // 从pool中获取连接(异步,取到后回调)
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }

            let searchByValue = req.query['value']==undefined?'':req.query['value'];
            let user_ip = req.connection.remoteAddress.replace(/::ffff:/, '')+'-'+Common.md5(req.headers['user-agent']);
            async.series({
                pdfGet: (callback) => {
                    let getSql = 'SELECT p.id,pdf_name,pdf_url,language,thumb_img,i.item_name,manufacturer_id,manufacturer_sub_id FROM pdf p' +
                        ' LEFT JOIN itemPdf ip ON ip.pdf_id=p.id' +
                        ' JOIN item i ON ip.item_id=i.id' +
                        ' JOIN itemManufacturer imf ON imf.item_id=ip.item_id' +
                        ' WHERE p.id IN (SELECT pdf_id FROM operation WHERE user_ip="'+user_ip+'" AND operation_type=2)' +
                        ' AND (item_name LIKE "%'+searchByValue+'%" OR pdf_name LIKE "%'+searchByValue+'%" OR txt LIKE "%'+searchByValue+'%")';
                    conn.query(getSql, (err, rs) => {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        callback(null, rs)
                        // conn.release();
                    })
                },
                brandGet: (callback)=>{
                    let getSql = 'SELECT id,manuName FROM manufacturer';
                    conn.query(getSql,(err,rs)=>{
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        callback(null, rs)
                    })
                }
            }, (err, results) => {
                var pdfs = results['pdfGet'];
                var brandRes = [];
                results['brandGet'].forEach((brand)=>{
                    brandRes[brand['id']] = brand['manuName'];
                });
                var pdfInfo = [];
                var pdfId = [];
                pdfs.forEach((pdf)=>{
                    pdf['manuName'] = brandRes[pdf['manufacturer_id']];
                    pdf['manuSubName'] = brandRes[pdf['manufacturer_sub_id']];
                    if(pdfInfo[pdf['id']] == undefined){
                        pdfInfo[pdf['id']] = pdf;
                    }else{
                        pdfInfo[pdf['id']]['item_name'] += " "+pdf['item_name']
                    }
                });
                var pdfRes = [];
                for(let pdf in pdfInfo){
                    pdfRes.push(pdfInfo[pdf]);
                }
                res.json({
                    res: true,
                    data:pdfRes
                });
            });
            conn.release();
        });
    },
    getMyOperation:(req,res)=>{
        var pool = connPool().pool;
        // 从pool中获取连接(异步,取到后回调)
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }

            let user_ip = req.connection.remoteAddress.replace(/::ffff:/, '')+'-'+Common.md5(req.headers['user-agent']);
            let operation_type = req.query['type']?req.query['type']:'';
            let selectedTime = req.query['selected_time']?req.query['selected_time']:'';
            console.log(selectedTime);
            async.series({
                pdfGet: (callback) => {
                    let getSql = '';
                    if(operation_type == '') {
                        getSql = 'SELECT p.id,pdf_name,operation_time,operation_type,pdf_url,language,thumb_img FROM operation o' +
                            ' JOIN pdf p ON p.id=o.pdf_id WHERE user_ip="' + user_ip + '"';
                    }else{
                        getSql = 'SELECT p.id,pdf_name,operation_time,operation_type,pdf_url,language,thumb_img FROM operation o' +
                            ' JOIN pdf p ON p.id=o.pdf_id WHERE operation_type='+operation_type+' AND user_ip="' + user_ip + '"';
                    }
                    let where = '';
                    if(selectedTime != ''){
                        where = ' AND operation_time>="'+selectedTime+'"';
                    }

                    getSql += where;

                    conn.query(getSql, (err, rs) => {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        async.map(rs,(operation,call)=>{
                            let getBrandSql = 'SELECT item_name,manufacturer_id,manufacturer_sub_id FROM itemPdf ip' +
                                ' JOIN item i ON i.id=ip.item_id' +
                                ' JOIN itemManufacturer imf ON imf.item_id=ip.item_id' +
                                ' WHERE ip.pdf_id='+operation.id;
                            conn.query(getBrandSql, (err, operationItemRs) => {
                                if (err) {
                                    res.send("数据库查询错误。" + err.message);
                                    return;
                                }
                                let operationItemInfo = [];
                                operationItemRs.forEach((item)=>{
                                    if(operationItemInfo[operation.id] == undefined){
                                        operation['manufacturer_id'] = item.manufacturer_id;
                                        operation['manufacturer_sub_id'] = item.manufacturer_sub_id;
                                        operation['item_name'] = "";
                                        operationItemInfo[operation.id] = [];
                                    }
                                    operation['item_name'] += " "+item.item_name;
                                });
                                call(null,operationItemRs);

                            })
                        },(err,result)=>{
                            callback(null, rs)
                        });
                        // conn.release();
                    })
                },
                brandGet: (callback)=>{
                    let getSql = 'SELECT id,manuName FROM manufacturer';
                    conn.query(getSql,(err,rs)=>{
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        callback(null, rs)
                    })
                }
            }, (err, results) => {
                var pdfs = results['pdfGet'];
                var brandRes = [];
                results['brandGet'].forEach((brand)=>{
                    brandRes[brand['id']] = brand['manuName'];
                });
                pdfs.forEach((pdf)=>{
                    pdf['manuName'] = brandRes[pdf['manufacturer_id']];
                    pdf['manuSubName'] = brandRes[pdf['manufacturer_sub_id']];
                });
                res.json({
                    res: true,
                    data:pdfs
                });
            });
            conn.release();
        });
    },
    getMyTrailProduct:(req,res)=>{
        var pool = connPool().pool;
        // 从pool中获取连接(异步,取到后回调)
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }

            let user_ip = req.connection.remoteAddress.replace(/::ffff:/, '')+'-'+Common.md5(req.headers['user-agent']);
            async.series({
                productGet: (callback) => {
                    let getSql = 'SELECT id,apply_time,manufacturer_name,product_name,agency_name,item_name,goods_standard,sample_amount,unit,manufactur_price' +
                        ' sale_price,sales_area FROM itemApply' +
                        ' WHERE user_ip="'+user_ip+'"';
                    conn.query(getSql, (err, rs) => {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        callback(null, rs)
                        // conn.release();
                    })
                },
            }, (err, results) => {
                var products = results['productGet'];
                res.json({
                    res: true,
                    data:products
                });
            });
            conn.release();
        });
    },
    /**
     * 申请试用品
     * @param req
     * @param res
     */
    applyTrailProduct:(req,res)=>{
        let pool = connPool().pool;
        // 从pool中获取连接(异步,取到后回调)
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }

            let userName = req.body['user_name'];
            let userPhone = req.body['user_phone'];
            let userAddress = req.body['user_address'];
            let userCompany = req.body['user_company'];
            let userEmail = req.body['user_email'];
            let productName = req.body['product_name'];
            let userIp = req.connection.remoteAddress.replace(/::ffff:/, '')+'-'+Common.md5(req.headers['user-agent']);
            let applyTime = sd.format(new Date(), "YYYY-MM-DD HH:mm:ss");
            let itemName = req.body['item_name'];
            let agencyName = req.body['agency_name'];
            let sampleAmount = req.body['sample_amount'];
            let unit = req.body['unit'];
            let salePrice = req.body['sale_price'];
            let salesArea = req.body['sales_area'];
            let goodsStandard = req.body['goods_standard'];
            let manufacturPrice = req.body['manufactur_price'];
            let manufacturerName = req.body['manufacturer_name'];
            let collectSql = "INSERT INTO itemApply(" +
                "user_name,user_phone,user_address,user_company,user_email,apply_time,product_name,user_ip," +
                "item_name,agency_name,sample_amount,unit,sale_price,sales_area,goods_standard,manufactur_price,manufacturer_name" +
                ")" +
                " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";
            conn.query(collectSql, [userName,userPhone,userAddress,userCompany,userEmail,applyTime,productName,userIp,itemName,agencyName,sampleAmount,unit,salePrice,salesArea,goodsStandard,manufacturPrice,manufacturerName],(err, rs) => {
                if (err) {
                    res.json({
                        res:false,
                        msg:"数据库查询错误"+ err.message
                    });
                    return;
                }
                res.json({
                    res:true,
                    msg:'申请成功'
                })
                // conn.release();
            });
            conn.release();
        });
    },
    /**
     * 增加视频播放次数
     * @param req
     * @param res
     */
    addPlayTimes:(req,res)=>{
        let pool = connPool().pool;
        // 从pool中获取连接(异步,取到后回调)
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }

            let video_id = req.body['video_id'];
            let collectSql = "UPDATE video SET show_times=show_times+1 WHERE id=?";
            conn.query(collectSql, [video_id],(err, rs) => {
                if (err) {
                    res.send("数据库查询错误。" + err.message);
                    return;
                }
                res.json({
                    res:true,
                    msg:'增加成功'
                })
                // conn.release();
            });
            conn.release();
        });
    },

};