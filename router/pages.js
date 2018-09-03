const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const common = require("../modules/common.js");

const logger = require("../modules/logger.js").logger(__filename,
[
	{name : 'info',option : {fontColor : 'green'}},
	{name : 'error',option : {fontColor : 'red',isTrace : true}}
]);


const root = path.join(path.dirname(__dirname), '/pages/');
const mainPage = 'main.ejs';
const pageList = ['yet'];

function renderTool(req,res,main,page,data)
{
	let json = {
			page : page,
			isAdmin : req.session.isAdmin ,
			isBatch : req.session.isBatch ,
			sideMenu : []
		}
	if(data) Object.keys(data).forEach(key=>json[key] = data[key]);
	res.render(root + main,json);
}

router.get('/',function(req,res)
{	
	renderTool(req,res,mainPage,common.defaultPage);
});

router.get('/info',function(req,res)
{	
	let sideMenu = ['회사 개요','CEO 인사말','회사 연혁','조직도'];
	renderTool(req,res,mainPage,'info',{sideMenu:sideMenu});
});

router.get('/:pageName',function(req,res)
{
	let pageName = req.params.pageName;
	if(pageList.includes(pageName))
		renderTool(req,res,mainPage,req.originalUrl.slice(1));
	wrongPage(res);
});

function wrongPage(res)
{
	res.status(404).send('<script>alert("잘못된 접근 입니다.");history.back();</script>');
}

function sessionCheck(req,res,needAuth)
{
	return true; //임시. 혹시 권한관리가 필요하면 다시 사용
	if(!req.session) 
	{
		res.redirect("/");	
	}
	else if(!req.session.loginTime || common.timeCheck(req.session.loginTime,{hour:3}))
	{
		req.session.destroy();
		res.redirect("/");	
	}
	else if(!req.session.loginId || (needAuth == false && !(req.session.isBatch || req.session.isAdmin)) ||  (needAuth && !req.session.isAdmin)) 
	{
		res.redirect("/");	
	}
	else
	{
		req.session.loginTime = new Date();		
		return true;	
	}
	return false; 
}

logger.info('Start>Page router');
module.exports = router;