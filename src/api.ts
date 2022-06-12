require("dotenv").config();
import * as express from 'express';
import axios from 'axios';
import MySQLModel from './MySQLModel';
import { setlog } from './helper';
import { listenerCount } from 'process';
import 'colors';
const router = express.Router();
const Web3 = require('web3');
const Tokens = new MySQLModel('tokens');
const Prices = new MySQLModel('prices', 'key');
const Blocks = new MySQLModel('blocks', 'key');
const Events = new MySQLModel('events', 'key');

const networks = require('../../frontend/src/config/networks.json');
const abi = require('../../frontend/src/config/abis/Bridge.json');

const utils = new Web3().utils;
const toHex = (val: string | number): string => utils.toHex(val);
const NULLADDRESS = '0x0000000000000000000000000000000000000000';

interface GlobalType {
	keys: { [network: string]: string }
	prices: { [symbol: string]: number }
	chainIds: { [chainId: number]: string }
	tokens: {
		[network: string]: {
			[token: string]: {
				symbol: string
				decimals: number
			}
		}
	}
	coins: { [symbol: string]: { [network: string]: { address: string, decimals: number } } }
}

interface PriceType {
	key: string
	price: number
	updated: number
}

const G: GlobalType = {
	keys: {

		BSC: process.env.PRIVKEY_BSC || '',
		CRO: process.env.PRIVKEY_CRO || '',
		POL: process.env.PRIVKEY_POL || '',
	},
	prices: {},
	chainIds: {},
	tokens: {},
	coins: {}
}

export const initApp = async () => {
	setlog("Read tokens")
	const rowTokens: any = await Tokens.find({}, { id: 1 })
	if (rowTokens === null) {
		return console.log('Please wait request from frontend for data insert\n'.yellow)
	} else {
		for (let v of rowTokens) {
			if (G.tokens[v.chain] === undefined) G.tokens[v.chain] = {}
			G.tokens[v.chain][v.token] = { symbol: v.symbol, decimals: v.decimals }
			if (G.coins[v.symbol] === undefined) G.coins[v.symbol] = {}
			G.coins[v.symbol][v.chain] = { address: v.token, decimals: v.decimals }
		}
	}
	for (let k in networks) {
		if (G.chainIds[networks[k].chainId] === undefined) G.chainIds[networks[k].chainId] = k
	}
	setlog("Read prices")
	const rowPrices: any = await Prices.find()
	if (rowPrices === null) {
		await checkPrices();
		return console.log('Prices entered, Please restart server'.blue);
	}
	else {
		for (let v of rowPrices) {
			G.prices[v.key] = Number(v.price)
		}
	}
	setlog("started cron prices")
	const cronPrices = async () => {
		await checkPrices()
		setTimeout(cronPrices, 60000)
	}
	cronPrices()
	setlog("started cron chains")

	/* cronChain('ETH') */
	/* cronChain('ICICB') */
	/* cronChain('BSC') */
	for (let k in networks) {
		cronChain(k)
	}
	setlog("completed initapp")
}
export const cronChain = async (key: string) => {
	/* console.log(new Date() + ': cron key=' + key) */
	await checkChain(key)
	await checkEvents(key)
	setTimeout(() => cronChain(key), 15000)
}

export const checkPrices = async (): Promise<Array<PriceType>> => {
	const pairs: { [key: string]: string } = {
		BNB: 'BNBUSDT',
	}

	const inserts: Array<PriceType> = [];
	const updated = Math.round(new Date().getTime() / 1000)
	try {
		for (let key in pairs) {
			const result: any = await axios('https://api.binance.com/api/v3/ticker/price?symbol=' + pairs[key])
			if (result !== null && result.data && result.data.price) {
				const price = Number(result.data.price)
				if (G.prices[key] !== price) {
					G.prices[key] = price
					inserts.push({ key, price, updated })
				}
			}
			await new Promise(resolve => setTimeout(resolve, 500))
		}
		if (inserts.length) {
			await Prices.insertOrUpdate(inserts)
		}
	} catch (err: any) {
		setlog(err)
	}
	return inserts
}

const evm_sendtx = async (feeOnly: boolean, rpc: string, privkey: string, to: string, abi: any, method: string, args: any[]): Promise<string | bigint | null> => {
	try {

		// const tx = await evm_sendtx(false, net.rpc, G.keys[key], net.bridge, abi, 'transfer', [param])
		console.log('feeOnly, rpc, privkey, to, "abi", method, args')
		console.log(feeOnly, rpc, privkey, to, 'abi', method, args)

		const web3 = new Web3(rpc)
		const account = web3.eth.accounts.privateKeyToAccount(privkey)
		const contract = new web3.eth.Contract(abi, to, { from: account.address, })
		const data = contract.methods[method](...args).encodeABI()
		const gasPrice = await web3.eth.getGasPrice()
		const gasLimit = await contract.methods[method](...args).estimateGas()
		if (feeOnly)
			return BigInt(gasPrice) * BigInt(gasLimit) // Math.ceil(Number(gasPrice)/1e9 * gasLimit / 1e3)/1e6;

		const json = { gasPrice, gasLimit, to, value: 0x0, data }
		const signedTx: any = await web3.eth.accounts.signTransaction(json, privkey)
		const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction)
		if (receipt && receipt.transactionHash) return receipt.transactionHash
	} catch (err: any) {

		setlog('evm_sendtx  Err :')
		setlog(err)
	}
	return null
}

const evm_checktx = async (rpc: string, confirmations: number, txs: Array<string>): Promise<{ [txId: string]: number }> => {
	const web3 = new Web3(rpc)
	const height = await web3.eth.getBlockNumber()
	const limit = 20
	const count = txs.length
	const results: { [txId: string]: number } = {}
	for (let i = 0; i < count; i += limit) {
		const json: Array<{ jsonrpc: string, method: string, params: Array<string>, id: number }> = []
		let iEnd = i + limit
		if (iEnd > count) iEnd = count
		for (let k = i; k < iEnd; k++) {
			json.push({ jsonrpc: '2.0', method: 'eth_getTransactionReceipt', params: [txs[k]], id: k++ })
		}
		const result: any = await axios({
			method: 'post',
			url: rpc,
			data: json,
			headers: { 'Content-Type': 'application/json' }
		})
		if (result !== null && Array.isArray(result.data)) {
			for (let v of result.data) {
				results[txs[v.id]] = v.result && v.result.status === '0x1' ? (height - Number(v.result.blockNumber) + 1 >= confirmations ? 1 : 0) : -1
			}
		}
	}
	return results
}

const checkChain = async (key: string) => {
	try {
		const net = networks[key] as NetworkTypes
		const web3 = new Web3(net.rpc)
		const contract = new web3.eth.Contract(abi, net.bridge)
		const height = await web3.eth.getBlockNumber()
		const row = await Blocks.findOne(key);
		if (row !== null) {

			const start = row.height + 1;
			const limit = 1000
			const inserts = [];
			for (let i = start; i <= height; i += limit) {
				let toBlock = i + limit
				if (toBlock > height) toBlock = height;
				const events = await contract.getPastEvents("Deposit", { fromBlock: i, toBlock })
				for (const v of events) {
					const key = v.transactionHash
					const blocknumber = v.blockNumber
					const { token, from, amount, targetChain } = v.returnValues
					inserts.push({ key, blocknumber, address: from, token: token === NULLADDRESS ? null : token, chain: net.chainId, targetChain, value: toHex(amount), created: Math.round(new Date().getTime() / 1000) })

					setlog(`detect: ${key} #${blocknumber}  target:${targetChain} from:[${from}] tx: [${key}] amount:[${amount}]`)
				}
				/* console.log(key + " blockheight: " + toBlock + ' / ' + height) */
				await new Promise(resolve => setTimeout(resolve, 1000))
			}
			if (inserts.length) await Events.insert(inserts)
		}
		await Blocks.insertOrUpdate({ key, height })
	} catch (err: any) {
		setlog("checkChain : hook-" + key, err)
	}
}

const getTokenFee = (fee: bigint, chain: string, token: string) => {
	// BigInt(10**(G.tokens[chain][token].decimals - 6))
	// setlog('getTokenFee start')
	// setlog('fee, chain, token')
	// setlog('fee :' + fee)
	// setlog('chain : ' + chain)
	// setlog('token : ' + token)
	// setlog('G.prices[networks[chain].coin] : ' + G.prices[networks[chain].coin])
	// setlog('G.prices[token] : ' + G.prices[token])
	const rate = BigInt(Math.round(G.prices[networks[chain].coin] * 1e6 / G.prices[token]))
	setlog('rate ' + rate)
	return fee * rate / BigInt(1e6)
	// return fee
}

const getTxParams = (chain: string, rows: Array<any>, fee?: bigint) => {

	// const param = getTxParams(key, ts, realfee);
	setlog('key, ts, realfee')
	console.log(chain)
	console.log(rows)
	console.log(fee)
	const params = []
	for (let row of rows) {
		if (row) {
			const symbol = row.token === null ? networks[G.chainIds[row.chain]].coin : G.tokens[G.chainIds[row.chain]][row.token].symbol
			if (symbol) {
				const token = G.coins[symbol][chain].address
				let value = BigInt(row.value)
				let extra = row.key
				if (fee) {
					// const realfee = getTokenFee(fee, chain, symbol)// BigInt(Math.ceil( * 1e6)) * BigInt(10**(G.tokens[chain][token].decimals - 6))
					// setlog('getTokenFee -> realfee : ' + realfee)
					// if (value < realfee) continue
					// value -= realfee
				}
				if (token) {
					params.push([
						token === '-' ? NULLADDRESS : token, // _token
						row.address, // _to
						value,
						extra
					])
				}
			}
		}
	}
	console.log('params : ' + params)
	return params
}

const checkEvents = async (key: string) => {
	try {
		const net = networks[key] as NetworkTypes
		const rows = await Events.find({ targetchain: net.chainId, err: 0, senderr: 0, tx: null })
		if (rows !== null) {
			const updated = Math.round(new Date().getTime() / 1000)
			const rowTxs: { [txId: string]: any } = {}
			const chains: { [chainId: string]: Array<string> } = {}

			for (let v of rows) {
				rowTxs[v.key] = v;
				if (chains[v.chain] === undefined) chains[v.chain] = []
				chains[v.chain].push(v.key)
			}
			const results = await Promise.all(Object.keys(chains).map(k => evm_checktx(networks[G.chainIds[Number(k)]].rpc, networks[G.chainIds[Number(k)]].confirmations, chains[k])))
			const updates: Array<{ key: string, tx: string | null, fee: string, sendvalue: string, err: number, senderr: number, updated: number }> = []
			const txs: Array<string> = []
			for (let res of results) {
				for (let k in res) {
					if (res[k] === -1) {
						updates.push({ key: k, tx: null, fee: "0", sendvalue: "0", err: 1, senderr: 0, updated })
					} else if (res[k] === 1) {
						txs.push(k)
					}
				}
			}
			if (txs.length) {
				const limit = 50
				const count = txs.length

				for (let i = 0; i < count; i += limit) {
					let iEnd = i + limit
					if (iEnd > count)
						iEnd = count
					const ts = []
					for (let k = i; k < iEnd; k++) {
						ts.push(rowTxs[txs[k]])
					}
					// if (key === 'ICICB') {
					// 	const tx = await evm_sendtx(false, net.rpc, G.keys[key], net.bridge, abi, 'transfer', [getTxParams(key, ts)])
					// 	if (typeof tx === 'string') {
					// 		for (let v of ts) {
					// 			updates.push({ key: v.key, tx, fee: "0", sendvalue: v.value, err: 0, senderr: 0, updated })
					// 			setlog(`send: target ${key} from:[address:${v.address}, value:${v.value} tx:${v.key}] ${tx}`)
					// 		}
					// 	}
					// } else {
					const fee = await evm_sendtx(true, net.rpc, G.keys[key], net.bridge, abi, 'transfer', [getTxParams(key, ts)])
					setlog('this is fee result: ' + fee);
					if (typeof fee === 'bigint') {
						setlog('fee is bigint: ' + typeof fee);

						const realfee = fee / BigInt(ts.length)
						setlog('realfee is : ' + realfee);
						const param = getTxParams(key, ts, realfee);
						setlog('param is : ' + param);
						// current here is normal


						const tx = await evm_sendtx(false, net.rpc, G.keys[key], net.bridge, abi, 'transfer', [param])
						if (typeof tx === 'string') {
							for (let v of ts) {
								updates.push({ key: v.key, tx, fee: '0x' + realfee.toString(16), sendvalue: v.value, err: 0, senderr: 0, updated })
								setlog(`send: target ${key} from:[address:${v.address}, value:${v.value}, fee:${realfee}, tx:${v.key}] ${tx}`)
							}
						}
					} else {
						for (let v of ts) {
							updates.push({ key: v.key, tx: null, fee: "0", sendvalue: "0", err: 0, senderr: 1, updated })
						}
						setlog(`send: target ${key} fee error`)
					}
					// }
				}
			}
			if (updates.length) await Events.insertOrUpdate(updates)
		}
	} catch (err: any) {
		setlog("checkEvents : hook-" + key, err)
	}
}

router.post("/get-txs", async (req, res, next) => {
	try {
		console.log('client request')
		const txs = req.body
		if (txs.length > 10) return res.status(429).json({ err: 'too many requests' })
		if (!Array.isArray(txs)) return res.status(429).json({ err: 'invalid format' })
		const results: { [key: string]: { tx: string, err: boolean, fee?: number } } = {}
		for (let v of txs) {
			if (!/0x[0-9a-fA-F]{64}/.test(v)) return res.status(429).json({ err: 'invalid format' })
			results[v] = { tx: '', err: true }
		}
		const rows = await Events.find({ key: txs })
		if (rows) {
			for (let v of rows) {
				if (v.tx) {
					const decimals = networks[G.chainIds[v.targetchain]].decimals - 6
					results[v.key].fee = Number(BigInt(v.fee) / BigInt(10 ** decimals)) / 1e6
					results[v.key].tx = v.tx
					results[v.key].err = false
				} else if (!v.err) {
					results[v.key].err = false
				}
			}
		}
		return res.json(Object.keys(results).map(key => ({ ...results[key], key })))
	} catch (err: any) {
		setlog(err)
	}
	res.status(404).json({ err: 'unknown' })
})

router.get("/all-tokens", async (req, res, next) => {
	res.json(G.coins);
})

router.post("/input-chain-info", async (req, res, next) => {
	try {
		console.log('client request input-chain-info')
		console.log(req.body);
		const chainInfo = await Tokens.find();
		// console.log(chainInfo)
		const data = req.body;
		// myOjbect is the object you want to iterate.
		// Notice the second argument (secondArg) we passed to .forEach.
		Tokens.deleteAll();
		Object.keys(data.info).forEach(async function (element, index, _array) {
			// element is the name of the key.
			// key is just a numerical value for the array
			// _array is the array of all the keys
			console.log(element, data.info[element].address, data.info[element].decimals, data.token);
			await Tokens.insertOrUpdate({ 'chain': element, 'token': data.info[element].address, 'symbol': data.token, 'decimals': data.info[element].decimals });

		});
		// await Blocks.insertOrUpdate({ key, height })
	} catch (err: any) {
		setlog(err);
	}
	res.status(404).json({ err: 'unknown' })
})
export default router