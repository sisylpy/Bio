var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var favicon = require('serve-favicon');
var bodyParser = require('body-parser');
var session = require('express-session');

var indexRouter = require('./routes/index');
var adminRouter = require('./routes/admin');
var apiRouter = require('./routes/api');


var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
var allowCrossDomain = function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');//自定义中间件，设置跨域需要的响应头。
    next();
};
app.use(allowCrossDomain);
app.use(logger('dev'));

// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({extended: false}));
//

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(bodyParser({uploadDir: './uploadtemp'}));//设置上传临时文件夹
app.use(cookieParser());
app.use(session({
  secret: 'recommand 128 bytes random string', // 建议使用 128 个字符的随机字符串
  cookie: {maxAge: 20 * 60 * 1000}, //cookie生存周期20*60秒
  resave: true,  //cookie之间的请求规则,假设每次登陆，就算会话存在也重新保存一次
  saveUninitialized: true //强制保存未初始化的会话到存储器
}));
app.use(bodyParser({uploadDir:'./uploadtemp'}));//设置上传临时文件夹
//在与app.js同目录下创建uploadtemp文件夹







app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/admin',adminRouter);
app.use('/api',apiRouter);





// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});




module.exports = app;
