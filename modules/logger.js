const fs = require('fs');
const path = require('path');

const date = (new Date()).toISOString().split('T')[0];
const root = path.join(path.dirname(__dirname), '/logs/');
const infoRt = root + 'info/';
const errorRt = root + 'error/';


const style = 
{
	"reset" : 0,
	"bright" : 1,
	"dim" : 2,
	"underscore" : 3,
	"blink" : 4,
	"reverse" : 5,
	"hidden" : 6
}

const fontColor = 
{
	"black" : 30,
	"red" : 31,
	"green" : 32,
	"yellow" : 33,
	"blue" : 34,
	"magenta" : 35,
	"cyan" : 36,
	"white" : 37
}

const bgColor = 
{
	"black" : 40,
	"red" : 41,
	"green" : 42,
	"yellow" : 43,
	"blue" : 44,
	"magenta" : 45,
	"cyan" : 46,
	"white" : 47
}

function colorOptions(str,options)
{
	let optPre = '\x1b[';
	let optEnd = 'm';
	let optReset =  '\x1b[0m';
	if(style[options.style])
		str = optPre + style[options.style] + optEnd + str + optReset;
	if(fontColor[options.fontColor])
		str = optPre + fontColor[options.fontColor] + optEnd + str + optReset;
	if(bgColor[options.bgColor])
		str = optPre + bgColor[options.bgColor] + optEnd + str + optReset;
	return str;
}

function dirChkAndMake(chkPath)
{
	try
	{
		let stat = fs.statSync(chkPath);
	}
	catch(err)
	{
		if(err.code == 'ENOENT')
		{
			console.log(err.path,'- created!');			
			fs.mkdirSync(chkPath);
		}
	}	
}

dirChkAndMake(root);


let logFunc = (sysName,func,option)=>
{
	return (msg)=>
	{		
		let date = new Date();
		let file = fs.openSync(root + func + '/' + date.toISOString().split('T')[0] + '.log','a');
		let logMsg = '[' + date.toTimeString().split(' ')[0] + '] : ' + msg + '(' + sysName + ')';
		let logConsole;
		if(option.isTrace) logConsole = console.trace;
		else logConsole = console.log;
		logConsole(colorOptions('logger[' + func + '] - ' + logMsg,option));
		fs.writeSync(file,logMsg + '\r\n');
		fs.closeSync(file);
	}
}

let logger = (sysName,funcList)=>
{	
	if(process.platform.startsWith('win'))
		sysName = /.*[\\]([^\\]*)/.exec(sysName)[1];
	else if(process.platform.startsWith('linux'))
		sysName = /.*[\/]([^\/]*)/.exec(sysName)[1];
	let rtn = {};
	for(let i=0,lim=funcList.length;i<lim;i++)
	{			
		dirChkAndMake(root + funcList[i].name);
		rtn[funcList[i].name] = logFunc(sysName,funcList[i].name,funcList[i].option);
	}	
	return rtn;
}

exports.logger = logger;
console.log(colorOptions('logger[info] - [' + (new Date()).toTimeString().split(' ')[0] + '] : Start>logger modeule(logger.js)',{fontColor : 'green'}));