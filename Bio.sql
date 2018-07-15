/*
Navicat MySQL Data Transfer

Source Server         : 192.168.0.243
Source Server Version : 50718
Source Host           : 192.168.43.243:3306
Source Database       : Bio

Target Server Type    : MYSQL
Target Server Version : 50718
File Encoding         : 65001

Date: 2018-07-08 19:28:01
*/

SET FOREIGN_KEY_CHECKS=0;

-- ----------------------------
-- Table structure for agency
-- ----------------------------
DROP TABLE IF EXISTS `agency`;
CREATE TABLE `agency` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '经销商id',
  `agencyName` varchar(100) NOT NULL COMMENT '经销商名称',
  `agencyStatus` enum('Y','N') DEFAULT 'Y' COMMENT '经销商状态  Y 营业中   N停业',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8;

-- ----------------------------
-- Table structure for experiment
-- ----------------------------
DROP TABLE IF EXISTS `experiment`;
CREATE TABLE `experiment` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '文献id',
  `experiment_name` varchar(2000) DEFAULT NULL COMMENT '文献名称',
  `issue_year` varchar(2000) DEFAULT NULL COMMENT '发表年份',
  `issue_time` datetime DEFAULT NULL COMMENT '发表时间',
  `magazine_name` varchar(2000) DEFAULT NULL COMMENT '出版物',
  `author` varchar(2000) DEFAULT NULL COMMENT '作者',
  `address` varchar(2000) DEFAULT NULL COMMENT '地址',
  `experiment_result` varchar(2055) DEFAULT NULL COMMENT '实验结果',
  `experiment_method` varchar(2055) DEFAULT NULL COMMENT '实验方法',
  `summary` varchar(2000) DEFAULT NULL COMMENT '摘要',
  `user_id` int(11) DEFAULT NULL COMMENT '添加用户ID',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `userId_idx` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8;

-- ----------------------------
-- Table structure for item
-- ----------------------------
DROP TABLE IF EXISTS `item`;
CREATE TABLE `item` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '货号Id',
  `item_name` varchar(200) DEFAULT NULL COMMENT '货号名称',
  `english_tag` int(11) DEFAULT '0' COMMENT '英文说明书数量',
  `chinese_tag` int(11) DEFAULT '0' COMMENT '中文说明书数量',
  `experiment_tag` int(11) DEFAULT '0' COMMENT '文献数量',
  `video_tag` int(11) DEFAULT '0' COMMENT '视频数量',
  `stock_tag` int(11) DEFAULT '0' COMMENT '库存数量',
  `samples_tag` int(11) DEFAULT '0' COMMENT '试用品数量',
  `message_tag` int(11) DEFAULT '0' COMMENT '评论数量',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=398 DEFAULT CHARSET=utf8 COMMENT='货号表';

-- ----------------------------
-- Table structure for itemApply
-- ----------------------------
DROP TABLE IF EXISTS `itemApply`;
CREATE TABLE `itemApply` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '试用品申请id',
  `item_name` varchar(255) DEFAULT NULL,
  `agency_name` varchar(255) DEFAULT NULL COMMENT '经销商名称',
  `sample_amount` int(11) DEFAULT NULL,
  `unit` varchar(255) DEFAULT NULL,
  `sale_price` int(11) DEFAULT NULL,
  `sales_area` varchar(255) DEFAULT NULL,
  `goods_standard` varchar(255) DEFAULT NULL,
  `manufacturer_name` varchar(255) DEFAULT NULL,
  `manufactur_price` int(11) DEFAULT NULL,
  `user_name` varchar(45) DEFAULT NULL COMMENT '申请人姓名',
  `user_phone` varchar(45) DEFAULT NULL COMMENT '申请人电话',
  `user_address` varchar(200) DEFAULT NULL COMMENT '申请人地址',
  `user_company` varchar(100) DEFAULT NULL COMMENT '申请人公司名称',
  `user_email` varchar(45) DEFAULT NULL COMMENT '申请人email',
  `apply_time` datetime DEFAULT NULL COMMENT '申请时间',
  `product_name` varchar(100) DEFAULT NULL COMMENT '试用品名称',
  `user_ip` varchar(100) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8;

-- ----------------------------
-- Table structure for itemGoods
-- ----------------------------
DROP TABLE IF EXISTS `itemGoods`;
CREATE TABLE `itemGoods` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '库存商品id',
  `agency_id` int(11) DEFAULT NULL COMMENT '经销商id',
  `item_id` int(11) DEFAULT NULL COMMENT '货号id',
  `manufacturer_name` varchar(255) DEFAULT NULL COMMENT '品牌名称',
  `goods_name` varchar(100) DEFAULT NULL COMMENT '商品名称',
  `goods_standard` varchar(100) DEFAULT NULL COMMENT '商品规格 ',
  `stock` varchar(100) DEFAULT NULL COMMENT '库存数量',
  `unit` varchar(100) DEFAULT NULL COMMENT '规格单位',
  `manufactur_price` int(11) DEFAULT NULL COMMENT '目录价格',
  `sale_price` int(11) DEFAULT NULL COMMENT '零售价格',
  `sales_area` varchar(100) DEFAULT NULL COMMENT '销售区域',
  `person_name` varchar(100) DEFAULT NULL COMMENT '联系人姓名',
  `person_phone` varchar(20) DEFAULT NULL COMMENT '联系人电话',
  `update_time` datetime DEFAULT NULL COMMENT '更新时间',
  `type_id` tinyint(1) DEFAULT NULL COMMENT '“0”库存商品；“1”试用品',
  `sample_amount` varchar(100) DEFAULT NULL COMMENT '试用品数量',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=44 DEFAULT CHARSET=utf8;

-- ----------------------------
-- Table structure for itemManufacturer
-- ----------------------------
DROP TABLE IF EXISTS `itemManufacturer`;
CREATE TABLE `itemManufacturer` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `item_id` int(11) DEFAULT NULL COMMENT '货号id',
  `manufacturer_id` int(11) DEFAULT NULL COMMENT '品牌id',
  `manufacturer_sub_id` int(11) DEFAULT NULL COMMENT '子品牌id',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=398 DEFAULT CHARSET=utf8;

-- ----------------------------
-- Table structure for itemMaterials
-- ----------------------------
DROP TABLE IF EXISTS `itemMaterials`;
CREATE TABLE `itemMaterials` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '文献中实验材料id',
  `item_id` int(11) NOT NULL COMMENT '货号id',
  `experiment_id` int(11) NOT NULL COMMENT '文献id',
  `material_name` varchar(2000) DEFAULT NULL COMMENT '实验材料名称',
  PRIMARY KEY (`id`),
  KEY `item_Id_idx` (`item_id`),
  KEY `experiment_Ex_Id_idx` (`experiment_id`)
) ENGINE=InnoDB AUTO_INCREMENT=57 DEFAULT CHARSET=utf8;

-- ----------------------------
-- Table structure for itemMessage
-- ----------------------------
DROP TABLE IF EXISTS `itemMessage`;
CREATE TABLE `itemMessage` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '评论id',
  `pdf_id` int(11) DEFAULT NULL COMMENT 'pdf_id',
  `user_id` int(11) DEFAULT NULL COMMENT '用户id',
  `create_time` varchar(45) DEFAULT NULL,
  `type_id` tinyint(1) DEFAULT NULL COMMENT '“0”发表； “1”回复',
  `message_content` varchar(255) DEFAULT NULL COMMENT '评论内容',
  `product_id` int(11) DEFAULT NULL COMMENT '商品id',
  `user_ip` varchar(255) DEFAULT NULL COMMENT '用户ip',
  `check_status` tinyint(1) NOT NULL DEFAULT '0',
  `parent_id` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `itemId_idx` (`pdf_id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8;

-- ----------------------------
-- Table structure for itemPdf
-- ----------------------------
DROP TABLE IF EXISTS `itemPdf`;
CREATE TABLE `itemPdf` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `item_id` int(11) NOT NULL,
  `pdf_id` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=377 DEFAULT CHARSET=utf8;

-- ----------------------------
-- Table structure for itemVideo
-- ----------------------------
DROP TABLE IF EXISTS `itemVideo`;
CREATE TABLE `itemVideo` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '货号视频id',
  `video_id` int(11) NOT NULL COMMENT '视频id',
  `item_id` int(11) NOT NULL COMMENT '货号id',
  PRIMARY KEY (`id`),
  KEY `vedioId_idx` (`video_id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=36 DEFAULT CHARSET=utf8;

-- ----------------------------
-- Table structure for manufacturer
-- ----------------------------
DROP TABLE IF EXISTS `manufacturer`;
CREATE TABLE `manufacturer` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '品牌商id',
  `manuName` varchar(100) NOT NULL COMMENT '品牌商名字',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8 COMMENT='品牌表';

-- ----------------------------
-- Table structure for operation
-- ----------------------------
DROP TABLE IF EXISTS `operation`;
CREATE TABLE `operation` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '操作记录id',
  `pdf_id` int(11) NOT NULL COMMENT 'pdf id',
  `user_id` int(11) NOT NULL COMMENT '用户id',
  `operation_type` int(11) DEFAULT NULL COMMENT '“0”下载；“1”打印；“2”收藏；“3”分享',
  `operation_time` datetime DEFAULT NULL COMMENT '操作时间',
  `user_ip` varchar(100) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=57 DEFAULT CHARSET=utf8;

-- ----------------------------
-- Table structure for pdf
-- ----------------------------
DROP TABLE IF EXISTS `pdf`;
CREATE TABLE `pdf` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT 'pdf的id',
  `pdf_name` varchar(100) DEFAULT NULL COMMENT 'pdf名称',
  `pdf_url` varchar(255) DEFAULT NULL COMMENT 'pdf访问url',
  `pdf_path` varchar(200) DEFAULT NULL COMMENT '保存路径',
  `thumb_img` varchar(255) DEFAULT NULL,
  `download_num` int(11) DEFAULT '0' COMMENT '被“下载”次数',
  `print_num` int(11) DEFAULT '0' COMMENT '被“打印”次数',
  `collection_num` int(11) DEFAULT '0' COMMENT '被“收藏”次数',
  `share_num` int(11) DEFAULT '0' COMMENT '被“分享”次数',
  `language` int(11) DEFAULT NULL COMMENT '“0”英文，“1”中文；',
  `sub_pdf_id` int(11) DEFAULT '0' COMMENT '翻译版本pdf 的id',
  `txt` mediumint(9) DEFAULT NULL COMMENT '转为文字内容',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=133 DEFAULT CHARSET=utf8 COMMENT='pdf表';

-- ----------------------------
-- Table structure for test
-- ----------------------------
DROP TABLE IF EXISTS `test`;
CREATE TABLE `test` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) DEFAULT NULL,
  `number` int(10) DEFAULT '0',
  `ip` varchar(255) DEFAULT NULL,
  `type` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8;

-- ----------------------------
-- Table structure for user
-- ----------------------------
DROP TABLE IF EXISTS `user`;
CREATE TABLE `user` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `ip` varchar(15) DEFAULT NULL COMMENT '用户ip地址',
  `firstlogintime` datetime DEFAULT NULL COMMENT '首次操作时间',
  `lastlogintime` datetime DEFAULT NULL COMMENT '最后操作时间',
  `print_num` int(11) DEFAULT '0' COMMENT '打印pdf次数',
  `collection_num` int(11) DEFAULT '0' COMMENT '收藏pdf次数',
  `download_num` int(11) DEFAULT '0' COMMENT '下载pdf 数量',
  `share_num` int(11) DEFAULT NULL COMMENT '分享pdf次数',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- ----------------------------
-- Table structure for video
-- ----------------------------
DROP TABLE IF EXISTS `video`;
CREATE TABLE `video` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '视频id',
  `video_name` varchar(45) DEFAULT NULL COMMENT '视频名称',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `star` int(11) DEFAULT NULL COMMENT '星星',
  `show_times` int(11) DEFAULT NULL COMMENT '被播放次数',
  `video_url` varchar(255) DEFAULT NULL COMMENT '视频访问url',
  `video_path` varchar(200) DEFAULT NULL COMMENT '存储路径',
  `file_type` varchar(45) DEFAULT NULL COMMENT '文件类型',
  `play_time` int(11) DEFAULT NULL COMMENT '播放时长',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8;
