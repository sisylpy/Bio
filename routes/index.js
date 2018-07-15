var express = require('express');
var router = express.Router();
var BrandModel = require('../models/BrandModel');

/* GET home page. */
router.get('/', function(req, res, next) {
    BrandModel.show(req,res);
});

router.get('/item', function(req, res, next) {

  res.render('item');
});

//
// router.get('/myCollections', function(req, res, next) {
//
//   res.render('myCollections');
// });
//
//
// router.get('/myOperation', function(req, res, next) {
//
//   res.render('myOperation');
// });
//
//
// router.get('/mySamples', function(req, res, next) {
//
//   res.render('mySamples');
// });


router.get('/admin', function(req, res, next) {

  res.render('admin');
});






module.exports = router;
