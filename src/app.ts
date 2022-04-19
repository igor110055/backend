require("dotenv").config();

import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as express from 'express';
import * as shrinkRay from 'shrink-ray-current'
import * as cors from 'cors'

import Api, {initApp} from './api'
import MySQL from './MySQLModel';
import {setlog} from './helper';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
/* const isProduction = process.env.NODE_ENV === 'production'; */
const port = Number(process.env.HTTP_PORT || 80)
const portHttps = Number(process.env.HTTPS_PORT || 443)

process.on("uncaughtException", (err:Error) => setlog('exception',err));
process.on("unhandledRejection", (err:Error) => setlog('rejection',err));

Date.now = () => Math.round((new Date().getTime()) / 1000);

MySQL.connect({
	host: process.env.DB_HOST,
	port: Number(process.env.DB_PORT || 3306),
	user: process.env.DB_USER,
	password: process.env.DB_PASS,
	database: process.env.DB_NAME
}).then(async ()=>{
	setlog();
	try {
		await initApp();
		const app = express()
		const server = http.createServer(app)
		const key = fs.readFileSync(__dirname+'/../certs/private.key', 'utf8')
		const cert = fs.readFileSync(__dirname+'/../certs/star.icicbchain.org.crt', 'utf8')
		const caBundle = fs.readFileSync(__dirname+'/../certs/star.icicbchain.org.ca-bundle', 'utf8')
		const ca = caBundle.split('-----END CERTIFICATE-----\n') .map((cert) => cert +'-----END CERTIFICATE-----\n')
		ca.pop()
		const options = {cert,key,ca}
		const httpsServer = https.createServer(options,app)

		
		app.use(shrinkRay())
		app.use(cors({
			origin: function(origin, callback){
				return callback(null, true)
			}
		}))
		app.use(express.urlencoded())
		app.use(express.json())
		const FRONTENDPATH = path.normalize(__dirname + '/../../frontend/build')
		app.use(express.static(FRONTENDPATH))
		app.use('/api/v1', Api);
		/* app.get('admin/bridge', (req,res) => {
			const filename = FRONTENDPATH+'/index.html'
			if (fs.existsSync(filename)) {
				res.sendFile(FRONTENDPATH+'/index.html')
			} else {
				res.status(404).send('')
			}
			
		}) */
		app.get('*', (req,res) => {
			const filename = FRONTENDPATH+'/index.html'
			if (fs.existsSync(filename)) {
				res.sendFile(FRONTENDPATH+'/index.html')
			} else {
				res.status(404).send('')
			}
			
		})

		
		let time = +new Date()
		await new Promise(resolve=>server.listen(port, ()=>resolve(true)))
		setlog(`Started HTTP service on port ${port}. ${+new Date()-time}ms`)
		time = +new Date()
		await new Promise(resolve=>httpsServer.listen(portHttps, ()=>resolve(true)))
		setlog(`Started HTTPS service on port ${portHttps}. ${+new Date()-time}ms`)
	} catch (err:any) {
		setlog("init", err)
		process.exit(1)
	}
})