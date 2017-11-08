var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);

var mysql = require('./dbconfig/config').pool;
var mysqlLocal = require('./dbconfig/configLocal').poolLocal;
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
today = '2017' + '-' + '11' + '-' + '3';


//  index
app.get('/', function(req, res){
    res.render('index');
});

//  validate local settings changes
app.post('/validate/settings', function(req, res){


});

//  edit local settings
app.get('/settings', function(req, res){
    res.render('settings');
});

//  query tool local settings home page
app.post('/toolLocalSettings', function(req, res){
    mysqlLocal.getConnection(function(err, connection){
        connection.query({
            sql: 'SELECT eq_id, process_name, eq_name, uph, oee_target, yield_target FROM tbl_default'
        },  function(err, results, fields){
            let toolLocalSettings_obj=[];
                for(let i=0;i<results.length;i++){
                    toolLocalSettings_obj.push({
                        eq_id: results[i].eq_id,
                        process_name: results[i].process_name,
                        eq_name: results[i].eq_name,
                        uph: results[i].uph,
                        oee_target: results[i].oee_target,
                        yield_target: results[i].yield_target
                    });
                }
            res.send(JSON.stringify(toolLocalSettings_obj));
        });
        connection.release();
    });
});

//  query tool local settings home page
app.get('/toolLocalSettings/:expand_url', function(req, res){
    let expand_url = req.params.expand_url;
    mysqlLocal.getConnection(function(err, connection){
        connection.query({
            sql: 'SELECT eq_id, process_name, eq_name, uph, oee_target, yield_target FROM tbl_default WHERE eq_id=?',
            values:[expand_url]
        },  function(err, results, fields){
            let toolLocalSettings_obj=[];
                for(let i=0;i<results.length;i++){
                    toolLocalSettings_obj.push({
                        eq_id: results[i].eq_id,
                        process_name: results[i].process_name,
                        eq_name: results[i].eq_name,
                        uph: results[i].uph,
                        oee_target: results[i].oee_target,
                        yield_target: results[i].yield_target
                    });
                }
                let toolSettings = JSON.stringify(toolLocalSettings_obj);
            res.render('settings_form', {toolSettings});
        });
        connection.release();
    });
});

//  save changes
app.post('/updateLocalSettings', function(req, res){
    let post_eq = req.body.eq_id;
    let post_uph = req.body.uph;
    let post_oee = req.body.oee_target;
    let post_yield = req.body.yield_target;

    console.log(post_eq);
    console.log(post_uph);
    console.log(post_oee);
    console.log(post_yield);


    mysqlLocal.getConnection(function(err, connection){
        connection.query({
            sql: 'UPDATE tbl_default SET uph=?, oee_target=?, yield_target=? WHERE eq_id=?',
            values: [post_uph, post_oee, post_yield, post_eq]
        },  function(err, results, fields){
        });
        connection.release();
    });
});


//  realtime per process
//  known bugs as of 2017-10-23:
//  1.) "today" should be dynamic - DONE 2017-11-03 patched 2017-11-08
//  2.) "more error handling" fab_hour and mysql query
//  3.) "MRL" tools should be categorized per bank - get the comment section on the query and use the comment section to get the bank name
app.get('/realtime/:process_url', function(req, res){
    let process_url = req.params.process_url;
    res.render('process', {process: process_url});
});

io.on('connection', function(socket){
    // HOURLY move socket
    socket.on('moves', function(process_data){
        let process_from_emit = process_data.process_data;
        //let today_from_emit = moment(process_data.today_data).format('YYYY-MM-DD');
        // had to declare it as global for socket.on('moves')
        if(Date.parse(process_data.today_data) >= Date.parse(moment(process_data.today_data).format('YYYY-MM-DD, 00:00:00')) && Date.parse(process_data.today_data) <=  Date.parse(moment(process_data.today_data).format('YYYY-MM-DD, 06:29:59'))) {
            // this way, I could manipulate the date for PM-MIDNIGHT shift
            today_from_emit = moment(process_data.today_data).subtract(1, "days").format('YYYY-MM-DD');
            // console.log(today_from_emit);
        }else{
            // this way, I could manipulate the date for AM shift
            today_from_emit = moment(process_data.today_data).format('YYYY-MM-DD');
            // console.log(today_from_emit);
        }
        mysql.getConnection(function(err, connection){
            if(err){reject(err);}
            connection.query({
               sql:'SELECT process_id, SUM(out_qty) AS out_qty, HOUR(DATE_ADD(date_time, INTERVAL -390 MINUTE)) + 1 AS fab_hour , count(*) AS num_moves FROM MES_OUT_DETAILS WHERE process_id = ? AND DATE(DATE_ADD(date_time, INTERVAL -390 MINUTE)) = DATE(DATE_ADD(?, INTERVAL -0 MINUTE)) GROUP BY process_id, HOUR(DATE_ADD(date_time, INTERVAL -390 MINUTE))',
               values: [process_from_emit, today_from_emit] 
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
        //let today_from_emit = moment(process_data.today_data).format('YYYY-MM-DD');
        // had to declare it as global for socket.on('yield')
        if(Date.parse(process_data.today_data) >= Date.parse(moment(process_data.today_data).format('YYYY-MM-DD, 00:00:00')) && Date.parse(process_data.today_data) <=  Date.parse(moment(process_data.today_data).format('YYYY-MM-DD, 06:29:59'))) {
            // this way, I could manipulate the date for PM-MIDNIGHT shift
            today_from_emit = moment(process_data.today_data).subtract(1, "days").format('YYYY-MM-DD');
            // console.log(today_from_emit);
        }else{
            // this way, I could manipulate the date for AM shift
            today_from_emit = moment(process_data.today_data).format('YYYY-MM-DD');
            // console.log(today_from_emit);
        }
        // query promise :O
        function queryYield(){
            return new Promise(function(resolve, reject){
                mysql.getConnection(function(err, connection){
                    connection.query({
                        sql: 'SELECT A.eq_name AS eq_name, A.scrap_qty AS scrap_qty, B.out_qty AS out_qty FROM   (SELECT B.eq_name, SUM(A.scrap_qty) AS scrap_qty    FROM MES_SCRAP_DETAILS A      JOIN MES_EQ_INFO B  ON A.eq_id = B.eq_id     WHERE DATE(DATE_ADD(A.date_time, INTERVAL -390 MINUTE)) = DATE(DATE_ADD(?, INTERVAL -0 MINUTE))   AND A.process_id = ?     GROUP BY B.eq_name ) A JOIN   (SELECT B.eq_name, SUM(A.out_qty) AS out_qty     FROM MES_OUT_DETAILS A     JOIN MES_EQ_INFO B   ON A.eq_id = B.eq_id    WHERE DATE(DATE_ADD(A.date_time, INTERVAL -390 MINUTE)) = DATE(DATE_ADD(?, INTERVAL -0 MINUTE))   AND A.process_id = ?  GROUP BY B.eq_name ) B ON A.eq_name = B.eq_name',
                        values: [today_from_emit, process_from_emit, today_from_emit, process_from_emit]
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
                mysqlLocal.getConnection(function(err, connection){
                    if(err){reject(err);}
                    connection.query({
                        sql: 'SELECT * FROM tbl_default WHERE process_name = ?',
                        values: [process_from_emit]    
                    },  function(err, results, fields){
                        if(err){reject(err);}
                            let yieldTarget_obj=[];
                                for(let i=0;i<results.length;i++){
                                    yieldTarget_obj.push({
                                        name: results[i].eq_name,
                                        //named it size but in reality it's yield_target
                                        size: results[i].yield_target
                                    });
                                }
                            resolve(yieldTarget_obj);
                    });
                    connection.release();
                });
                
            });
        }
        
        queryYield().then(function(yield_obj){
            return queryYieldTarget().then(function(yieldTarget_obj){
                let line_obj=[];
                let try_obj=[];
                    for(let i=0;i<yield_obj.length;i++){
                        for(let j=0;j<yieldTarget_obj.length;j++){
                            if(yield_obj[i].name === yieldTarget_obj[j].name){
                                try_obj.push({
                                    name: yieldTarget_obj[i].name,
                                    size: yield_obj[i].size
                                });

                                line_obj.push({
                                    name: yieldTarget_obj[i].name,
                                    size: yieldTarget_obj[j].size
                                });
                            } else {
                                try_obj.push({
                                    name: yieldTarget_obj[i].name,
                                    size: 0
                                });

                                line_obj.push({
                                    name: yieldTarget_obj[i].name,
                                    size: yieldTarget_obj[j].size
                                });
                            }
                        }
                        
                    }
                    
                socket.emit('yield_obj', TSV.stringify(try_obj), TSV.stringify(line_obj));
            });
        });
        
    });

    // socket top 5 defect
    socket.on('scrap', function(process_data){
        let process_from_emit = process_data.process_data;
        //let today_from_emit = moment(process_data.today_data).format('YYYY-MM-DD');
        // had to declare it as global for socket.on('scrap')
        if(Date.parse(process_data.today_data) >= Date.parse(moment(process_data.today_data).format('YYYY-MM-DD, 00:00:00')) && Date.parse(process_data.today_data) <=  Date.parse(moment(process_data.today_data).format('YYYY-MM-DD, 06:29:59'))) {
            // this way, I could manipulate the date for PM-MIDNIGHT shift
            today_from_emit = moment(process_data.today_data).subtract(1, "days").format('YYYY-MM-DD');
            // console.log(today_from_emit);
        }else{
            // this way, I could manipulate the date for AM shift
            today_from_emit = moment(process_data.today_data).format('YYYY-MM-DD');
            // console.log(today_from_emit);
        }
        function queryScrapQty(){
            return new Promise(function(resolve, reject){
                mysql.getConnection(function(err, connection){
                    if(err){reject(err);}
                    connection.query({
                        sql: 'SELECT scrap_code, SUM(scrap_qty) AS scrap_qty FROM MES_SCRAP_DETAILS WHERE DATE(DATE_ADD(date_time, INTERVAL -390 MINUTE)) = DATE(DATE_ADD(?, INTERVAL -0 MINUTE)) AND process_id = ? GROUP BY scrap_code ORDER BY SUM(scrap_qty) DESC LIMIT 10',
                        values: [today_from_emit, process_from_emit]
                    },  function(err, results, fields){
                        if(err){reject(err);}
                            let scrap_obj=[];
                                for(let i=0;i<results.length;i++){
                                    scrap_obj.push({
                                        scrap_code: results[i].scrap_code,
                                        scrap_qty: results[i].scrap_qty
                                    });
                                }
                            resolve(scrap_obj);
                    });
                    connection.release();
                });
            });
        }

        function queryTotalOuts(){
            return new Promise(function(resolve, reject){
                mysql.getConnection(function(err, connection){
                    if(err){reject(err);}
                    connection.query({
                        sql: 'SELECT A.proc_id , SUM(C.out_qty) AS out_qty FROM		 (SELECT eq_id, proc_id  FROM MES_EQ_PROCESS   GROUP BY eq_id ) A     JOIN   MES_EQ_INFO B   ON A.eq_id = B.eq_id   JOIN   MES_OUT_DETAILS C     ON A.eq_id = C.eq_id   WHERE C.process_id = ? AND C.date_time >= CONCAT(?," 06:30:00") && C.date_time <= CONCAT(? + INTERVAL 1 DAY," 06:30:00")',
                        values: [process_from_emit, today_from_emit, today_from_emit]
                    },  function(err, results, fields){
                        if(err){reject(err);}
                            let outs_obj=[];

                                outs_obj.push({
                                    out_qty: results[0].out_qty
                                });

                            resolve(outs_obj);
                    });
                    connection.release();
                });
            });
        }

        queryScrapQty().then(function(scrap_obj){
            return queryTotalOuts().then(function(outs_obj){
                let scrapDPPM_obj=[];
                    for(let i=0;i<scrap_obj.length;i++){
                        scrapDPPM_obj.push({
                            scrap_code: scrap_obj[i].scrap_code,
                            // named it scrap_qty but in reality it's dppm
                            scrap_qty:  ((scrap_obj[i].scrap_qty/(scrap_obj[i].scrap_qty + outs_obj[0].out_qty))*1000000).toFixed(0)
                        });
                    }
                //console.log(scrapDPPM_obj);
                socket.emit('scrapDPPM_obj', TSV.stringify(scrapDPPM_obj));
            });
        });
        
    });

    // Overall Yield Loss
    socket.on('yieldloss', function(process_data){
        let process_from_emit = process_data.process_data;
        //let today_from_emit = moment(process_data.today_data).format('YYYY-MM-DD');
        // had to declare it as global for socket.on('yieldloss')
        if(Date.parse(process_data.today_data) >= Date.parse(moment(process_data.today_data).format('YYYY-MM-DD, 00:00:00')) && Date.parse(process_data.today_data) <=  Date.parse(moment(process_data.today_data).format('YYYY-MM-DD, 06:29:59'))) {
            // this way, I could manipulate the date for PM-MIDNIGHT shift
            today_from_emit = moment(process_data.today_data).subtract(1, "days").format('YYYY-MM-DD');
            // console.log(today_from_emit);
        }else{
            // this way, I could manipulate the date for AM shift
            today_from_emit = moment(process_data.today_data).format('YYYY-MM-DD');
            // console.log(today_from_emit);
        }
            function queryTotalOuts(){
                return new Promise(function(resolve, reject){
                    mysql.getConnection(function(err, connection){
                        if(err){reject(err);}
                        connection.query({
                            sql: 'SELECT SUM(out_qty) AS out_qty FROM MES_OUT_DETAILS WHERE DATE(DATE_ADD(date_time, INTERVAL -390 MINUTE)) = DATE(DATE_ADD(?, INTERVAL -0 MINUTE)) AND process_id = ?',
                            values: [today_from_emit, process_from_emit]
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
                            values: [today_from_emit, process_from_emit]
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

    // STATUS
    socket.on('status', function(process_data){
        let process_from_emit = process_data.process_data;
        //let today_from_emit = moment(process_data.today_data).format('YYYY-MM-DD');
        // had to declare it as global for socket.on('status')
        if(Date.parse(process_data.today_data) >= Date.parse(moment(process_data.today_data).format('YYYY-MM-DD, 00:00:00')) && Date.parse(process_data.today_data) <=  Date.parse(moment(process_data.today_data).format('YYYY-MM-DD, 06:29:59'))) {
            // this way, I could manipulate the date for PM-MIDNIGHT shift
            today_from_emit = moment(process_data.today_data).subtract(1, "days").format('YYYY-MM-DD');
            // console.log(today_from_emit);
        }else{
            // this way, I could manipulate the date for AM shift
            today_from_emit = moment(process_data.today_data).format('YYYY-MM-DD');
            // console.log(today_from_emit);
        }
            //  query tool status via cloud
            function queryToolStat(){
                return new Promise(function(resolve, reject){
                    mysql.getConnection(function(err, connection){
                        if(err){reject(err);}
                        connection.query({
                            sql: 'SELECT pretty_table.eq_name, COALESCE(P,0) AS P,  COALESCE(SU,0) AS SU,   COALESCE(SD,0) AS SD,  COALESCE(D,0) AS D,  COALESCE(E,0) AS E, COALESCE(SB,0) AS SB  FROM (SELECT extended_table.eq_name,   SUM(P) AS P,    SUM(SU) AS SU,   SUM(SD) AS SD,    SUM(D) AS D,    SUM(E) AS E,  SUM(SB) AS SB FROM  (SELECT base_table.*,   CASE WHEN base_table.stat_id = "P" THEN base_table.duration END AS P,   CASE WHEN base_table.stat_id = "SU" THEN base_table.duration END AS SU,   CASE WHEN base_table.stat_id = "SD" THEN base_table.duration END AS SD,   CASE WHEN base_table.stat_id = "D" THEN base_table.duration END AS D,  CASE WHEN base_table.stat_id = "E" THEN base_table.duration END AS E,   CASE WHEN base_table.stat_id = "SB" THEN base_table.duration END AS SB  FROM (SELECT G.eq_name,  G.stat_id,  SUM(ROUND(TIME_TO_SEC(TIMEDIFF(G.time_out,G.time_in))/3600,2)) as duration FROM  (SELECT  C.eq_name,    B.stat_id,    IF(B.time_in <= CONCAT(?," 06:30:00") && B.time_out >= CONCAT(?," 06:30:00"),CONCAT(?," 06:30:00"),IF(B.time_in <= CONCAT(?, " 06:30:00"),CONCAT(?," 06:30:00"),IF(B.time_in >= CONCAT(? + INTERVAL 1 DAY, " 06:30:00"),CONCAT(? + INTERVAL 1 DAY," 06:30:00"),B.time_in))) AS time_in ,    IF(B.time_in <= CONCAT(? + INTERVAL 1 DAY," 06:30:00") && B.time_out >= CONCAT(? + INTERVAL 1 DAY, " 06:30:00"),CONCAT(? + INTERVAL 1 DAY, " 06:30:00"),IF(B.time_out <= CONCAT(? , " 06:30:00"),CONCAT(?," 06:30:00"),IF(B.time_out >= CONCAT(? + INTERVAL 1 DAY, " 06:30:00"),CONCAT(? + INTERVAL 1 DAY," 06:30:00"),IF(B.time_out IS NULL && B.time_in < CONCAT(? + INTERVAL 1 DAY," 06:30:00") ,CONVERT_TZ(NOW(),@@SESSION.TIME_ZONE,"+08:00"),B.time_out)))) AS time_out   FROM  (SELECT eq_id, proc_id    FROM MES_EQ_PROCESS    WHERE proc_id = ? GROUP BY eq_id) A   JOIN      MES_EQ_CSTAT_HEAD B    ON A.eq_id = B.eq_id   JOIN     MES_EQ_INFO C   ON A.eq_id = C.eq_id    WHERE    B.time_in >= CONCAT(? - INTERVAL 1 DAY," 00:00:00")   AND A.proc_id = ?) G GROUP BY G.eq_name, G.stat_id) base_table) extended_table  GROUP BY extended_table.eq_name) pretty_table  ',
                            values: [today_from_emit, today_from_emit, today_from_emit, today_from_emit, today_from_emit, today_from_emit, today_from_emit, today_from_emit, today_from_emit, today_from_emit, today_from_emit, today_from_emit, today_from_emit, today_from_emit, today_from_emit, process_from_emit, today_from_emit, process_from_emit]
                        },  function(err, results, fields){
                                if(err){ return reject(err);}
                                    let toolStat_obj=[];
                                        for(let i=0;i<results.length;i++){
                                            toolStat_obj.push({
                                                eq_name: results[i].eq_name,
                                                PRODUCTIVE: results[i].P,
                                                STANDBY: results[i].SB,
                                                SETUP: results[i].SU,
                                                SCHEDULED_DT: results[i].SD,
                                                UNSCHEDULED_DT: results[i].D,
                                                ENGINEERING: results[i].E
                                            });
                                        }
                                    resolve(toolStat_obj);
                        });
                    connection.release();
                    });
                });
            }

            queryToolStat().then(function(toolStat_obj){

                socket.emit('toolStat_obj', TSV.stringify(toolStat_obj));

            });
            

    });

    // OEE WITH DATE FROM SOCKET
    socket.on('oee', function(process_data){
            let process_from_emit = process_data.process_data;
            //let today_from_emit = moment(process_data.today_data).format('YYYY-MM-DD');
            // had to declare it as global for socket.on('oee')
            if(Date.parse(process_data.today_data) >= Date.parse(moment(process_data.today_data).format('YYYY-MM-DD, 00:00:00')) && Date.parse(process_data.today_data) <=  Date.parse(moment(process_data.today_data).format('YYYY-MM-DD, 06:29:59'))) {
                // this way, I could manipulate the date for PM-MIDNIGHT shift
                today_from_emit = moment(process_data.today_data).subtract(1, "days").format('YYYY-MM-DD');
                // console.log(today_from_emit);
            }else{
                // this way, I could manipulate the date for AM shift
                today_from_emit = moment(process_data.today_data).format('YYYY-MM-DD');
                // console.log(today_from_emit);
            }
            //console.log(today_from_emit)
            //  query tool uph and oee target via local host
            function queryLocalSettings(){
                return new Promise(function(resolve, reject){
                    mysqlLocal.getConnection(function(err, connection){
                        if(err){reject(err);}
                        connection.query({
                            sql: 'SELECT * FROM tbl_default WHERE process_name = ? GROUP BY eq_name',
                            values: [process_from_emit]
                        },  function(err, results, fields){
                            if(err){reject(err);}
                                let localSettings_obj=[];
                                    for(let i=0;i<results.length;i++){
                                        localSettings_obj.push({
                                            process: results[i].process_name,
                                            eq_name: results[i].eq_name,
                                            uph: results[i].uph,
                                            oee_target: results[i].oee_target
                                        });
                                    }
                                resolve(localSettings_obj);
                        });
                    connection.release();
                    });
                });
            }
            //  query tool outs via cloud
            function queryToolOuts(){
                return new Promise(function(resolve, reject){
                    mysql.getConnection(function(err, connection){
                        if(err){reject(err);}
                        connection.query({
                            sql: 'SELECT B.eq_name, SUM(C.out_qty) AS out_qty FROM		 (SELECT eq_id, proc_id  FROM MES_EQ_PROCESS   GROUP BY eq_id ) A     JOIN   MES_EQ_INFO B   ON A.eq_id = B.eq_id   JOIN   MES_OUT_DETAILS C     ON A.eq_id = C.eq_id   WHERE C.process_id = ? AND C.date_time >= CONCAT(?," 06:30:00") && C.date_time <= CONCAT(? + INTERVAL 1 DAY," 06:30:00")  GROUP BY C.eq_id',
                            values: [process_from_emit, today_from_emit, today_from_emit]
                        }, function(err, results, field){
                            if(err){reject(err);}
                                let ToolOuts_obj=[];
                                    for(let i=0;i<results.length;i++){
                                        ToolOuts_obj.push({
                                            eq_name: results[i].eq_name,
                                            out_qty: results[i].out_qty
                                        });
                                    }
                                resolve(ToolOuts_obj);
                        });
                        connection.release();
                    });
                });
            }

            function queryFabHour(){
                return new Promise(function(resolve, reject){
                    mysql.getConnection(function(err, connection){
                        if(err){reject(err);}
                        connection.query({
                            sql: 'SELECT HOUR(DATE_ADD(date_time, INTERVAL -390 MINUTE)) + 1 AS fab_hour FROM MES_OUT_DETAILS WHERE process_id = ? AND DATE(DATE_ADD(date_time, INTERVAL -390 MINUTE)) = DATE(DATE_ADD(?, INTERVAL -0 MINUTE)) GROUP BY process_id, HOUR(DATE_ADD(date_time, INTERVAL -390 MINUTE)) ORDER BY fab_hour DESC LIMIT 1',
                            values: [process_from_emit, today_from_emit]
                        },  function(err, results, fields){
                            if(err){reject(err);}
                                let fabHour_obj=[];
                                    fabHour_obj.push({
                                        fab_hour: results[0].fab_hour
                                    });
                                resolve(fabHour_obj);
                        });
                    });
                });


            }


            queryLocalSettings().then(function(localSettings_obj){
                return queryToolOuts().then(function(ToolOuts_obj){
                    return queryFabHour().then(function(fabHour_obj){
                        
                        let oee_obj=[];
                        let oeeTarget_obj=[];
                            
                            for(let i=0;i<localSettings_obj.length;i++){
                                for(let j=0;j<ToolOuts_obj.length;j++){
                                    if(localSettings_obj[i].eq_name === ToolOuts_obj[j].eq_name){
                                            
                                        oee_obj.push({
                                            eq_name: localSettings_obj[i].eq_name,
                                            oee: ((ToolOuts_obj[j].out_qty/localSettings_obj[i].uph/fabHour_obj[0].fab_hour) *100).toFixed(0)
                                        });

                                        oeeTarget_obj.push({
                                            eq_name: localSettings_obj[i].eq_name,
                                            oee: localSettings_obj[i].oee_target
                                        });
        
                                    } else {

                                        oee_obj.push({
                                            eq_name: localSettings_obj[i].eq_name,
                                            oee: 0
                                        });

                                        oeeTarget_obj.push({
                                            eq_name: localSettings_obj[i].eq_name,
                                            oee: localSettings_obj[i].oee_target
                                        });

                                    }
                                }
                            }

                        socket.emit('oee_obj', TSV.stringify(oee_obj), TSV.stringify(oeeTarget_obj));

                    });
                });
            });
            
    });
});



server.listen(port);

