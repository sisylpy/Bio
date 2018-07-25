/**
 * Created by lipeiyi on 2018/4/11.
 */

var express = require('express');
var AdminModel = require('../models/AdminModel');
var AgencyModel = require('../models/AgencyModel');
var LiteratureModel = require('../models/LiteratureModel');
var ItemModel = require('../models/ItemModel');
var VideoModel = require('../models/VideoModel');
var UsersModel = require('../models/UsersModel');
var BrandModel = require('../models/BrandModel');
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


//后台
router.post('/adminLogin', function (req, res, next) {
  AdminModel.adminLogin(req,res);
});

/**
 * 获取品牌
 */
router.get('/brand',(req,res,next)=>{
    BrandModel.show(req,res);
});

//操作手册
router.all('/pdf', (req, res, next) => {
    AdminModel.getPdf(req, res);
});

/**
 * 搜索品牌
 */
router.get('/searchBrand', (req, res, next) => {
    AdminModel.searchBrand(req, res);
});
/**
 * 添加品牌
 */
router.post('/addBrand', (req, res, next) => {
    BrandModel.addBrand(req, res);
});
/**
 *  修改货号
 */
router.post('/modifyItemName', (req, res, next) => {
    AdminModel.modifyItemName(req, res);
});
/**
 * 修改pdf
 */
router.post('/modifyPdf', (req, res, next) => {
    AdminModel.modifyPdf(req, res);

});
/**
 * 删除pdf
 */
router.delete('/deletePdf', (req, res, next) => {
    AdminModel.deletePdf(req, res);
});
/**
 * 删除货号
 */
router.delete('/deleteItem', (req, res, next) => {
    AdminModel.deleteItem(req, res);
});

/**
 * 删除视频
 */
router.delete('/deleteVideo', (req, res, next) => {
    VideoModel.delete(req, res);
});
/**
 * 删除文献
 */
router.delete('/deleteLiterature', (req, res, next) => {
    LiteratureModel.delete(req, res);
});

/** no use!
 * 删除商品/试用品
 */
// router.delete('/deleteProduct', (req, res, next) => {
    // AgencyModel.deleteProduct(req, res);
// });

/**
 * 新打开添加pdf页面
 */
router.get('/showAddPdf', (req, res, next) => {
    AdminModel.showAddPdf(req, res);
    // res.render('addpdf');
});

/**
 * 上传pdf
 */
router.all('/pdfUpload', upload.single('file'), (req, res, next) => {
    // 文件上传成功以后 将pdf转换为文本
    AdminModel.parsePdf(req, res, webUrl, storagePath);
});

/**
 * 上传视频
 */
router.all('/videoUpload', upload.single('file'), (req, res, next) => {
    VideoModel.add(req, res, webUrl, storagePath);
});

/**
 * 文献页面
 */
router.get('/literature', (req, res, next) => {
    LiteratureModel.show(req, res);
});

/**
 *  添加文献页面
 */
router.get('/addliterature', (req, res, next) => {
    LiteratureModel.showAdd(req,res);
});

/**
 * 视频页面
 */
router.get('/video', (req, res, next) => {
    VideoModel.show(req, res);
});

/**
 * 添加视频页面
 */
router.get('/addvideo', (req, res, next) => {
    VideoModel.showAdd(req,res);
});

/**
 * 获取货号-添加文献，添加视频
 */
router.get('/getItemNumber', (req, res, next) => {
    ItemModel.getNumber(req, res);
});

/**
 * 添加文献
 */
router.post('/addLiterature', (req, res, next) => {
    LiteratureModel.add(req, res);
});

/**
 * 修改文献-打开
 */
router.get('/editliterature',(req,res,next)=>{
    LiteratureModel.showEdit(req,res);
})

/**
 * 修改文献-保存
 */
router.post('/saveliterature',(req,res,next)=>{
    LiteratureModel.editSave(req,res);
})


/**
 * 添加视频
 */
router.post('/addVideo', (req, res, next) => {
    VideoModel.add(req, res);
});
/**
 * 修改文献名称
 */
router.put('/modifyExperimentName', (req, res, next) => {
    LiteratureModel.modifyName(req, res);
});
/**
 * 修改视频名称
 */
router.put('/modifyVideoName', (req, res, next) => {
    VideoModel.modifyName(req, res);
});


/**
 * 添加经销商
 */
router.post('/addAgency', (req, res, next) => {
    AgencyModel.addAgency(req, res);
});

/**
 * 修改经销商名称
 */
router.post('/modifyAgencyName',(req,res,next)=>{
    AgencyModel.modify(req,res);
});

/**
 * 删除经销商
 */
router.delete('/deleteAgency',(req,res,next)=>{
    AgencyModel.delete(req,res);
});

/**
 * 显示商品添加页面
 */
router.get('/showAddProduct', (req, res, next) => {
    let type_id = req.query.type_id;
    res.render('addproduct', {type_id: type_id,channel:'agency'});
});
/**
 * 导入excel商品或者试用品
 */
router.post('/importExcel', upload.single('file'), (req, res, next) => {
    AgencyModel.importExcel(req, res, webUrl, storagePath);
});


/**
 * 货品
 */
router.get('/goods', (req, res, next) => {
    AgencyModel.showGoods(req, res);
});


/** no use
 * 经销商列表
 */
// router.get('/agency', (req, res, next) => {
//     AgencyModel.show(req, res);
// });


/** no use
 * 修改货物名称
 */
// router.post('/modifyProductName', (req, res, next) => {
//     AgencyModel.modifyProductName(req, res);
// });

/** no use
 * 搜索经销商
 */
// router.get('/searchAgency', (req, res, next) => {
//     AgencyModel.searchAgency(req, res);
// });

/**
 * 打印pdf次数
 */
router.post('/printPdf',(req,res,next)=>{
   AdminModel.printPdf(req,res);
});

/**
 * 下载pdf次数
 */
router.post('/downPdf',(req,res,next)=>{
   AdminModel.downloadPdf(req,res);
});

router.get('/users',(req,res,next)=>{
    UsersModel.show(req,res);
});



/**
 * 审核留言
 */
router.post('/checkPassed',(req,res,next)=>{
    UsersModel.checkPassed(req,res);
});

router.post('/checkUnpassed',(req,res,next)=>{
    UsersModel.checkUnPassed(req,res);
});

/**
 * 删除品牌
 */
router.delete('/deleteBrand',(req,res,next)=>{
    BrandModel.delete(req,res);
});

router.put('/modifyBrandName',(req,res,next)=>{
    BrandModel.modify(req,res);
});
module.exports = router;
