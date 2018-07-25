/**
 * Created by lipeiyi on 2018/4/11.
 */

var express = require('express');
var ApiModel = require('../models/ApiModel');
var AgencyModel = require('../models/AgencyModel');
var LiteratureModel = require('../models/LiteratureModel');
var ItemModel = require('../models/ItemModel');
var VideoModel = require('../models/VideoModel');
var multer = require('multer');
var router = express.Router();
var sd = require('silly-datetime');

var storagePath = 'public/uploads';
var webUrl = '/uploads';
var storage = multer.diskStorage({
    //设置上传后文件路径，uploads文件夹会自动创建。
    destination: storagePath,
    //给上传文件重命名，获取添加后缀名
    filename: function (req, file, cb) {
        var fileFormat = (file.originalname).split(".");
        cb(null, file.fieldname + '-' + Date.now() + "." + fileFormat[fileFormat.length - 1]);
    }
});

var upload = multer({storage: storage});

/**
 * 获取pdf
 */
router.get('/getPdf',(req,res,next)=>{
    ApiModel.getPdf(req,res);
});
/**
 * 搜索pdf
 */
router.get('/searchPdf',(req,res,next)=>{
    ApiModel.searchPdf(req,res);
});

router.get('/getOnePdf',(req,res,next)=>{
    ApiModel.getOnePdf(req,res);
});
/**
 * 获取手册
 */
router.get('/getPdfNodeBook',(req,res,next)=>{
    ApiModel.getPdfNoteBook(req,res);
});
/**
 * 获取文献
 */
router.get('/getExperiment',(req,res,next)=>{
    ApiModel.getExperiment(req,res);
});
/**
 * 获取相关产品
 */
router.get('/getRec',(req,res,next)=>{
    ApiModel.getRec(req,res);
});
/**
 * 获取视频
 */
router.get('/getVideo',(req,res,next)=>{
    ApiModel.getVideo(req,res);
});
/**
 * 获取商品
 */
router.get('/getProduct',(req,res,next)=>{
    ApiModel.getProduct(req,res);
});

/**
 * 获取试用品
 */
router.get('/getTrailProduct',(req,res,next)=>{
    ApiModel.getTrailProduct(req,res);
});

/**
 * 获取相关产品
 */
router.get('/getRec',(req,res,next)=>{
    ApiModel.getRec(req,res);
});

/**
 * 获取我的收藏
 */
router.get('/getCollect',(req,res,next)=>{
    ApiModel.getCollect(req,res);
});

/**
 * 收藏
 */
router.post('/collectPdf',(req,res,next)=>{
    ApiModel.collectPdf(req,res);
});

/**
 * 取消收藏
 */
router.post('/cancelCollect',(req,res,next)=>{
    ApiModel.cancelCollect(req,res);
});

/**
 * 检测是否收藏
 */
router.get('/checkIsCollect',(req,res,next)=>{
    ApiModel.checkIsCollect(req,res);
});

/**
 * 获取我的操作
 */
router.get('/getMyOperation',(req,res,next)=>{
    ApiModel.getMyOperation(req,res);
});

/**
 * 获取我的试用品
 */
router.get('/getMyTrailProduct',(req,res,next)=>{
    ApiModel.getMyTrailProduct(req,res);
});
/**
 * 获取我的试用品
 */
router.get('/getVideo',(req,res,next)=>{
    ApiModel.getVideo(req,res);
});

/**
 * 获取评论
 */
router.get('/getComment',(req,res,next)=>{
    ApiModel.getComment(req,res);
});
/**
 * 发表评论
 */
router.post('/issueComment',(req,res,next)=>{
    ApiModel.issueComment(req,res);
});
/**
 * 分享
 */
router.post('/sharePdf',(req,res,next)=>{

    ApiModel.sharePdf(req,res);
});
/**
 * 获取pdf其它相关信息  每个条目右边的数字
 */
router.get('/getPdfOtherInfo',(req,res,next)=>{
    ApiModel.getPdfOtherInfo(req,res);
});

/**
 * 申请试用品
 */
router.post('/applyTrailProduct',(req,res,next)=>{

    console.log(req);
    ApiModel.applyTrailProduct(req,res);
});

/**
 * 增加视频播放次数
 */
router.post('/addPlayTimes',(req,res,next)=>{
    ApiModel.addPlayTimes(req,res);
});

module.exports = router;
