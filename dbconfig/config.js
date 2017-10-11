var mysql = require('mysql');

let pool = mysql.createPool({
    multipleStatements: true,
    connectionLimit:    1000, // limit 
    host    :           'ddolfsb30gea9k.c36ugxkfyi6r.us-west-2.rds.amazonaws.com',
    user    :           'fab4_engineers',
    password:           'Password123',
    database:           'fab4'
}); 

exports.pool = pool;