const express = require('express');
const fs = require('fs');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session')
const logger = require("./modules/logger.js").logger(__filename,[
	{name : 'info',option : {fontColor : 'green'}}
]);

const app = express();

const port = __dirname.includes('test') ? 8080 : 80;
const sess = {
  secret: 'L.Star_dpftmxk',
  resave: false,
  rolling : true,
  saveUninitialized: true,  
  cookie : {expires:false}
}
app.use(express.static('static'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session(sess));

app.use('/', require('./router/pages'));
const routerNames = ['pages','ajax'];

routerNames.forEach((data)=>{app.use('/' + data, require('./router/' + data));});

app.listen(port,()=>{logger.info('nodeServer(port = ' + port + ')  Start at : ' + new Date().toLocaleString());});
