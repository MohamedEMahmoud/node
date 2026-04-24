const mysql  = require('mysql');

class DB {
    constructor() {
        this.connection     = mysql.createPool({
            connectionLimit : 100,
            host            : process.env.DB_HOST,
            user            : process.env.DB_USERNAME,
            password        : process.env.DB_PASSWORD,
            database        : process.env.DB_DATABASE,
            debug           : false,
            charset         : 'utf8mb4'
        });
    }

    query(sql, args) {
        return new Promise((resolve, reject) => {
            this.connection.query(sql, args, (err, rows) => {
                if (err)
                    return reject(err);
                resolve(rows);
            });
        });
    }

    close() {
        return new Promise((resolve, reject) => {
            this.connection.end(err => {
                if (err)
                    return reject(err);
                resolve();
            });
        });
    }
}

module.exports = new DB();