const mysql = require('mysql');
// import MySQLModel from '../MySQLModel';

require("dotenv").config()

const host = process.env.DB_HOST
const user = process.env.DB_USER
const password = process.env.DB_PASS
const database = process.env.DB_NAME

var con = mysql.createConnection({
    host,
    user,
    password
});

export const connection = mysql.createConnection({
    host,
    user,
    password,
    database
});

export const mysqlconnect = (callback: any) => {
    con.connect(function (err: any) {
        if (err) {
            console.log('connect failed');
            throw err;
        };
        console.log("Connected!");
        con.query(`CREATE DATABASE IF NOT EXISTS ${database}`, function (err: any, result: any) {
            if (err) throw err;
            console.log("Database created");
            connection.connect(function (err: any) {
                if (err) throw err;
                console.log('Will create Tables')
                var blocks = "CREATE TABLE IF NOT EXISTS `blocks` (\
                        `key` char(5) NOT NULL,\
                        `height` bigint(20) unsigned DEFAULT 0,\
                        PRIMARY KEY (`key`) USING BTREE\
                        ) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 ROW_FORMAT=FIXED";

                var events = "CREATE TABLE IF NOT EXISTS `events` (\
                            `key` varchar(100) NOT NULL,\
                        `blocknumber` bigint(11) unsigned DEFAULT 0,\
                        `address` varchar(42) DEFAULT NULL,\
                        `token` varchar(42) DEFAULT NULL,\
                        `chain` int(11) unsigned DEFAULT 0,\
                        `targetchain` int(11) unsigned DEFAULT 0,\
                        `value` varchar(32) DEFAULT '0',\
                        `fee` varchar(32) DEFAULT '0',\
                        `sendvalue` varchar(32) DEFAULT '0',\
                        `tx` varchar(100) DEFAULT NULL,\
                        `err` tinyint(4) unsigned DEFAULT 0,\
                        `senderr` tinyint(4) unsigned DEFAULT 0,\
                        `updated` int(11) unsigned DEFAULT 0,\
                        `created` int(11) unsigned DEFAULT 0,\
                        PRIMARY KEY (`key`) USING BTREE\
                        ) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC";
                var prices = "CREATE TABLE IF NOT EXISTS `prices` (\
                        `key` varchar(10) NOT NULL,\
                        `price` varchar(20) DEFAULT NULL,\
                        `updated` int(11) unsigned DEFAULT 0,\
                        PRIMARY KEY (`key`) USING BTREE\
                        ) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC";

                var tokens = "CREATE TABLE IF NOT EXISTS `tokens` (\
                        `id` int(10) unsigned NOT NULL AUTO_INCREMENT,\
                        `chain` varchar(10) DEFAULT NULL,\
                        `token` varchar(42) DEFAULT NULL,\
                        `symbol` varchar(10) DEFAULT NULL,\
                        `decimals` tinyint(4) unsigned DEFAULT 0,\
                        `token_real` varchar(42) DEFAULT NULL,\
                        PRIMARY KEY (`id`) USING BTREE\
                        ) ENGINE=MyISAM AUTO_INCREMENT=2043 DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC";

                var utxos = "CREATE TABLE IF NOT EXISTS `utxos` (\
                        `key` varchar(200) NOT NULL,\
                        `chain` varchar(10) DEFAULT NULL,\
                        `address` varchar(100) DEFAULT NULL,\
                        `hash` varchar(100) DEFAULT NULL,\
                        `vout` int(11) unsigned DEFAULT 0,\
                        `value` bigint(20) unsigned DEFAULT 0,\
                        `height` bigint(20) unsigned DEFAULT 0,\
                        `spent` tinyint(4) unsigned DEFAULT 0,\
                        `updated` int(11) unsigned DEFAULT 0,\
                        `created` int(11) unsigned DEFAULT 0,\
                        PRIMARY KEY (`key`) USING BTREE\
                        ) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC";

                var wallets = "CREATE TABLE IF NOT EXISTS `wallets` (\
                        `id` int(11) unsigned NOT NULL AUTO_INCREMENT,\
                        `chain` varchar(10) DEFAULT NULL,\
                        `address` varchar(100) DEFAULT NULL,\
                        `email` varchar(60) DEFAULT NULL,\
                        `updated` int(11) unsigned DEFAULT 0,\
                        `created` int(11) unsigned DEFAULT 0,\
                        PRIMARY KEY (`id`) USING BTREE\
                        ) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC";
                connection.query(events, function (err: any, result: any) {
                    if (err) throw err;
                    console.log('events table created')
                    connection.query(blocks, function (err: any, result: any) {
                        if (err) throw err;
                        console.log('blocks table created')
                        connection.query(prices, function (err: any, result: any) {
                            if (err) throw err;
                            console.log('prices table created')
                            connection.query(tokens, function (err: any, result: any) {
                                if (err) throw err;
                                console.log('tokens table created')
                                connection.query(utxos, function (err: any, result: any) {
                                    if (err) throw err;
                                    console.log('utxos table created')
                                    connection.query(wallets, function (err: any, result: any) {
                                        if (err) throw err;
                                        console.log('wallets table created')
                                        callback('success');
                                    })
                                })
                            })
                        })
                    })
                })


            });
        });
    });
}



