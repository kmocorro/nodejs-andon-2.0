var express = require('express');
var app = express();
var io = require('socket.io')(server);
var server = require('http').Server(app);

var mysql = require('./dbconfig/config').pool;
var bodyParser = require('body-parser');
var moment = require('moment');
var TSV = require('tsv');

module.exports = function(app){

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
    today = yyyy + '-' + mm + '-' + dd;

    //  index
    app.get('/', function(req, res){
        
    });

    //  per process
    app.get('/:process_url', function(req, res){
        let process = req.params.process_url;
        res.render('process');
    });

    io.on('connection', function(socket){
        
        console.log(socket.handshake.query.process);

        socket.on('moves', function(data){
            
            mysql.getConnection(function(err, connection){
                if(err){
                    connection.release();
                    return;
                }
                connection.query({
                   sql:'SELECT process_id, SUM(out_qty) AS out_qty, HOUR(DATE_ADD(date_time, INTERVAL -390 MINUTE)) + 1 AS fab_hour , count(*) AS num_moves FROM MES_OUT_DETAILS WHERE process_id = ? AND DATE(DATE_ADD(date_time, INTERVAL -390 MINUTE)) = DATE(DATE_ADD(?, INTERVAL -0 MINUTE)) GROUP BY process_id, HOUR(DATE_ADD(date_time, INTERVAL -390 MINUTE))',
                   values: [process, today] 
                },  function(err, results, fields){
                        let obj=[];
                            for(let i=0;i.results.length;i++){
                                obj.push({
                                    process_name: results[i].process_id,
                                    hour: results[i].fab_hour,
                                    moves: results[i].num_moves
                                });
                            }
                        let process_obj = TSV.stringify(obj);
                    socket.emit('process_obj', process_obj);
                    
                });
            });
        });
    });

}