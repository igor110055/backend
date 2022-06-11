require("dotenv").config();

import * as fs from 'fs';
import * as crypto from 'crypto';


export const setlog = (title: string = 'started', msg: string | Error | null = null): void => {
	const date = new Date();
	let y: number = date.getUTCFullYear();
	let m: number = date.getUTCMonth() + 1;
	let d: number = date.getUTCDate();
	let hh: number = date.getUTCHours();
	let mm: number = date.getUTCMinutes();
	let ss: number = date.getUTCSeconds();
	let datetext: string = [y, ('0' + m).slice(-2), ('0' + d).slice(-2)].join('-');
	let timetext: string = [('0' + hh).slice(-2), ('0' + mm).slice(-2), ('0' + ss).slice(-2)].join(':');
	if (msg instanceof Error) msg = msg.stack || msg.message;
	let bStart = 0;
	if (title === 'started') {
		bStart = 1;
		title = 'WebApp Started.';
	}
	if (msg) msg = msg.split(/\r\n|\r|\n/g).map(v => '\t' + v).join('');
	let text = `[${timetext}] ${title}\r\n${msg === null ? '' : msg + '\r\n'}`;
	fs.appendFileSync(__dirname + '/../logs/' + datetext + '.log', (bStart ? '\r\n\r\n\r\n' : '') + text);
	console.log(text);
};

export interface DATEFIELDS {
	prefixAgo: string,
	prefixFromNow: string,
	suffixAgo: string,
	suffixFromNow: string,
	seconds: string,
	minute: string,
	minutes: string,
	hour: string,
	hours: string,
	day: string,
	days: string,
	month: string,
	months: string,
	year: string,
	years: string,
	wordSeparator: string,
	inPast?: string,
	numbers?: Array<number>
}
export interface DATELANGS {
	'en': DATEFIELDS,
	'zh-cn': DATEFIELDS,
	'zh-tw': DATEFIELDS,
	'ko': DATEFIELDS,
	'ja': DATEFIELDS,
}
