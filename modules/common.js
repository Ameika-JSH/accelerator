const logger = require("./logger.js").logger(__filename,
[
	{name : 'info',option : {fontColor : 'green'}},
	{name : 'error',option : {fontColor : 'red',isTrace : true}},
	{name : 'login',option : {fontColor : 'blue'}}
]);
const crypto = require('crypto');

const MSG_LIST = 
{
}
const defaultPage = "index";



/* function */

/* variable */
exports.MSG_LIST = MSG_LIST;
exports.defaultPage = defaultPage;
exports.dynamoBatchLimit = dynamoBatchLimit;

logger.info('Start>Common module');