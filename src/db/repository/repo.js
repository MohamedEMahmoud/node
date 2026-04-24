const DB = require('../db');

class Repo {

    constructor(table) {
        this.table = table;
    }

    async findOne(data) {

        const select = data.select || '*';

        let where    = '';

        let values   = [];

        if (data.where && typeof data.where === 'object') {
            const conditions = Object.keys(data.where).map(key => {
                const value  = data.where[key];

                if (typeof value === 'string' && value.includes('LIKE')) {
                    values.push(value.replace(/%/g, ''));
                    return `${key} LIKE ?`;
                } 

                values.push(value);

                return `${key} = ?`;
            }).join(' AND ');

            where = `WHERE ${conditions}`;
        }

        const query = `SELECT ${select} FROM ${this.table} ${where}`;

        data        = await DB.query(query, values);

        return data[0];
    }

    async find(data) {

        const select = data.select || '*';

        let where    = '';

        let values   = [];

        if (data.where && typeof data.where === 'object') {
            const conditions = Object.keys(data.where).map(key => {
                const value = data.where[key];

                if (typeof value === 'string' && value.includes('LIKE')) {
                    values.push(value.replace(/%/g, ''));
                    return `${key} LIKE ?`;
                } 

                values.push(value);
                return `${key} = ?`;
            }).join(' AND ');

            where = `WHERE ${conditions}`;
        }

        const query = `SELECT ${select} FROM ${this.table} ${where}`;

        return await DB.query(query, values);
    }

    async insertRaw(data) {
        if (Array.isArray(data)) {
            const keys = Object.keys(data[0]);

            const values = data.map(row => keys.map(key => row[key]));

            const query = `INSERT INTO ${this.table} (${keys.join(',')}) VALUES ${values.map(_ => `(${_.map(() => '?').join(',')})`).join(', ')}`;

            return await DB.query(query, values.flat());
        }

        const query = `INSERT INTO ${this.table} (${Object.keys(data).join(',')}) VALUES (${Object.values(data).map(_ => '?').join(',')})`;

        return await DB.query(query, Object.values(data));
    }

    async insert(data) {

        const sanitizeRow = row =>
            Object.fromEntries(
                Object.entries(row).map(([key, value]) => {
                    if (value instanceof Date) {
                        return [key, value];
                    }

                    if (typeof value === 'object' && value !== null) {
                        return [key, JSON.stringify(value)];
                    }

                    return [key, value];
                })
            );


        if (Array.isArray(data)) {
            const keys = Object.keys(data[0]);
            const sanitized = data.map(sanitizeRow);
            const values = sanitized.map(row => keys.map(key => row[key]));
            const placeholders = values.map(row => `(${row.map(() => '?').join(',')})`).join(', ');

            const query = `INSERT INTO ${this.table} (${keys.join(',')}) VALUES ${placeholders}`;
            return await DB.query(query, values.flat());
        }

        const sanitized    = sanitizeRow(data);
        const keys         = Object.keys(sanitized);
        const values       = Object.values(sanitized);
        const placeholders = keys.map(() => '?').join(',');

        const query        = `INSERT INTO ${this.table} (${keys.join(',')}) VALUES (${placeholders})`;
        return await DB.query(query, values);
    }

    async update(data) {

        const setClause   = Object.keys(data.set)
            .map((key) => `${key} = ?`)
            .join(', ');

        const whereClause = Object.keys(data.where)
            .map((key) => `${key} = ?`)
            .join(' AND ');

        const query  = `UPDATE ${this.table} SET ${setClause} WHERE ${whereClause}`;

        const values = [...Object.values(data.set), ...Object.values(data.where)];

        return await DB.query(query, values);
    }
};

module.exports = Repo;