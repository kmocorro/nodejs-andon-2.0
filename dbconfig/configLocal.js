var mysql = require('mysql');

let poolLocal = mysql.createPool({
    multipleStatements: true,
    connectionLimit:    1000, // limit 
    host    :           'localhost',
    user    :           'root',
    password:           '2qhls34r',
    database:           'db_oee'
}); 

exports.poolLocal = poolLocal;