const express = require('express');
const router = require('express').Router();
const fs = require('fs');
const path = require('path');

const common = require("../modules/common.js");

const logger = require("../modules/logger.js").logger(__filename,
[
	{name : 'info',option : {fontColor : 'green'}},
	{name : 'mail',option : {fontColor : 'cyan'}},
	{name : 'error',option : {fontColor : 'red',isTrace : true}}
]);

const root = path.join(path.dirname(__dirname), '/pages/');
const defaultPage = common.defaultPage;


const MSG_LIST = common.MSG_LIST;

/* Login*/

router.post('/login', function (req, res) {		
	let param = req.body;
	if(param.isAuto == 'true') param.isAuto = true;
	else param.isAuto = false;
	common.doLogin(param,req,res);
});

function sessionCheck(req,res,next)
{
	if(!req.session) 
		res.send({success:false, msg:{text : MSG_LIST.ERROR_SESSION_EMPTY,redirect : '/'}});
	if(!req.session.loginTime || common.timeCheck(req.session.loginTime,{hour:3}))
	{
		req.session.destroy();
		res.send({success:false, msg:{text : MSG_LIST.ERROR_SESSION_EMPTY,redirect : '/'}});
	}
	else if(!req.session.loginId) 
	{
		res.send({success:false, msg:{text : MSG_LIST.ERROR_SESSION_EMPTY,redirect : '/'}});
	}
	else
	{
		req.session.loginTime = new Date();
		next();
	}
}

router.get('*',function(req,res,next)
{	
	sessionCheck(req,res,next);
});

router.post('*',function(req,res,next)
{	
	sessionCheck(req,res,next);
});

router.delete('*',function(req,res,next)
{	
	sessionCheck(req,res,next);
});


/* Time Table */

router.get('/timeTable/reserveList', function (req, res) {	
	let param = req.query;	
	let scanParam = {
		"TableName" : "B2MM_ROOM_INFO"
	};
	dynamoDB.scan(dynamoDB.getScanParam(scanParam),sortValue.HASH_KEY)
	.then(async (rows)=>
	{
		scanParam = {
			"TableName" : "B2MM_MEETING_LIST",
			"FilterExpression": "#DATE=:date",
			"ExpressionAttributeValues": {":date": param.DATE},
			"ExpressionAttributeNames": {"#DATE": "DATE"}
		};
		let group;
		if(req.session.isAdmin) 
		{
			group = await dynamoDB.scan("B2MM_USERGROUP").catch((err)=>{dynamoFail(res,err);});	
			group = group.map(grp=>{return {"GROUP_NAME" : grp.GROUP_NAME, "GROUP_SIZE" : grp.MEMBER.length}});
		}
		
		let reserve = await dynamoDB.scan(dynamoDB.getScanParam(scanParam),false).catch((err)=>{dynamoFail(res,err);});	
		dynamoDB.scan("B2MM_EMP_INFO",sortValue.RANGE_KEY)
		.then((member)=>
		{			
			res.render(root + 'reserveList.ejs',{'param':param,'row' : rows, 'reserve' : reserve,'member':member,id : req.session.loginId, isAdmin : req.session.isAdmin, group : group});		
		})
		.catch((err)=>{dynamoFail(res,err);});		
	})
	.catch((err)=>{dynamoFail(res,err);});
});

router.get('/timeTable/reserveCheck', function (req, res) {	
	let param = req.query;	
	let scanParam = {
		"TableName" : "B2MM_MEETING_LIST",
		"FilterExpression": "OFFICE=:office and ROOM=:room and #DATE=:date",
		"ExpressionAttributeNames": 
		{
			"#DATE": "DATE"
		},
		"ExpressionAttributeValues": 
		{
			":office": param.OFFICE,
			":room": param.ROOM,
			":date": param.DATE
		}		
	};
	
	dynamoDB.scan(dynamoDB.getScanParam(scanParam),sortValue.HASH_KEY)
	.then((rows)=>
	{
		for(let i = 0, lim = rows.length; i<lim; i++)
		{
			if(parseInt(rows[i].START.CODE) <= parseInt(param.START.CODE) 
			&& parseInt(rows[i].END.CODE) > parseInt(param.START.CODE))
			{
				res.send({success : true,'param':param,'row' : rows[i]});
				break;
			}
			else if( parseInt(rows[i].START.CODE) > parseInt(param.START.CODE))
			{				
				res.send({success : true,'param':param,'row' : rows[i]});
				break;
			}						
		}		
		if(rows.length == 0) res.send({success : true,'param':param,'row' : rows[0]});
		else if(parseInt(rows[0].START.CODE) < parseInt(param.START.CODE)) res.send({success : true,'param':param,'row' : rows[0]});
	})
	.catch((err)=>{dynamoFail(res,err);});
});

router.get('/timeTable/canIReserve', function (req, res) 
{	

	var params = {
			"TableName" : "B2MM_MEETING_LIST",
			"FilterExpression": "#DATE=:date AND OFFICE=:office AND ROOM=:room",
			"ExpressionAttributeValues": 
			{
				":date": req.query.DATE,
				":office" : req.query.OFFICE,
				":room" : req.query.ROOM
			},
			"ExpressionAttributeNames": {"#DATE": "DATE"}
		};
	dynamoDB.scan(params)
	.then((rows)=>
	{
		if(rows.length == 0) res.send({success : true, can : true});
		else
		{
			for(let i = 0; i<rows.length; i++)
			{
				if(common.isDuplicate(rows[i],req.query))
				{
					res.send({success : true, can : false});
				}
				else if(i == rows.length-1) res.send({success : true, can : true});
			}
		}
	})
	.catch((err)=>{dynamoFail(res,err);});
	
})

router.post('/timeTable',async function(req,res){
	let param = req.body;
	param.REG = 
	{
		"ID" : req.session.loginId,
		"NAME" : req.session.loginName
	}
	param.MEMBER = param.MEMBER ? param.MEMBER : [];
	param.MEMBER.push(req.session.loginMail);
	if(param.GROUP)
	{
		let queryParam = 
		{
			TableName : "B2MM_USERGROUP" , 
			KeyConditionExpression: "GROUP_NAME=:name",
			ExpressionAttributeValues : {},
			ExpressionAttributeNames : {"#MEMBER":"MEMBER"},
			ProjectionExpression : "#MEMBER"
		}		
		
		for(let i = 0 ; i < param.GROUP.length ; i++)			
		{
			queryParam.ExpressionAttributeValues[":name"] = param.GROUP[i];
			let grp = await dynamoDB.query(queryParam).catch((err)=>{dynamoFail(res,err);});				
			grp = grp[0].MEMBER.map(g=>g.ID);
			param.MEMBER = [...new Set([...param.MEMBER,...grp])];
			
		}
			
	}
	param.COUNT = param.MEMBER.length;
	
	insertMeetingList(param,req.session.loginId,res)
	.then((data)=>
	{
		insertMeetingMember([param],param.MEMBER,()=>{res.send(data);});
	})
	.catch((err)=>{dynamoFail(res,err);});
});

function insertMeetingList(param,regId,res,isBatch)
{
	return new Promise((resolve,reject)=>
	{		
		let insertParam = {
			TableName: "B2MM_MEETING_LIST",
			Item : param		
		};	
		dynamoDB.insert(insertParam)
		.then((result)=>
		{
			let member = param.MEMBER;			
			
			let date = new Date(param.DATE); 
			let day = date.getDate();
			
			let countInsertParam = 
			{
				TableName: "B2MM_MEETING_COUNT",
				Item : {'YEAR' : date.getFullYear() ,'MONTH' : date.getMonth() + 1 , 'DAY' : {}},
				ConditionExpression : 'attribute_not_exists(#DAY)',
				ExpressionAttributeNames: {"#DAY": "DAY"}
			}
						
			dynamoDB.insert(countInsertParam)
			.then(()=>
			{
				let updateParam = 
				{
					TableName: "B2MM_MEETING_COUNT",
					Key : {'YEAR' : date.getFullYear(),'MONTH' : date.getMonth() + 1},
					UpdateExpression : 'ADD #DAY.#IDX :one',
					ExpressionAttributeNames: {'#DAY' : 'DAY', "#IDX": day},
					ExpressionAttributeValues : {':one' : 1}
				}
				dynamoDB.update(updateParam)
				.then(()=>
				{
					logger.info(param.DATE + ' : reserved');
					
					if(isBatch) resolve({success:true});
					else sendMeetingMail(param,resolve);
				});			
			})	
			.catch((err)=>{reject(err);});						
		})
		.catch((err)=>{reject(err);});
	});
}

async function insertMeetingMember(meeting,member,callback)
{
	delete meeting.MEMBER;
	let updateParam = 
	{
		TableName: "B2MM_MEETING_MEMBER",
		Key : {},
		UpdateExpression : 'SET MEETING=list_append(MEETING,:meeting)',
		ExpressionAttributeValues : {':meeting' : meeting}
	}
	
	for(let i = 0 ; i<member.length ; i++)
	{
		updateParam.Key['ID'] = member[i];
		await dynamoDB.update(updateParam).catch(async (err)=>
		{
			if(err.code == 'ValidationException')
			{
				updateParam.UpdateExpression = 'SET MEETING=:meeting';
				await dynamoDB.update(updateParam).catch((err)=>{dynamoFail(res,err);});
				updateParam.UpdateExpression = 'SET MEETING=list_append(MEETING,:meeting)';				
				logger.info(member[i] + ' created in B2MM_MEETING_MEMBER because not exists');
			}
			else
				dynamoFail(res,err);
		});
		logger.info('B2MM_MEETING_MEMBER : ' + member[i] + '(' + (i+1) + '/' + member.length + ')');
	}
	callback();
}

function sendMeetingMail(param,callback)
{
	mail.sendMail(
		param.MEETING_TITLE,
		param.OFFICE + '>' + param.ROOM ,
		{name:param.REG.NAME,address: param.REG.ID},
		param.MEMBER,
		param.DATE,
		param.START.TIME,
		param.END.TIME)
	.then((mResult)=>{callback(mResult);})
	.catch((err)=>{callback({mail : true,msg : '메일 발송 실패'});});
}

router.get('/timeTable/meetingCount', function (req, res) {	
		
	let queryParam =
	{
		TableName : "B2MM_MEETING_COUNT",
		ProjectionExpression:"#DAY",
		KeyConditionExpression: "#YEAR = :year and #MONTH = :month",
		ExpressionAttributeNames:{"#YEAR": "YEAR","#MONTH": "MONTH","#DAY": "DAY"},
		ExpressionAttributeValues: {
			":year" : parseInt(req.query.YEAR),
			":month": parseInt(req.query.MONTH)
		}
	};
	dynamoDB.query(queryParam)
	.then((rows)=>
	{
		let rtn = rows[0] ? rows[0].DAY : rows[0];
		res.send(rtn);
	})
	.catch((err)=>{dynamoFail(res,err);});
});

router.post('/meetCountReset',async (req,res)=>
{
	//여기 이거 비동기 처리 제대로
	let rtn = await common.meetingCountReset();
	res.send({success : rtn});
});


router.get('/timeTable/getMember',async (req,res)=>
{
	let meetingNo = req.query.meetingNo;	
	let queryParam =
	{
		TableName : "B2MM_MEETING_LIST",
		ProjectionExpression:"#MEMBER",
		KeyConditionExpression: "MEETING_NO=:meetingNo",
		ExpressionAttributeNames:{"#MEMBER": "MEMBER"},
		ExpressionAttributeValues: {":meetingNo" : meetingNo}
	};
	let member = await dynamoDB.query(queryParam);
	member = member[0].MEMBER;
	let targetKeyStr = ''
	let target = {};
	for(let i = 0 ; i < member.length ;i++)
	{
		if(i != 0)
			targetKeyStr += ',';
		targetKeyStr += ':key' + i;
		target[':key' + i] = member[i];
	}
	let scanParam = 
	{
		TableName: "B2MM_EMP_INFO",
		ProjectionExpression: "#ID, #NAME",
		FilterExpression: "#ID IN (" + targetKeyStr + ")",
		ExpressionAttributeNames: {"#ID" : "ID","#NAME" : "NAME"},
		ExpressionAttributeValues : target
	};
	
	let empInfo = await dynamoDB.scan(scanParam);
	
	res.send({success : true,data:empInfo});
});

/*
router.post('/timeTable/meetingCount', function (req, res) {	
	
	dynamoDB.scan(
	{
		TableName: "B2MM_MEETING_LIST",
		ProjectionExpression : '#DATE',
		ExpressionAttributeNames : {"#DATE" : "DATE"}
	})
	.then((rows)=>
	{
		let rtn = [];
		rows.map((data)=>{return data.DATE;})
		.forEach((data)=>
		{
			let date = new Date(data); 
			let day = date.getDate();
			rtn.push({'YEAR' : date.getFullYear(), 'MONTH' : date.getMonth() + 1 , 'DAY' : date.getDate()});
			dynamoDB.update(
			{
				TableName: "B2MM_MEETING_COUNT",
				Key : {'YEAR' : date.getFullYear(),'MONTH' : date.getMonth() + 1},
				UpdateExpression : 'ADD #DAY.#IDX :zero',
				ExpressionAttributeNames: {'#DAY' : 'DAY', "#IDX": day},
				ExpressionAttributeValues : {':zero' : 1}
			})
			.then(()=>{console.log({'YEAR' : date.getFullYear(), 'MONTH' : date.getMonth() + 1 , 'DAY' : date.getDate()});});
		});
		res.send(rtn);
	});		
});
*/


/* Room Info */
router.get('/roomInfo', function (req, res) {	
	let scanParam = {"TableName" : "B2MM_ROOM_INFO"};
	dynamoDB.scan(dynamoDB.getScanParam(scanParam),sortValue.HASH_KEY)
	.then((data)=>{res.render(root + 'roomMngTbody.ejs',{'data':data});})
	.catch((err)=>{dynamoFail(res,err);});
});

router.post('/roomInfo', function (req, res) {	
	let param = req.body;		  
	let insertParam = {
		TableName: "B2MM_ROOM_INFO",
		ConditionExpression : 'attribute_not_exists(SIZE)',
		Item : param		
	};	
	
	dynamoDB.insert(insertParam)
	.then((result)=>
	{
		res.send(result);
	})
	.catch((err)=>
	{
		let msg;
		if(err.code == "ConditionalCheckFailedException")
			msg = MSG_LIST.ERROR_EXIST_ROOM;
		
		dynamoFail(res,err,msg);		
	});
});

router.put('/roomInfo', function (req, res) {	
	let param = req.body;
	let key = 
	{
		OFFICE : param.OFFICE,
		ROOM : param.ROOM
	}
	
	let updateParam = {
		TableName: "B2MM_ROOM_INFO",
		Key : key,
		UpdateExpression : 'SET #COMMENT=:comment,SIZE=:size',
		ExpressionAttributeNames : {"#COMMENT" : "COMMENT"},
		ExpressionAttributeValues : 
		{
			":comment" : param.COMMENT,
			":size" : param.SIZE
		}
	};	
	
	dynamoDB.update(updateParam)
	.then((result)=>{res.send(result);})
	.catch((err)=>{dynamoFail(res,err);});
});

router.delete('/roomInfo', function (req, res) {	
	let param = req.body;
	let deleteParam = {
		TableName: "B2MM_ROOM_INFO",
		Key : param
	};	
	dynamoDB.delete(dynamoDB.getDeleteParam(deleteParam))
	.then((result)=>{res.send(result);})
	.catch((err)=>{dynamoFail(res,err);});
});

/* Emp Mng */
router.post('/empMng',async function(req,res)
{
	let params = {
		TableName: "B2MM_EMP_INFO",
		Key: 
		{
			ID : req.body.id,
			NAME : req.body.name
		},
		UpdateExpression: 'SET #auth=:bool',
		ExpressionAttributeNames : {'#auth' : req.body.auth},
		ExpressionAttributeValues: {':bool' : (req.body.bool === true || req.body.bool === 'true')}
	};

	let result = await dynamoDB.update(params).catch((err)=>{dynamoFail(res,err);});
	if(result.success) res.send(result);
});

/* Batch Reserve */

router.get('/batchReserve',function(req,res)
{
	chkMeetingForBatch(req.query,res);	
});

router.post('/batchReserve',async function(req,res)
{
	let param = req.body;	
	param.MEMBER.push(req.session.loginMail);
	param.COUNT = parseInt(param.COUNT) + 1;
	
	let startDate = param.START.DATE;
	let endDate = param.END.DATE;
	let day = param.DAY;
	let duplicate_date = param.DUPLICATE_DATE ? param.DUPLICATE_DATE : [];
	let count = [];
	
	let insertParam = 
	{	
		"COUNT": param.COUNT,
		"DATE": '',
		"END": 
		{
			"CODE": param.END.CODE,
			"TIME": param.END.TIME
		},
		"MEETING_NO": "",
		"MEETING_TITLE": param.MEETING_TITLE,
		"MEMBER": param.MEMBER,
		"OFFICE": param.OFFICE,
		"REG": 
		{
			"ID" : req.session.loginId,
			"NAME" : req.session.loginName
		},
		"ROOM": param.ROOM,
		"START": 
		{
			"CODE": param.START.CODE,
			"TIME": param.START.TIME
		}
		
	}
	
	let meetingList = [];
	while(new Date(startDate) <= new Date(endDate))
	{
		let tmp = new Date(startDate + ' ' +  param.START.TIME);
		if(day.includes(String(tmp.getDay())) &&
		   !duplicate_date.includes(startDate) )
		{
			let tmpParam = jsonCopy(insertParam);
			tmpParam.DATE = startDate;
			count.push(startDate);
			tmpParam.MEETING_NO = String(tmp.getTime()).slice(0,-5) + '_' + tmpParam.OFFICE + '_' + tmpParam.ROOM;
			let rtnTemp = await insertMeetingList(tmpParam,req.session.loginId,res,true).catch(err=>console.log(err));
			meetingList.push(tmpParam);
		}
		
		tmp.setDate(tmp.getDate() + 1 )
		startDate = getDateString(tmp);
		if(new Date(startDate) > new Date(endDate))
		{			
			let mailParam = jsonCopy(insertParam);
			mailParam.DATE = count;
			sendMeetingMail(mailParam,logger.info);
			insertMeetingMember(meetingList,param.MEMBER,()=>{res.send({success : true, count : count.length});});			
		}
	}	
});

function jsonCopy(json)
{
	return JSON.parse(JSON.stringify(json));
}
		
function getDateString(date)
{
	date = [date.getFullYear(),(date.getMonth()+1),date.getDate()]
	return  date.join('. ');
}

async function chkMeetingForBatch(param,res)
{
	let start = new Date(parseInt(param.DATE.START));
	let end = new Date(parseInt(param.DATE.END));
	let days = param.DAYS;
	let target = {':office' : param.OFFICE, ':room' : param.ROOM};
	let targetKeyStr = '';
	let idx = 0;
	let operandLimit = 98;
	let rtn = [];
	let isExist = true;
	
	while(start <= end)
	{
		if(days.includes(String(start.getDay())))
		{
			target[':target'+idx] = getDateString(start);
			if(idx != 0) targetKeyStr += ', ';
			targetKeyStr += (':target'+idx)
			idx += 1;
			isExist = false;
		}
		start.setDate(start.getDate()+1);
		if(targetKeyStr != '' && (idx == operandLimit || start > end))
		{
			let scanParam = 
			{
				TableName: "B2MM_MEETING_LIST",
				ProjectionExpression: "#DATE, #START, #END",
				FilterExpression: "#DATE IN (" + targetKeyStr + ") AND " + 
								  "ROOM = :room AND OFFICE = :office",
				ExpressionAttributeNames: {"#DATE" : "DATE","#START" : "START", "#END" : "END"},
				ExpressionAttributeValues : target
			};
			let rows = await dynamoDB.scan(scanParam).catch((err)=>{dynamoFail(res,err);});	
			
			let startCode = parseInt(param.START.CODE);
			let endCode = parseInt(param.END.CODE);
			
			rows.forEach(meet=>
			{
				let mStart = parseInt(meet.START.CODE);
				let mEnd = parseInt(meet.END.CODE);
				if((startCode >= mStart && startCode < mEnd) || (endCode > mStart && endCode <= mEnd))
					rtn.push(meet);
			});
			idx = 0;
			targetKeyStr = '';
			target = {':office' : param.OFFICE, ':room' : param.ROOM};
		}	
	}
	if(isExist)
		res.send({success : false , msg : '기간중 해당 요일이 없습니다.'});
	else
		res.send({success : true, data : rtn});
}

/* My Schedule */
/* ajax로 작성했다가 page에서 바로 말아서 ejs보내는걸로 수정
router.get('/mySchedule',function(req,res)
{	
	let queryParam = {
		TableName: "B2MM_MEETING_MEMBER",
		KeyConditionExpression: "ID=:id",
		ExpressionAttributeValues: {":id":req.session.loginId}
	};
	dynamoDB.query(dynamoDB.getQueryParam(queryParam),false)	
	.then((rows)=>
	{
		let meeting = [];
		let dataStr = String((new Date().getTime())).slice(0,-5);
		if(rows.length)
		{
			meeting = dynamoDB.sort("MEETING_NO",rows[0].MEETING);				
			meeting = meeting.filter((data)=>
			{
				if(data.MEETING_NO > dataStr) return true;
			});
		}			
		res.render(root + 'mySchedule.ejs', { data : meeting ,id : req.session.loginId });	
	})
	.catch((err)=>{dynamoFail(res,err);});	
});
*/
router.delete('/mySchedule', function (req, res) {	
	let param = req.body;
	let deleteParam = {
		TableName: "B2MM_MEETING_LIST",
		Key : param,
		ReturnValues : 'ALL_OLD'
	};	
	
	dynamoDB.delete(dynamoDB.getDeleteParam(deleteParam))
	.then((dResult)=>
	{		
		let member = dResult.rtn.MEMBER;
		for(let i=0,lim=member.length;i<lim;i++)
		{
			let queryParam = 
			{
				TableName: "B2MM_MEETING_MEMBER",
				KeyConditionExpression: "ID=:id",
				ExpressionAttributeValues: {":id":member[i]}
			};
			
			dynamoDB.query(dynamoDB.getQueryParam(queryParam),false)
			.then((result)=>
			{
				let deleteTarget = dResult.rtn.MEETING_NO;
				let meeting = result[0].MEETING;
				meeting = meeting.filter((data)=>
				{
					if(data.MEETING_NO != deleteTarget) 
						return true;
					else
					{
						let date = new Date(dResult.rtn.DATE);
						dynamoDB.update(
						{
							TableName: "B2MM_MEETING_COUNT",
							Key : {'YEAR' : date.getFullYear(),'MONTH' : date.getMonth() + 1},
							UpdateExpression : 'ADD #DAY.#IDX :one',
							ExpressionAttributeNames: {'#DAY' : 'DAY', "#IDX": date.getDate()},
							ExpressionAttributeValues : {':one' : -1}
						})
						.then(()=>{logger.info(dResult.rtn.DATE + ' : deleted');});		
					}
				});
				
				let updateParam = 
				{
					TableName: "B2MM_MEETING_MEMBER",
					Key : {ID : member[i]},
					UpdateExpression : 'SET MEETING=:meeting',
					ExpressionAttributeValues : {":meeting" : meeting}
				};					
				
				dynamoDB.update(dynamoDB.getUpdateParam(updateParam))
				.then((uResult)=>{logger.info(updateParam.Key.ID);})
				.catch((err)=>
				{
					i=lim; //stop to for loop
					dynamoFail(res,err);
				});	
			})
			.catch((err)=>
			{
				lim = false; //stop to for loop
				dynamoFail(res,err);
			});	
		}
		
		mail.sendMailCancel(
			dResult.rtn.MEETING_TITLE,
			dResult.rtn.OFFICE + '>' + dResult.rtn.ROOM ,
			{name:req.session.loginName,address: req.session.loginId},
			dResult.rtn.MEMBER,
			dResult.rtn.DATE,
			dResult.rtn.START.TIME,
			dResult.rtn.END.TIME)
		.then((mResult)=>{res.send(mResult);})
		.catch((err)=>{res.send({mail : true,msg : '메일 발송 실패'});});;
	})
	.catch((err)=>{dynamoFail(res,err);});
});

/* Personal Config*/
router.get('/personalConfig', function (req, res) {	
	let rand = Math.random();
	rand = parseInt(rand * 10000);
	rand = rand < 1000 ? '0' + rand : '' + rand;
	
	req.session.chksum = rand;
	req.session.mailTo = req.query.mail;
	
	mail.sendChkMail( req.query.mail,rand);	
	res.send({success : true});
});


router.post('/personalConfig', function (req, res) {		
	if(req.body.chksum == req.session.chksum)
	{
		let updateParam = 
		{
			TableName: "B2MM_EMP_INFO",
			Key : 
			{
				'ID' : req.session.loginId,
				'NAME' : req.session.loginName
			},
			UpdateExpression : 'SET MAIL=:mail',
			ExpressionAttributeValues : {':mail' : req.session.mailTo}
		}
		dynamoDB.update(updateParam)
		.then(()=>
		{
			logger.mail('Mail Change : ' + req.session.loginMail + '->' + req.session.mailTo + ' (' + req.session.loginName + ')');
			req.session.loginMail = req.session.mailTo;
			res.send({success : req.body.chksum == req.session.chksum});
		})
		.catch((err)=>{dynamoFail(res,err);});	
	}
	else
		res.send({success : req.body.chksum == req.session.chksum});
});

/* DashBoard */
router.get('/dashboard/meetingRate',function (req, res) {		
	let roomScanParam = 
	{
		TableName : "B2MM_ROOM_INFO",
		ProjectionExpression : "ROOM, OFFICE"		
	}
	dynamoDB.scan(roomScanParam)
	.then(async (rows)=>
	{
		let meetingQueryParam = 
		{
			TableName : "B2MM_MEETING_LIST",
			FilterExpression : "ROOM=:room AND OFFICE=:office",
			ProjectionExpression : "MEETING_NO,#START.CODE,#END.CODE",
			ExpressionAttributeNames : {"#START" : "START","#END" : "END"}
		}
		let rtn = {keys : [],count:{total:0,value:{}},time:{total:0,value:{}}};		
		let total = 0;
		for(let i = 0 ; i < rows.length ; i++)
		{
			meetingQueryParam.ExpressionAttributeValues = {":room":rows[i].ROOM,":office":rows[i].OFFICE}			
			let tmp = await dynamoDB.scan(meetingQueryParam).catch((err)=>{dynamoFail(res,err);});	
			let key = rows[i].OFFICE + '-' + rows[i].ROOM;
			
			rtn.keys.push(key);
			
			rtn.count.total += tmp.length;
			rtn.count.value[key] = tmp.length;
			
			let intv = 0
			for(let j =0;j<tmp.length;j++)
			{
				intv += tmp[j].END.CODE - tmp[j].START.CODE;				
			}
			rtn.time.total += intv;
			rtn.time.value[key] = intv;				
		}		
		rtn.keys = rtn.keys.sort();
		rtn.success = true;
		res.send(rtn);
	})
	.catch((err)=>{dynamoFail(res,err);});		
});


router.get('/dashboard/nowOn',(req, res)=>
{	
	let today = new Date();
	
	let queryParam = 
	{		
		TableName : "B2MM_MEETING_LIST",
		IndexName : "DATE-index",
		KeyConditionExpression : "#DATE=:date",
		ProjectionExpression : "#DATE,#START.#TIME,#END.#TIME,OFFICE,ROOM,MEETING_TITLE",
		ExpressionAttributeNames : {"#DATE" : "DATE","#START":"START","#END":"END","#TIME":"TIME"},
		ExpressionAttributeValues : {":date" : today.getFullYear() + '. ' + (today.getMonth() + 1) + '. ' + today.getDate()}
	}
	dynamoDB.query(queryParam)
	.then(rows=>
	{
		let time = new Date();
		
		res.send({success : true,data : rows.filter(row=>
		{
			let startTime = new Date(row.DATE + ' ' + row.START.TIME);
			let endTime = new Date(row.DATE + ' ' + row.END.TIME);
			return startTime <= time && endTime >= time;
		})});
	})
	.catch((err)=>{dynamoFail(res,err);});	
});

router.get('/dashboard/regCountTop',(req,res)=>
{
	let scanParam = 
	{		
		TableName : "B2MM_MEETING_LIST",
		ExpressionAttributeNames : {"#NAME":"NAME"},
		ProjectionExpression : "REG.#NAME"
	}
	dynamoDB.scan(scanParam)
	.then(result=>
	{
		let json = {};
		result.forEach(data=>
		{
			if(json[data.REG.NAME])
				json[data.REG.NAME] += 1;
			else
				json[data.REG.NAME] = 1;
		});
		let rtn = [];
		Object.keys(json).forEach(data=>
		{
			rtn.push({[data]:json[data]});
		});
		res.send({success:true,data:common.jsonListSort(rtn,true)});
	})
	.catch((err)=>{dynamoFail(res,err);});		
});

/*
router.get('/dashboard/meetingCountTop',(req,res)=>
{
	let scanParam = 
	{		
		TableName : "B2MM_MEETING_MEMBER"
	}
	dynamoDB.scan(scanParam)
	.then(result=>
	{
		let rtn = [];
		result.forEach(data=>
		{			
			rtn.push({[data.ID]:json[data]});
		});
		res.send({success:true,data:common.jsonListSort(rtn,true)});
	})
	.catch((err)=>{dynamoFail(res,err);});		
});
*/
/* JIRA UPDATE */

router.post('/jira/emp',function (req, res) {
	jira_update.userUpdate(req.session.loginId,req.session.loginPw)
	.then((result)=>{res.send({success:true,result : result});})
	.catch((err)=>{res.send({success:false,err:err});});	
});

router.post('/jira/group',function (req, res) {		
	jira_update.groupUpdate(req.session.loginId,req.session.loginPw)
	.then((result)=>{res.send({success:true,result : result});})
	.catch((err)=>{res.send({success:false,err:err});});	
});

/* dynamo console */
router.get('/dynamo/tableList',function (req, res) {		
	res.send(dynamoDB.getTableList()	
	.catch((err)=>{dynamoFail(res,err);}));	
});

router.get('/dynamo', function (req, res) {	
	dynamoDB.consoleWork(req.query.role,req.query.param)
	.then((result)=>{res.send(result);})
	.catch((err)=>{res.send({success:false,err:err});});	
});

router.get('/dynamo/describeTable', function (req, res) {	
	dynamoDB.describeTable(req.query.tableName)
	.then((result)=>{res.send(result);})
	.catch((err)=>{res.send({success:false,err:err});});	
});

logger.info('Start>Ajax router');
module.exports = router;