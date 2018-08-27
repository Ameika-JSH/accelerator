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

function renderTool(req,res,main,page,data)
{
	let json = {
			page : page,
			isAdmin : req.session.isAdmin ,
			isBatch : req.session.isBatch
		}
	if(data) Object.keys(data).forEach(key=>json[key] = data[key]);
	res.render(root + main,json);
}

router.get('/',function(req,res)
{	
	renderTool(req,res,mainPage,common.defaultPage);
});

router.get('/dashboard',function(req,res)
{	
	if(sessionCheck(req,res))
	{
		renderTool(req,res,mainPage,req.originalUrl.slice(1));
	}
});


router.get('/timeTable',function(req,res)
{	
	if(sessionCheck(req,res))
	{
		renderTool(req,res,mainPage,req.originalUrl.slice(1));
	}
});

router.get('/roomMng',function(req,res)
{
	if(sessionCheck(req,res,true))
	{		
		renderTool(req,res,mainPage,req.originalUrl.slice(1));
	}
});

router.get('/empMng',function(req,res)
{
	if(sessionCheck(req,res,true))
	{
		let scanParam = {
			"TableName" : "B2MM_EMP_INFO"
		};
		dynamoDB.scan(dynamoDB.getScanParam(scanParam),sortValue.RANGE_KEY)
		.then((rows)=>
		{
			renderTool(req,res,mainPage,req.originalUrl.slice(1),{data : rows});
		})
		.catch((err)=>{dynamoFail(res,err);});
	}
});

router.get('/groupMng',function(req,res)
{
	if(sessionCheck(req,res))
	{
		let scanParam = {
			"TableName" : "B2MM_USERGROUP"
		};
		dynamoDB.scan(dynamoDB.getScanParam(scanParam),sortValue.HASH_KEY)
		.then((rows)=>
		{			
			renderTool(req,res,mainPage,req.originalUrl.slice(1),{data : rows});
		})
		.catch((err)=>{dynamoFail(res,err);});
	}
});

router.get('/batchReserve',function(req,res)
{
	if(sessionCheck(req,res,false))
	{		
		let scanParam = {"TableName" : "B2MM_EMP_INFO"};
		dynamoDB.scan(dynamoDB.getScanParam(scanParam),sortValue.RANGE_KEY)
		.then((member)=>
		{
			scanParam.TableName = "B2MM_ROOM_INFO";			
			dynamoDB.scan(dynamoDB.getScanParam(scanParam),sortValue.HASH_KEY)
			.then(room=>
			{
				renderTool(req,res,mainPage,req.originalUrl.slice(1),{member : member,room : room, id : req.session.loginId});
			})
			.catch((err)=>{dynamoFail(res,err);});		
		})
		.catch((err)=>{dynamoFail(res,err);});		
	}
});

router.get('/mySchedule',async (req,res)=>
{
	if(sessionCheck(req,res))
	{		
		let queryParam = {
			TableName: "B2MM_MEETING_MEMBER",
			KeyConditionExpression: "ID=:id",
			ExpressionAttributeValues: {":id":req.session.loginId}
		};
		let rows = await dynamoDB.query(queryParam,false)	
		.catch((err)=>{dynamoFail(res,err);});
		
		if(req.session.loginId != req.session.loginMail)
		{
			queryParam.ExpressionAttributeValues[":id"] = req.session.loginMail;
			
			let mailRows = await dynamoDB.query(queryParam,false)	
			.catch((err)=>{dynamoFail(res,err);});
			
			rows[0].MEETING = [...rows[0].MEETING,...mailRows[0].MEETING];
		}
		let meeting = [];
		let dateVal = new Date();
		if(rows.length)
		{
			meeting = dynamoDB.sort("MEETING_NO",rows[0].MEETING);				
			meeting = meeting.filter((data)=>
			{
				var meetDate = new Date(data.DATE + ' ' + data.END.TIME);
				if(meetDate > dateVal) return true;
			});
		}				
		renderTool(req,res,mainPage,req.originalUrl.slice(1),{data : meeting ,id : req.session.loginId});		
	}
});

router.get('/roomInfo',function(req,res)
{	
	if(sessionCheck(req,res))
	{		
		let imgDir = 'static/img/roomInfo/';
		let img = fs.readdirSync(imgDir);
		let imgSrc = img[0] ? 'img/roomInfo/' + img[0] : 'img/404.png';
		renderTool(req,res,mainPage,req.originalUrl.slice(1),{imgSrc : imgSrc});
	}
});


router.get('/personalConfig',function(req,res)
{
	if(sessionCheck(req,res))
	{
		renderTool(req,res,mainPage,req.originalUrl.slice(1),{id : req.session.loginId,mail : req.session.loginMail});	
	}
});


router.get('/logout',function(req,res)
{	
	req.session.destroy();
	res.cookie('savedInfo','end',{expires : new Date(), httpOnly : true});
	res.redirect('/');
});

router.get('/dynamoConsole',function(req,res)
{
	if(sessionCheck(req,res))
	{
		const validUser = ['ameika@lotte.net','zecool@lotte.net','ultra-sso@lotte.net'];
		if(validUser.includes(req.session.loginId))
		{
			dynamoDB.getTableList()
			.then((tableList)=>{res.render(root + 'dynamo.ejs',{page : 'dynamo',tableList : tableList.TableNames});})
			.catch((err)=>{dynamoFail(res,err);});	
			
		}
		else
			wrongPage(res);
	}
});

router.get('/:pageName',function(req,res)
{
	wrongPage(res);
});

function wrongPage(res)
{
	res.status(404).send('<script>alert("잘못된 접근 입니다.");history.back();</script>');
}

function sessionCheck(req,res,needAuth)
{
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