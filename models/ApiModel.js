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


    /**
     * pdf列表
     * todo
     */
    getPdfORI: (req, res) => {
        var pool = connPool().pool;
        // 从pool中获取连接(异步,取到后回调)
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }
            let searchByValue = req.query['value'] == undefined ? '' : req.query['value'];
            let page = req.query['page'] == undefined ? 1 : req.query['page'];
            async.series({
                pdfGet: (callback) => {
                    let getSql = 'SELECT id,pdf_name,pdf_url,language,thumb_img FROM pdf WHERE id IN' +
                        ' (SELECT p.id FROM pdf p' +
                        ' LEFT JOIN itemPdf ip ON ip.pdf_id=p.id' +
                        ' JOIN item i ON ip.item_id=i.id' +
                        ' JOIN itemManufacturer imf ON imf.item_id=ip.item_id' +
                        ' WHERE i.item_name like "%' + searchByValue + '%" OR p.pdf_name like "%' + searchByValue + '%"' +
                        ' OR p.txt like "%' + searchByValue + '%") ORDER BY id ASC LIMIT ' + (page - 1) * Common.everyPage + ',' + Common.everyPage;

                    conn.query(getSql, (err, rs) => {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        async.map(rs, (operation, call) => {
                            let getBrandSql = 'SELECT english_tag,chinese_tag,experiment_tag,video_tag,stock_tag,samples_tag,message_tag, item_name,manufacturer_id,manufacturer_sub_id FROM itemPdf ip' +
                                ' JOIN item i ON i.id=ip.item_id' +
                                ' JOIN itemManufacturer imf ON imf.item_id=ip.item_id' +
                                ' WHERE ip.pdf_id=' + operation.id;
                            conn.query(getBrandSql, (err, operationItemRs) => {
                                if (err) {
                                    res.send("数据库查询错误。" + err.message);
                                    return;
                                }
                                let operationItemInfo = [];
                                console.log('/********');
                                console.log('operationItemRS');
                                console.log(operationItemRs);
                                operationItemRs.forEach((item) => {
                                    if (operationItemInfo[operation.id] == undefined) {
                                        operation['manufacturer_id'] = item.manufacturer_id;
                                        operation['manufacturer_sub_id'] = item.manufacturer_sub_id;
                                        operation['item_name'] = "";
                                        operationItemInfo[operation.id] = [];
                                    }
                                    console.log('operItemInfo---B');
                                    console.log(operationItemInfo);
                                    console.log('operItemInfo---O');
                                    operation['item_name'] += " " + item.item_name;
                                });
                                call(null, operationItemRs);

                            })
                        }, (err, result) => {
                            console.log('$$$$$======>>>> pdfGet');
                            console.log(rs);
                            callback(null, rs);
                        });
                        // conn.release();
                    })
                },
                brandGet: (callback) => {
                    let getSql = 'SELECT id,manuName FROM manufacturer';
                    conn.query(getSql, (err, rs) => {
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
                results['brandGet'].forEach((brand) => {
                    brandRes[brand['id']] = brand['manuName'];
                });
                pdfs.forEach((pdf) => {
                    pdf['manuName'] = brandRes[pdf['manufacturer_id']];
                    pdf['manuSubName'] = brandRes[pdf['manufacturer_sub_id']];
                });

                // 获取pdf下面的视频 文献 现货 试用品 留言
                async.map(pdfs, (pdf, callback) => {
                    async.series({
                        materialsGet: (callfunc) => { // 获取pdf信息
                            let getSql = 'SELECT id,experiment_name,issue_year,magazine_name,address,issue_time,author,summary FROM experiment' +
                                ' WHERE id IN (' +
                                ' SELECT experiment_id FROM itemMaterials ' +
                                ' WHERE item_id IN (SELECT item_id FROM itemPdf WHERE pdf_id =' + pdf.id + '))';
                            conn.query(getSql, (err, rs) => {
                                if (err) {
                                    res.send("数据库查询错误。" + err.message);
                                    return;
                                }
                                callfunc(null, rs);
                                // conn.release();
                            })
                        },
                        videoGet: (callfunc) => {
                            let getSql = 'SELECT id,video_name,create_time,show_times,star,video_url FROM video' +
                                ' WHERE id IN (' +
                                ' SELECT video_id FROM itemVideo WHERE item_id IN (' +
                                '  SELECT item_id FROM itemPdf WHERE pdf_id=' + pdf.id + '))';
                            conn.query(getSql, (err, rs) => {
                                if (err) {
                                    res.send("数据库查询错误。" + err.message);
                                    return;
                                }
                                callfunc(null, rs)
                                // conn.release();
                            })
                        },
                        recGet: (callfunc) => {
                            let getSql = 'SELECT id,pdf_name,pdf_url,language,thumb_img FROM pdf WHERE id IN' +
                                ' (SELECT p.id FROM pdf p' +
                                ' LEFT JOIN itemPdf ip ON ip.pdf_id=p.id' +
                                ' JOIN item i ON ip.item_id=i.id' +
                                ' JOIN itemManufacturer imf ON imf.item_id=ip.item_id' +
                                ' WHERE i.id IN (SELECT item_id FROM itemPdf WHERE pdf_id=' + pdf.id + ')' +
                                ' AND ip.pdf_id !=' + pdf.id + ') ORDER BY id ASC LIMIT 0,10';
                            // ' ORDER BY id ASC LIMIT '+(page-1)*Common.everyPage+','+Common.everyPage;
                            conn.query(getSql, (err, rs) => {
                                if (err) {
                                    res.send("数据库查询错误。" + err.message);
                                    return;
                                }
                                async.map(rs, (operation, call) => {
                                    let getBrandSql = 'SELECT item_name,manufacturer_id,manufacturer_sub_id FROM itemPdf ip' +
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
                                                operation['manufacturer_id'] = item.manufacturer_id;
                                                operation['manufacturer_sub_id'] = item.manufacturer_sub_id;
                                                operation['item_name'] = "";
                                                operationItemInfo[operation.id] = [];
                                            }
                                            operation['item_name'] += " " + item.item_name;
                                        });
                                        call(null, operationItemRs);

                                    })
                                }, (err, result) => {
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
                                ' WHERE type_id=0 and ig.item_id IN (SELECT item_id FROM itemPdf WHERE pdf_id=' + pdf.id + ')';
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
                                ' WHERE type_id=1 and ig.item_id IN (SELECT item_id FROM itemPdf WHERE pdf_id=' + pdf.id + ')';
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
                                ' LEFT JOIN pdf p ON p.id=im.pdf_id WHERE check_status=1 AND parent_id=0 AND pdf_id=' + pdf.id;
                            conn.query(getSql, (err, rs) => {
                                if (err) {
                                    res.send("数据库查询错误。" + err.message);
                                    return;
                                }
                                callfunc(null, rs);
                            })
                        },
                    }, (err, result) => {
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

                        callback(null, pdf);
                    })
                }, (err, results) => {
                    res.json({
                        res: true,
                        data: pdfs
                    });
                });
            });
            conn.release();
        });
    },

    getPdf: (req, res) => {

        var pool = connPool().pool;
        // 从pool中获取连接(异步,取到后回调)
        pool.getConnection((err, conn) => {
            let pdfs = [];

            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }
            let page = req.query['page'] == undefined ? 1 : req.query['page'];
            let getSql = 'SELECT  p.id, p.pdf_name, p.pdf_url, p.language, p.thumb_img, p.message_num, p.same_num, p.eng_id, p.chi_id,p.main_id, m.manuName, m2.manuName as sub_manuName  FROM pdf p ' +
                ' LEFT JOIN manufacturer m ON p.brand_id = m.id' +
                ' LEFT JOIN manufacturer m2 ON p.sub_brand_id = m2.id' +
                ' Where main_id = 0' +
                ' ORDER BY click_num DESC LIMIT ' + (page - 1) * Common.everyPage + ',' + Common.everyPage;
            conn.query(getSql,(err,rs) => {
                if (err) {
                    console.log(err);
                    res.send("数据库查询错误。" + err.message);
                    return;
                }

                async.map(rs, (operation, call) => {
                    let getItemSql = 'SELECT experiment_tag,video_tag,stock_tag,samples_tag,item_name FROM itemPdf ip' +
                        ' JOIN item i ON i.id=ip.item_id' +
                        ' WHERE ip.pdf_id=' + operation.id;
                    conn.query(getItemSql, (err, operationItemRs) => {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        let operationItemInfo = [];
                        // 货号对应的tag
                        let experimentCount = 0;
                        let videoCount = 0;
                        let stockCount = 0;
                        let samplesCount = 0;

                        operation['item_name'] = "";
                        operationItemRs.forEach((item) => {
                            // if (operationItemInfo[operation.id] == undefined) {
                            //    // operation['item_name'] = "";
                            //     experimentCount = item.experiment_tag;
                            //     videoCount = item.video_tag;
                            //     stockCount = item.stock_tag;
                            //     samplesCount = item.samples_tag;
                            //     operationItemInfo[operation.id] = [];
                            // }

                            experimentCount = item.experiment_tag;
                            videoCount = item.video_tag;
                            stockCount = item.stock_tag;
                            samplesCount = item.samples_tag;

                            operation['item_name'] += " " + item.item_name;
                            operation['experimentCount'] = item.experiment_tag + experimentCount;
                            operation['videoCount'] = item.video_tag + videoCount;
                            operation['stockCount'] = item.stock_tag + stockCount;
                            operation['samplesCount'] = item.samples_tag + samplesCount;

                        });

                        if(operation.same_num === 1){
                            operation['English'] = 1;
                            operation['Chinese'] = 1;
                            if(operation.language == 0){
                                operation['EnglishId'] = operation.id;
                                operation['ChineseId'] = operation.chi_id;
                            }else {
                                operation['EnglishId'] = operation.eng_id;
                                operation['ChineseId'] = operation.id;
                            }
                        }else if(operation.same_num === 0){
                            if(operation.language == 0){
                                operation['English'] = 1;
                                operation['Chinese'] = 0;
                                operation['EnglishId'] = operation.id;
                                operation['ChineseId'] = null;

                            }else {
                                operation['English'] = 0;
                                operation['Chinese'] = 1;
                                operation['ChineseId'] = operation.id;
                                operation['EnglishId'] = null;

                            }
                        }

                        call(null, operationItemRs);
                    })
                    pdfs.push(operation);

                }, (err, result) => {
                    if(err){
                        res.json({
                            res:false,
                            msg: "查询失败"
                        })
                    }
                    console.log(pdfs);
                    console.log('pdfs------------->getPdfs');
                    res.json({
                        res:true,
                        data:pdfs
                    })
                });
            })
            conn.release();
        });
    },



    searchPdf: (req, res) => {
        let  pool = connPool().pool;
        let pdfs = [];
            pool.getConnection((err, conn) =>{
                if(err){
                    res.send('数据库连接错误。')
                }
                let searchByValue = req.query['value'];
                console.log(searchByValue);
                console.log('searchByValue');
                let page = req.query['page'] == undefined ? 1 : req.query['page'];
                let searchSql = 'SELECT * FROM ' +
                '(SELECT  p.id, p.pdf_name, p.pdf_url, p.language, p.thumb_img, p.message_num, p.same_num, p.eng_id, p.chi_id, m1.manuName, m2.manuName as subManuName  FROM pdf p '+
                ' LEFT JOIN manufacturer m1 ON p.brand_id = m1.id' +
                ' LEFT JOIN manufacturer m2 ON p.sub_brand_id = m2.id' +
                ' WHERE p.id IN' +
                ' (SELECT itemPdf.pdf_id FROM itemPdf WHERE itemPdf.item_id'+
                ' IN (SELECT i.id from  item i where i.item_name LIKE "%'+ searchByValue +'%" )' +
                    ') ' +
                    'AND main_id = 0 '+
                ' ORDER BY click_num DESC LIMIT 99999 )as t1'+
                ' UNION'+
                ' SELECT * FROM'+
                ' (SELECT  p.id, p.pdf_name, p.pdf_url, p.language, p.thumb_img, p.message_num, p.same_num, p.eng_id, p.chi_id, m1.manuName, m2.manuName as subManuName  FROM pdf p '+
                ' LEFT JOIN manufacturer m1 ON p.brand_id = m1.id'+
                ' LEFT JOIN manufacturer m2 ON p.sub_brand_id = m2.id'+
                ' WHERE pdf_name LIKE "%'+ searchByValue +'%"' +
                ' AND main_id = 0 ' +
                ' ORDER BY click_num DESC LIMIT 9999) as t2'+
                ' UNION'+
                ' SELECT * FROM '+
                ' (SELECT  p.id, p.pdf_name, p.pdf_url, p.language, p.thumb_img, p.message_num, p.same_num, p.eng_id, p.chi_id, m1.manuName, m2.manuName as subManuName  FROM pdf p ' +
                ' LEFT JOIN manufacturer m1 ON p.brand_id = m1.id' +
                ' LEFT JOIN manufacturer m2 ON p.sub_brand_id = m2.id' +
                ' LEFT JOIN pdfTxt  ON p.id = pdfTxt.pdf_id' +
                ' WHERE pdfTxt.txt LIKE  "%'+searchByValue +'%" ' +
                ' AND main_id = 0' +
                ' ORDER BY click_num DESC LIMIT 99999 ) as t3';

                conn.query(searchSql,(err,rs) => {
                    if (err) {
                        console.log(err);
                        res.send("数据库查询错误。" + err.message);
                        return;
                    }
                    async.map(rs, (operation, call) => {
                        let getItemSql = 'SELECT experiment_tag,video_tag,stock_tag,samples_tag,item_name FROM itemPdf ip' +
                            ' JOIN item i ON i.id=ip.item_id' +
                            ' WHERE ip.pdf_id=' + operation.id;
                        conn.query(getItemSql, (err, operationItemRs) => {
                            if (err) {
                                res.send("数据库查询错误。" + err.message);
                                return;
                            }
                            let operationItemInfo = [];
                            // 货号对应的tag
                            let experimentCount = 0;
                            let videoCount = 0;
                            let stockCount = 0;
                            let samplesCount = 0;

                            operation['item_name'] = "";
                            operationItemRs.forEach((item) => {
                                // if (operationItemInfo[operation.id] == undefined) {
                                //     operation['item_name'] = "";
                                //     experimentCount = item.experiment_tag;
                                //     videoCount = item.video_tag;
                                //     stockCount = item.stock_tag;
                                //     samplesCount = item.samples_tag;
                                //     operationItemInfo[operation.id] = [];
                                // }

                                experimentCount = item.experiment_tag;
                                videoCount = item.video_tag;
                                stockCount = item.stock_tag;
                                samplesCount = item.samples_tag;

                                operation['item_name'] += " " + item.item_name;
                                operation['experimentCount'] = item.experiment_tag + experimentCount;
                                operation['videoCount'] = item.video_tag + videoCount;
                                operation['stockCount'] = item.stock_tag + stockCount;
                                operation['samplesCount'] = item.samples_tag + samplesCount;

                            });

                            if(operation.same_num === 1){
                                operation['English'] = 1;
                                operation['Chinese'] = 1;
                                if(operation.language == 0){
                                    operation['EnglishId'] = operation.id;
                                    operation['ChineseId'] = operation.chi_id;
                                }else {
                                    operation['EnglishId'] = operation.eng_id;
                                    operation['ChineseId'] = operation.id;
                                }
                            }else if(operation.same_num === 0){
                                if(operation.language == 0){
                                    operation['English'] = 1;
                                    operation['Chinese'] = 0;
                                    operation['EnglishId'] = operation.id;
                                    operation['ChineseId'] = null;

                                }else {
                                    operation['English'] = 0;
                                    operation['Chinese'] = 1;
                                    operation['ChineseId'] = operation.id;
                                    operation['EnglishId'] = null;
                                }
                            }
                            call(null, operationItemRs);
                        })
                        pdfs.push(operation);
                    }, (err, result) => {
                        if(err){
                            res.json({
                                res:false,
                                msg: "查询失败"
                            })
                        }
                        console.log('searchPdfs..==============>>>');
                        console.log(pdfs);
                        res.json({
                            res:true,
                            data:pdfs
                        })
                    });
                })

                conn.release();
            })
        },


    //没用到
    searchPdfOri:(req,res)=>{
        console.log('.......');
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

                console.log(results);
                console.log('=======')
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

    searchPdfo:(req,res)=>{
        console.log('.......');

        var pool = connPool().pool;
        // 从pool中获取连接(异步,取到后回调)
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }
            let searchByValue = req.query['value'];
            console.log(searchByValue);
            async.series({
                itemGet: (callback) => {
                    let getSql = 'SELECT p.id,pdf_name,pdf_url,language,thumb_img,i.item_name,manufacturer_id,manufacturer_sub_id FROM pdf p' +
                        ' LEFT JOIN itemPdf ip ON ip.pdf_id=p.id' +
                        ' JOIN item i ON ip.item_id=i.id' +
                        ' JOIN itemManufacturer imf ON imf.item_id=ip.item_id' +
                        ' WHERE item_name like "%'+searchByValue+'%"';
                    conn.query(getSql, (err, rs) => {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        console.log('^^tiemitemitemitemtiemtmemtmet^^^^');
                        console.log(rs);
                        callback(null, rs)
                        // conn.release();
                    })
                },
                nameGet: (callback) => {
                    let getSql = 'SELECT p.id,pdf_name,pdf_url,language,thumb_img,i.item_name,manufacturer_id,manufacturer_sub_id FROM pdf p' +
                        ' LEFT JOIN itemPdf ip ON ip.pdf_id=p.id' +
                        ' JOIN item i ON ip.item_id=i.id' +
                        ' JOIN itemManufacturer imf ON imf.item_id=ip.item_id' +
                        ' WHERE pdf_name like "%'+searchByValue+'%"';
                    conn.query(getSql, (err, rs) => {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        console.log('^^^^^^^^^^^name^^^^^^^namenamenamenamenanemnan^');
                        console.log(rs);
                        callback(null, rs)
                        // conn.release();
                    })
                },
                txtGet: (callback) => {
                    let getSql = 'SELECT p.id,pdf_name,pdf_url,language,thumb_img,i.item_name,manufacturer_id,manufacturer_sub_id FROM pdf p' +
                        ' LEFT JOIN itemPdf ip ON ip.pdf_id=p.id' +
                        ' JOIN item i ON ip.item_id=i.id' +
                        ' JOIN itemManufacturer imf ON imf.item_id=ip.item_id' +
                        ' WHERE txt like "%'+searchByValue+'%"';
                    conn.query(getSql, (err, rs) => {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        console.log('^^^^^^^^^^^txttxtxtxtx^^^^^^^^');
                        console.log(rs);
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
             //   console.log(results);
               // console.log('====results results results resutls results resutlts results===');
                var type = req.query.type == undefined ? 0 : req.query.type;
               // var pdfs = results['itemGet'];
                var itemRes = results['itemGet'];
                var nameRes = results['nameGet'];
                var txtRes = results['txtGet'];

                var pdfs = [];
                pdfs.push(itemRes,nameRes,txtRes);
               // console.log(pdfs);
              //  console.log('pdfs!@#@$#%@%#$^%$&%^&^%*&^*^&*^((*&*(*))&^*&%^&*%&^$&$&^#$#%#');
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

    // /**
    //  * 点击pdf
    //  */
    // clickPdf: (req, res) => {
    //         let  pool = connPool().pool;
    //         pool.getConnection((err, conn) =>{
    //             if(err) {
    //                 res.send('数据库连接错误。')
    //             }
    //             let pdfId = req.query.pdfId;
    //             let clickSql = "UPDATE pdf SET click_num= click_num+1 WHERE id=? ";
    //                 conn.query(clickSql,[pdfId], (err,rs) =>{
    //
    //
    //             })
    //
    //         })
    //     },

    /**
     * pdf详细页面
     * @param req
     * @param res
     */
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
                    let getSql = 'SELECT p.id,pdf_name,pdf_url,language,thumb_img,i.item_name,manufacturer_id,manufacturer_sub_id, same_num,eng_id,chi_id FROM pdf p' +
                        ' LEFT JOIN itemPdf ip ON ip.pdf_id=p.id' +
                        ' JOIN item i ON ip.item_id=i.id' +
                        ' JOIN itemManufacturer imf ON imf.item_id=ip.item_id' +
                        ' WHERE p.id='+pdf_id;
                    conn.query(getSql, (err, rs) => {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                     //   console.log(rs);
                     //   console.log('has pdf ?');
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
                },
                clickAdd: (callback)=>{
                    let clickSql = 'UPDATE pdf SET click_num=click_num+1 WHERE id= '+pdf_id;
                    conn.query(clickSql,(err,rs)=>{
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        callback(null, rs)
                    })
                },

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

              //  console.log(pdfRes);
              //  console.log('pdfRes');
                res.json({
                    res: true,
                    data:pdfRes
                });
            });
            conn.release();
        });
    },

    getEnglishPdf:(req,res)=>{
        var pool = connPool().pool;
        // 从pool中获取连接(异步,取到后回调)
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }
            let english_id = req.query['english_id'];
            console.log(english_id);
            console.log('english_id......................');
            async.series({
                pdfGet: (callback) => {
                    let getSql = 'SELECT p.id,pdf_name,pdf_url,language,thumb_img,i.item_name,manufacturer_id,manufacturer_sub_id, same_num,eng_id,chi_id FROM pdf p' +
                        ' LEFT JOIN itemPdf ip ON ip.pdf_id=p.id' +
                        ' JOIN item i ON ip.item_id=i.id' +
                        ' JOIN itemManufacturer imf ON imf.item_id=ip.item_id' +
                        ' WHERE p.id='+english_id;
                    conn.query(getSql, (err, rs) => {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        //   console.log(rs);
                        //   console.log('has pdf ?');
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
                },

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

                  console.log(pdfRes);
                  console.log('pdfRes');
                res.json({
                    res: true,
                    data:pdfRes
                });
            });
            conn.release();
        });
    },

    getChinesePdf:(req,res)=>{
        var pool = connPool().pool;
        // 从pool中获取连接(异步,取到后回调)
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }
            let chinese_id = req.query['chinese_id'];
            async.series({
                pdfGet: (callback) => {
                    let getSql = 'SELECT p.id,pdf_name,pdf_url,language,thumb_img,i.item_name,manufacturer_id,manufacturer_sub_id, same_num,eng_id,chi_id FROM pdf p' +
                        ' LEFT JOIN itemPdf ip ON ip.pdf_id=p.id' +
                        ' JOIN item i ON ip.item_id=i.id' +
                        ' JOIN itemManufacturer imf ON imf.item_id=ip.item_id' +
                        ' WHERE p.id='+chinese_id;
                    conn.query(getSql, (err, rs) => {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        //   console.log(rs);
                        //   console.log('has pdf ?');
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
                },

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

                console.log(pdfRes);
                console.log('pdfRes');
                res.json({
                    res: true,
                    data:pdfRes
                });
            });
            conn.release();
        });
    },

    getOnePdfnew: (req, res) => {
        let pdf_id = req.query['pdf_id'];

        var pool = connPool().pool;
        // 从pool中获取连接(异步,取到后回调)
        pool.getConnection((err, conn) => {
            let pdfs = [];

            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }
            let getSql = 'SELECT p.pdf_name, p.pdf_url, p.language, p.thumb_img, p.message_num, p.same_num, p.eng_id, p.chi_id, m.manuName, m2.manuName as sub_manuName  FROM pdf p ' +
                ' LEFT JOIN manufacturer m ON p.brand_id = m.id' +
                ' LEFT JOIN manufacturer m2 ON p.sub_brand_id = m2.id' +
                ' WHERE p.id=' + pdf_id ;
            conn.query(getSql,(err,rs) => {
                if (err) {
                    console.log(err);
                    res.send("数据库查询错误。" + err.message);
                    return;
                }


                let pdf = rs[0];
                let getItemSql = 'SELECT experiment_tag,video_tag,stock_tag,samples_tag,item_name FROM itemPdf ip' +
                    ' JOIN item i ON i.id=ip.item_id' +
                    ' WHERE ip.pdf_id=' + pdf_id;
                conn.query(getItemSql, (err, operationItemRs) => {
                    if (err) {
                        res.send("数据库查询错误。" + err.message);
                        return;
                    }
                    let operationItemInfo = [];
                    // 货号对应的tag
                    let experimentCount = 0;
                    let videoCount = 0;
                    let stockCount = 0;
                    let samplesCount = 0;


                    operationItemRs.forEach((item) => {
                        experimentCount = item.experiment_tag;
                        videoCount = item.video_tag;
                        stockCount = item.stock_tag;
                        samplesCount = item.samples_tag;

                        pdf['item_name'] += " " + item.item_name;
                        pdf['experimentCount'] = item.experiment_tag + experimentCount  + "";
                        pdf['videoCount'] = item.video_tag + videoCount + "";
                        pdf['stockCount'] = item.stock_tag + stockCount + "";
                        pdf['samplesCount'] = item.samples_tag + samplesCount + "";

                    });

                })
                res.json({
                    res: true,
                    data:pdf
                });
            })
            conn.release();
        });
    },


    /**
     * pdf 统计数字
     */
    getPdfOtherInfo:(req,res)=>{
        var pool = connPool().pool;
        // 从pool中获取连接(异步,取到后回调)
        pool.getConnection((err, conn) => {
            if (err) {
                console.log(err);
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }

            let pdf_id = req.query['pdf_id'];
            console.log(pdf_id);
            console.log('pdf_Id');
            async.series({
                languageGet: (callback) =>{
                    let  languageSql = "SELECT language, same_num FROM pdf WHERE id= " + pdf_id;
                    conn.query(languageSql,(err,rs) =>{
                        if(err){console.log(err);}
                        else{
                            if(rs[0].same_num == 1){
                                    rs[0]['English'] = 1;
                                    rs[0]['Chinese'] =1;
                            }
                            else {
                                if(rs[0].language == 0){
                                    rs[0]['English'] = 1;
                                    rs[0]['Chinese'] =0;
                                }else if(rs[0].language == 1) {
                                    rs[0]['English']= 0;
                                    rs[0]['Chinese'] = 1;
                                }
                            }
                        }
                        console.log('mmmmmmmmmm');
                        console.log(rs);
                        callback(null,rs);
                    })     
               
                },
                materialsGet: (callback) => { // 获取pdf信息
                    let getSql = 'SELECT id,experiment_name,issue_year,magazine_name,address,issue_time,author,summary FROM experiment' +
                        ' WHERE id IN (' +
                        ' SELECT experiment_id FROM itemMaterials ' +
                        ' WHERE item_id IN (SELECT item_id FROM itemPdf WHERE pdf_id ='+pdf_id+'))';
                    conn.query(getSql, (err, rs) => {
                        if (err) {
                            console.log(err);
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        console.log(rs);
                        console.log('aaaaa');
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
                            console.log(err);
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
                            console.log(err);
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
                            console.log(err);
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
                            console.log(err);
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
                            console.log(err);
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        callback(null,rs);
                    })
                },
            }, (err, results) => {
                if(err){console.log(err);}
                var language = results['languageGet'];
                var materials = results['materialsGet'];
                var videos = results['videoGet'];
                var recs = results['recGet'];
                var products = results['productGet'];
                var trailProducts = results['trailProductGet'];
                var messages = results['messageGet'];

              //  console.log(language);
             //   console.log('language');
                res.json({
                    res: true,
                    data:{
                        same_num:language[0]['same_num'],
                        English:language[0]['English'],
                        Chinese:language[0]['Chinese'],
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

    /**
     *
     * todo：
     */
    getPdfNoteBook:(req,res)=>{
        var pool = connPool().pool;
        // 从pool中获取连接(异步,取到后回调)
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }
            let pdf_id = req.query['pdf_id'];
            let language = req.query['language'];

            async.series({
                noteBookGet: (callback) => { // 获取pdf信
                     let pdf = {EnglishUrl:"", ChineseUrl:""};
                 var getOtherSql = "SELECT  pdf_url, same_num, eng_id, chi_id FROM pdf WHERE id="+ pdf_id;
                    conn.query(getOtherSql, (err, rs) => {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }

                        if(language == 0){
                            if(rs[0]['same_num']  == 1){
                                pdf['EnglishUrl'] = rs[0]['pdf_url'];
                                let chineseUrlSql = "SELECT pdf_url FROM pdf WHERE id="+rs[0].chi_id;

                                aaa: (callback) =>{},(err, result) =>{}

                                conn.query(chineseUrlSql,(err,chineseRs) =>{
                                    if(err){console.log(err);}
                                    else {
                                      //  console.log(chineseRs);
                                     //   console.log('333333');
                                        pdf['ChineseUrl'] = chineseRs[0]['pdf_url'];
                                    }
                                })
                              //  console.log(pdf);
                             //   console.log('1111');
                            }else{
                              //  console.log('2222');
                            }
                        }


                        callback(null, rs)
                    })
                }
            }, (err, results) => {
                var pdf  = results['noteBookGet'][0];
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
     * 文献
     */
    getExperiment:(req,res)=>{
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

    /**
     * 视频
     */
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


    /** ?
     * todo:
     * 相关产品
     */
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

    /**
     * 现货
     */
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

    /**
     * 试用品
     */
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

    /**
     * 留言
     */
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

    /**
     * 留言-提交
     */
    issueComment:(req,res)=>{
        console.log('ppp0000')
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

    // no use
    // sharePdf:(req,res)=>{
    //     let pool = connPool().pool;
    //     // 从pool中获取连接(异步,取到后回调)
    //     pool.getConnection((err, conn) => {
    //         if (err) {
    //             res.send("获取连接错误,错误原因:" + err.message);
    //             return;
    //         }
    //
    //         let pdf_id = req.body['pdf_id'];
    //         let collectSql = "UPDATE pdf SET share_num=share_num+1 WHERE id=?";
    //         conn.query(collectSql, [pdf_id],(err, rs) => {
    //             if (err) {
    //                 res.send("数据库查询错误。" + err.message);
    //                 return;
    //             }
    //             res.json({
    //                 res:true,
    //                 msg:'收藏成功'
    //             })
    //             // conn.release();
    //         });
    //         let operation_time = sd.format(new Date(), "YYYY-MM-DD HH:mm:ss");
    //         let user_ip = req.connection.remoteAddress.replace(/::ffff:/, '')+'-'+Common.md5(req.headers['user-agent']);
    //         let addSql = "INSERT INTO operation(pdf_id,operation_type,operation_time,user_ip,user_id) VALUES (?,?,?,?,?)";
    //         conn.query(addSql,[pdf_id,3,operation_time,user_ip,1],(err,rs)=>{
    //
    //         });
    //         conn.release();
    //     });
    // },
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

                if(err){console.log(err);}
                else{console.log(rs);}
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

    /**
     * 此用户是否收藏
     */
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
    /**
     * 我的收藏
     */
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
                        console.log(rs);
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
    /**
     * 我的操作
     */
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
    /**
     * 我的试用品
     */
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

            var params = [userName,userPhone,userAddress,userCompany,userEmail,applyTime,productName,userIp,itemName,agencyName,sampleAmount,unit,salePrice,salesArea,goodsStandard,manufacturPrice,manufacturerName]


            console.log(params);
            conn.query(collectSql, params,(err, rs) => {
                if (err) {
                    console.log(err);
                    res.json({
                        res:false,
                        msg:"数据库查询错误"+ err.message
                    });
                    console.log(';;;;;;;;;');
                    console.log(rs);
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
     * 播放视频
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