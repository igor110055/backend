require('colors')
require('dotenv').config()

const MySQLModel =  require('../dist/MySQLModel').default

const { expect } = require("chai");


const connectDatabase = async () => {
    return MySQLModel.connect({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME
    })
}

describe("backend", ()=>{

	it("test getting prices", async ()=>{
		await connectDatabase()
        const api = require('../dist/api')
        const inserts = await api.checkPrices();
        console.log(inserts)
		expect(inserts.length>0);
	})
})