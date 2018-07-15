/**
 * Created by lipeiyi on 2018/3/28.
 */
var crypto = require('crypto');
function CommonBean(){
  this.everyPage = 10;
  let showPageNum = 8;

  this.getPageList = (currentPage,totalPageList)=>{
      let average = Math.ceil(showPageNum/2);
      let start = Math.max(currentPage-average,1);
      let end = Math.min(start+showPageNum-1,totalPageList[totalPageList.length-1]);
      start = Math.max(1,Math.min(start,end-showPageNum+1));
      let showPageList = [];
      for(let index=start;index<=end;index++){
          showPageList.push(index);
      }
      return showPageList;
  }
  this.md5 = (str)=>{
      var md5sum = crypto.createHash('md5');
      md5sum.update(str);
      str = md5sum.digest('hex');
      return str;
  }
}
module.exports = CommonBean;