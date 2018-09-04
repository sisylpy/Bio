var connPool = require("./ConnPool");
var LoginBean = require("../jsBean/LoginBean");
var Promise = require('promise');
var async = require('async');
// var await = require('await');
var Q = require('q');


module.exports = {
    /**
     * 显示货号列表
     * @param req
     * @param res
     */
    getNumber: (req, res) => {
        let pool = connPool().pool;
        pool.getConnection((err, conn) => {
            if (err) {
                res.send("获取连接错误,错误原因:" + err.message);
                return;
            }
            async.series({
                itemGet: (callback) => {
                    let brandId = req.query.brand_id == undefined ? 0 : req.query.brand_id;
                    let itemSql = 'SELECT im.id,item_name,manufacturer_id,manufacturer_sub_id,english_tag,english_tag,experiment_tag,video_tag,stock_tag,samples_tag,message_tag FROM item im' +
                        ' JOIN itemManufacturer imf ON im.id=imf.item_id' +
                        '  WHERE manufacturer_id =' + brandId + ' or manufacturer_sub_id=' + brandId +
                        ' ORDER BY item_name ASC';
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
                        callback(null, rs);
                    })
                }
            }, (err, results) => {
                let itemRes = results['itemGet'];
                res.json({res:true,itemRes: itemRes});
            });
            conn.release();
        });
    }
};