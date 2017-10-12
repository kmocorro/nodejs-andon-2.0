var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);

var mysql = require('./dbconfig/config').pool;
var bodyParser = require('body-parser');
var moment = require('moment');
var TSV = require('tsv');

var Promise = require('bluebird');

var fs = require('fs');

var port = process.env.PORT || 2000;

app.use('/', express.static(__dirname + '/public'));
app.set('view engine', 'ejs');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

Date.prototype.toJSON = function() {
    return moment(this).format("YYYY-MM-DD");
}

let today = new Date();

let dd = today.getDate();
let mm = today.getMonth() + 1; // january starts at 0
let yyyy = today.getFullYear();

if(dd<10) {
    dd = '0'+dd
} 
if(mm<10) {
    mm = '0'+mm
}

//  will use this for query real-time 
today = '2017' + '-' + '10' + '-' + '11';

//  index
app.get('/', function(req, res){
    
});

//  per process
app.get('/realtime/:process_url', function(req, res){
    let process_url = req.params.process_url;
    res.render('process', {process: process_url});
});

io.on('connection', function(socket){
    // HOURLY move socket
    socket.on('moves', function(process_data){

        let process_from_emit = process_data.process_data;

        mysql.getConnection(function(err, connection){
            
            connection.query({
               sql:'SELECT process_id, SUM(out_qty) AS out_qty, HOUR(DATE_ADD(date_time, INTERVAL -390 MINUTE)) + 1 AS fab_hour , count(*) AS num_moves FROM MES_OUT_DETAILS WHERE process_id = ? AND DATE(DATE_ADD(date_time, INTERVAL -390 MINUTE)) = DATE(DATE_ADD(?, INTERVAL -0 MINUTE)) GROUP BY process_id, HOUR(DATE_ADD(date_time, INTERVAL -390 MINUTE))',
               values: [process_from_emit, today] 
            },  function(err, results, fields){
                    let obj=[];
                        for(let i=0;i<results.length;i++){
                            obj.push({
                                hour: parseInt(results[i].fab_hour),
                                moves: results[i].num_moves
                            });
                        }
                    let process_obj = TSV.stringify(obj);
                socket.emit('process_obj', process_obj);
                
            });
        connection.release();
        });
    });

    // YIELD socket
    socket.on('yield', function(process_data){    
        let process_from_emit = process_data.process_data;
        // query promise :O
        function queryYield(){
            return new Promise(function(resolve, reject){
                mysql.getConnection(function(err, connection){
                    connection.query({
                        sql: 'SELECT B.eq_name, sum(A.scrap_qty) AS scrap_qty, sum(C.out_qty) AS out_qty  FROM MES_SCRAP_DETAILS A   JOIN MES_EQ_INFO B ON A.eq_id = B.eq_id   JOIN MES_OUT_DETAILS C ON A.lot_id = C.lot_id  WHERE DATE(DATE_ADD(A.date_time, INTERVAL -390 MINUTE)) = DATE(DATE_ADD(?, INTERVAL -0 MINUTE)) AND A.process_id = ?  AND DATE(DATE_ADD(C.date_time, INTERVAL -390 MINUTE)) = DATE(DATE_ADD(?, INTERVAL -0 MINUTE))  group by B.eq_name',
                        values: [today, process_from_emit, today]
                    },  function(err, results, fields){
                            if(err){reject(err);}
                            let yield_obj=[];
                                for(let i=0;i<results.length;i++){
                                    yield_obj.push({
                                        name: results[i].eq_name, 
                                        size: ((results[i].scrap_qty / (results[i].out_qty + results[i].scrap_qty)) * 100).toFixed(2)
                                    });
                                }
                            resolve(yield_obj);
                    });
                connection.release();
                });
            });
        }

        function queryYieldTarget(){
            return new Promise(function(resolve, reject){
                // change this to local mysql,
                // have a db, table, -> toolname, yield target per tool
                mysql.getConnection(function(err, connection){
                    connection.query({
                        sql: 'SELECT B.eq_name, sum(A.scrap_qty) AS scrap_qty, sum(C.out_qty) AS out_qty  FROM MES_SCRAP_DETAILS A   JOIN MES_EQ_INFO B ON A.eq_id = B.eq_id   JOIN MES_OUT_DETAILS C ON A.lot_id = C.lot_id  WHERE DATE(DATE_ADD(A.date_time, INTERVAL -390 MINUTE)) = DATE(DATE_ADD(?, INTERVAL -0 MINUTE)) AND A.process_id = ?  AND DATE(DATE_ADD(C.date_time, INTERVAL -390 MINUTE)) = DATE(DATE_ADD(?, INTERVAL -0 MINUTE))  group by B.eq_name',
                        values: [today, process_from_emit, today]
                    },  function(err, results, fields){
                            if(err){reject(err);}
                            let target_obj=[];
                                for(let i=0;i<results.length;i++){
                                    target_obj.push({
                                        name: results[i].eq_name, 
                                        size: ((results[i].scrap_qty / (results[i].out_qty + results[i].scrap_qty)) * 100).toFixed(2)
                                    });
                                }
                            resolve(target_obj);
                    });
                connection.release();
                });
            });
        }
        
        queryYield().then(function(try_obj){
            return queryYieldTarget().then(function(line_obj){
                socket.emit('yield_obj', TSV.stringify(try_obj), TSV.stringify(line_obj));
            });
        });
        
    });

    // PIE socket top 5 defect
    socket.on('pie', function(process_data){
        let process_from_emit = process_data.process_data;

        mysql.getConnection(function(err, connection){
            connection.query({
                sql: 'SELECT scrap_code, SUM(scrap_qty) AS scrap_qty FROM MES_SCRAP_DETAILS WHERE DATE(DATE_ADD(date_time, INTERVAL -390 MINUTE)) = DATE(DATE_ADD(?, INTERVAL -0 MINUTE)) AND process_id = ? GROUP BY scrap_code ORDER BY SUM(scrap_qty) DESC LIMIT 5',
                values: [today, process_from_emit]
            },  function(err, results, fields){
                    let obj=[];
                        for(let i=0;i<results.length;i++){
                            obj.push({
                                scrap_code: results[i].scrap_code,
                                scrap_qty: results[i].scrap_qty
                            });
                        }
                    let pie_obj= TSV.stringify(obj);
                socket.emit('pie_obj', pie_obj);
            });
        connection.release();
        });
        
    });

    // Overall Yield Loss
    socket.on('yieldloss', function(process_data){
        let process_from_emit = process_data.process_data;

            function queryTotalOuts(){
                return new Promise(function(resolve, reject){
                    mysql.getConnection(function(err, connection){
                        connection.query({
                            sql: 'SELECT SUM(out_qty) AS out_qty FROM MES_OUT_DETAILS WHERE DATE(DATE_ADD(date_time, INTERVAL -390 MINUTE)) = DATE(DATE_ADD(?, INTERVAL -0 MINUTE)) AND process_id = ?',
                            values: [today, process_from_emit]
                        },  function(err, results, fields){
                            if(err){reject(err);}
                                let totalOuts_obj=[];
                                    totalOuts_obj.push({
                                        outs: results[0].out_qty
                                    });
                                resolve(totalOuts_obj);
                        });
                        connection.release();
                    });
                });
            }

            function queryTotalScrap(){
                return new Promise(function(resolve, reject){
                    mysql.getConnection(function(err, connection){
                        connection.query({
                            sql: 'SELECT SUM(scrap_qty) AS scrap_qty FROM MES_SCRAP_DETAILS WHERE DATE(DATE_ADD(date_time, INTERVAL -390 MINUTE)) = DATE(DATE_ADD(?, INTERVAL -0 MINUTE)) AND process_id = ?',
                            values: [today, process_from_emit]
                        },  function(err, results, fields){
                                let totalScrap_obj=[];
                                    totalScrap_obj.push({
                                        scrap: results[0].scrap_qty
                                    });
                                resolve(totalScrap_obj);
                        });
                        connection.release();
                    });
                });
            }

            queryTotalOuts().then(function(totalOuts_obj){
                return queryTotalScrap().then(function(totalScrap_obj){
                    let overall_yield = ((totalScrap_obj[0].scrap / (totalOuts_obj[0].outs + totalScrap_obj[0].scrap)));
                    socket.emit('overall_yield', overall_yield);
                });
            });
    });

    // OEE
    socket.on('oee', function(process_data){
        let process_from_emit = process_data.process_data;

            function queryToolStat(){
                return new Promise(function(resolve, reject){
                    mysql.getConnection(function(err, connection){
                        connection.query({
                            sql: 'SELECT pretty_table.eq_name, COALESCE(P,0) AS P, COALESCE(SU,0) AS SU,    COALESCE(SD,0) AS SD,   COALESCE(D,0) AS D,   COALESCE(E,0) AS E,   COALESCE(SB,0) AS SB FROM     (SELECT extended_table.eq_name,         SUM(P) AS P,         SUM(SU) AS SU, SUM(SD) AS SD,    SUM(D) AS D,    SUM(E) AS E,    SUM(SB) AS SB   FROM  (SELECT base_table.*,      CASE WHEN base_table.stat_id = "P" THEN base_table.duration END AS P,      CASE WHEN base_table.stat_id = "SU" THEN base_table.duration END AS SU,      CASE WHEN base_table.stat_id = "SD" THEN base_table.duration END AS SD,    CASE WHEN base_table.stat_id = "D" THEN base_table.duration END AS D,   CASE WHEN base_table.stat_id = "E" THEN base_table.duration END AS E,   CASE WHEN base_table.stat_id = "SB" THEN base_table.duration END AS SB  FROM          (SELECT C.eq_name, B.stat_id,    SUM(  ROUND(    IF((TIME_TO_SEC(    TIMEDIFF(IF(B.time_out IS NULL,CONVERT_TZ(NOW(),@@SESSION.TIME_ZONE,"+08:00"),B.time_out),IF(B.time_in < CONCAT(?," 06:30:00"), CONCAT(?," 06:30:00"), B.time_in))) /3600)<0,0,(TIME_TO_SEC(   TIMEDIFF(IF(B.time_out IS NULL,CONVERT_TZ(NOW(),@@SESSION.TIME_ZONE,"+08:00"),B.time_out),IF(B.time_in < CONCAT(?," 06:30:00"), CONCAT(?," 06:30:00"), B.time_in))) /3600)),2)) AS duration    FROM         (SELECT eq_id, proc_id            FROM MES_EQ_PROCESS  WHERE proc_id = ? GROUP BY eq_id) A  JOIN      MES_EQ_CSTAT_HEAD B   ON A.eq_id = B.eq_id   JOIN       MES_EQ_INFO C    ON A.eq_id = C.eq_id   WHERE   DATE(DATE_ADD(B.time_in, INTERVAL -0 MINUTE)) = DATE(DATE_ADD(?, INTERVAL 0 DAY))   AND A.proc_id = ?        GROUP BY  C.eq_name, B.stat_id) base_table) extended_table  GROUP BY extended_table.eq_name) pretty_table',
                            values: [today, today, today, today, process_from_emit, today, process_from_emit]
                        },  function(err, results, fields){
                                if(err){reject(err);}
                                    let toolStat_obj=[];
                                        for(let i=0;i<results.length;i++){
                                            toolStat_obj.push({
                                                eq_name: results[i].eq_name,
                                                PRODUCTIVE: results[i].P,
                                                SETUP: results[i].SU,
                                                SCHEDULED_DT: results[i].SD,
                                                UNSCHEDULED_DT: results[i].D,
                                                ENGINEERING: results[i].E,
                                                STANDBY: results[i].SB
                                            });
                                        }
                                    resolve(toolStat_obj);
                        });
                    connection.release();
                    });
                });
            }
            
            queryToolStat().done(function(toolStat_obj){
                socket.emit('toolStat_obj', TSV.stringify(toolStat_obj));
            });
    });
});

server.listen(port);

