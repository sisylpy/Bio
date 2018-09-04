var connPool = require("./ConnPool");
var LoginBean = require("../jsBean/LoginBean");
var CommonBean = require('../jsBean/CommonBean');
var Promise = require('promise');
var async = require('async');
// var await = require('await');
var Q = require('q');

let Common = new CommonBean();


module.exports = {
    /**
     * 显示品牌列表
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
                brandGet:(callback)=>{
                    let brandSql = 'SELECT id,manuName from manufacturer ORDER BY manuName '+order+' LIMIT '+(currentPage-1)*Common.everyPage+','+Common.everyPage;
                    conn.query(brandSql, function (err, rs) {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        async.map(rs,(brand,call)=>{
                            brand['e_count'] = 0;
                            brand['z_count'] = 0;
                            let pdfSql = 'SELECT manufacturer_id,manufacturer_sub_id,p.id pdf_id,language FROM itemManufacturer im' +
                                ' JOIN itemPdf ip ON im.item_id = ip.item_id' +
                                ' JOIN pdf p ON p.id=ip.pdf_id' +
                                ' WHERE im.manufacturer_id = '+brand.id+' OR manufacturer_sub_id = '+brand.id+' GROUP BY manufacturer_id,manufacturer_sub_id,pdf_id,language';
                            conn.query(pdfSql,(err , pdfRes)=>{
                                if (err) {
                                    res.send("数据库查询错误。" + err.message);
                                    return;
                                }
                                pdfRes.forEach((pdf)=>{
                                    if(pdf.language == 0){
                                        brand['e_count'] ++;
                                    }else{
                                        brand['z_count'] ++;
                                    }
                                })
                                call(null,brand);
                            });
                        },(err,results)=>{
                            callback(null,rs);
                        })

                        // conn.release();
                    });
                },
                agencyGet:(callback)=>{
                    let agencySql = 'SELECT id,agencyName,agencyStatus FROM agency ORDER BY agencyName '+order+' LIMIT '+(currentPage-1)*Common.everyPage+','+Common.everyPage;
                    conn.query(agencySql, function (err, rs) {
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        async.map(rs,(agency,call)=>{
                            agency['goods_count'] = 0;
                            let goodsSql = 'SELECT count(id) count FROM itemGoods WHERE type_id=0 AND agency_id=?';
                            conn.query(goodsSql,[agency.id],(err,goodsRes)=>{
                                if (err) {
                                    res.send("数据库查询错误。" + err.message);
                                    return;
                                }
                                agency['goods_count'] = goodsRes[0].count;
                                call(null,agency);
                            });
                        },(err,results)=>{
                            callback(null,rs);
                        });
                        // conn.release();
                    });
                },
                totalBrand:(callback)=>{
                    let brandCountSql = 'SELECT count(*) count FROM manufacturer';
                    conn.query(brandCountSql,(err,rs)=>{
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        callback(null,rs);
                    })
                },
                totalAgency:(callback)=>{
                    let agencyCountSql = 'SELECT count(*) count FROM agency';
                    conn.query(agencyCountSql,(err,rs)=>{
                        if (err) {
                            res.send("数据库查询错误。" + err.message);
                            return;
                        }
                        callback(null,rs);
                    })
                }
            },(err,results)=>{
                let type = req.query.type == undefined ? 0 : req.query.type;
                let brandRes = type==0 ? results['brandGet'] : [];
                let agencyRes = type==1 ? results['agencyGet'] : [];
                let totalBrand = type==0 ? results['totalBrand'][0].count : 0;
                let totalAgency = type==1 ? results['totalAgency'][0].count : 0;
                let pageList = [];
                let length = type == 0 ? totalBrand : totalAgency;
                for(let index = 0; index<Math.ceil(length/Common.everyPage); index++){
                    pageList.push(index+1);
                }
                let totalPage = pageList[pageList.length-1];
                pageList = Common.getPageList(currentPage,pageList);  // 获取显示的列表码

                // 处理品牌和经销商 统计货号数量
                async.series({
                    statisticItemBrand:(callItem)=>{
                        async.map(brandRes,(brand,call)=>{
                            brand['item_count'] = 0;
                            let statisticSql = 'SELECT count(item_id) count FROM itemManufacturer' +
                                ' WHERE manufacturer_id = '+brand.id+' OR manufacturer_sub_id = '+brand.id;
                            conn.query(statisticSql,(err , statisticRes)=>{
                                if (err) {
                                    res.send("数据库查询错误。" + err.message);
                                    return;
                                }
                                brand['item_count'] = statisticRes[0].count;
                                call(null,brand);
                            });
                        },(err,results)=>{
                            callItem(null,brandRes);
                        })
                    },
                    statisticItemAgency:(callItem)=>{
                        async.map(agencyRes,(agency,call)=>{
                            agency['item_count'] = 0;
                            let statisticSql = 'SELECT count(item_id) count FROM itemGoods' +
                                ' WHERE agency_id = '+agency.id;
                            conn.query(statisticSql,(err , statisticRes)=>{
                                if (err) {
                                    res.send("数据库查询错误。" + err.message);
                                    return;
                                }
                                agency['item_count'] = statisticRes[0].count;
                                call(null,agency);
                            });
                        },(err,results)=>{
                            callItem(null,agencyRes);
                        })
                    }
                },(err,result)=>{
                    res.render('brand', {
                        brandRes: brandRes,
                        agencyRes:agencyRes,
                        pageList:pageList,
                        currentPage:currentPage,
                        totalPage:totalPage,
                        type:type,
                        channel: 'brand'
                    });
                });
            });
            conn.release();
        });
    },

    /**
     * 添加品牌
     */
    addBrand: (req, res) => {
        let pool = connPool().pool;
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }
            let brandName = req.body.brand_name;
            // 首先判断品牌名称是否重复
            let checkMulti = "SELECT count(*) count FROM manufacturer WHERE manuName=?";
            conn.query(checkMulti, [brandName], (err, checkRes) => {
                if (err) {
                    res.json({
                        res: false,
                        msg: err.message,
                    });
                    return;
                }
                console.log(checkRes);
                console.log('check');
                if (checkRes[0].count > 0) {
                    res.json({
                        res: false,
                        msg: "品牌名称已经存在，不能添加！",
                    });
                    return;
                } else {
                    let brandSql = "INSERT INTO manufacturer (manuName) values(?)";
                    conn.query(brandSql, [brandName], (err, rs) => {
                        if (err) {
                            res.json({
                                res: false,
                                msg: err.message,
                            })
                            return;
                        }
                        res.json({
                            res: true,
                            msg: '添加成功',
                        });
                    });
                }
            });
            conn.release();
        });
    },


    /**
     * 修改品牌
     * @param req
     * @param res
     */
    modify:(req,res)=>{
        let pool = connPool().pool;
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }
            let brandId = req.body.brand_id;
            let brandName = req.body.brand_name;
            let brandSql = 'UPDATE manufacturer SET manuName=? WHERE id=?';
            conn.query(brandSql, [brandName,brandId],function (err, rs) {
                if (err) {
                    res.json({
                        res:false,
                        msg:'更新失败'
                    })
                }
                res.json({
                    res:true,
                    msg:"更新成功"
                })
                // conn.release();
            });
            conn.release();
        });
    },

    /**
     * 删除品牌
     * @param req
     * @param res
     */
    delete:(req,res)=>{
        let pool = connPool().pool;
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }
            let brandId = req.body.brand_id;
            let brandSql = 'DELETE FROM manufacturer WHERE id=?';
            conn.query(brandSql, [brandId],function (err, rs) {
                if (err) {
                    res.json({
                        res:false,
                        msg:'删除失败'
                    })
                }
                res.json({
                    res:true,
                    msg:"删除成功"
                })
                // conn.release();
            });
            conn.release();
        });
    },


};