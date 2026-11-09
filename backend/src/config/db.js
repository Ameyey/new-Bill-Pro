const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const isPostgres = process.env.DB_TYPE === 'postgres' ||
                   process.env.DB_TYPE === 'supabase' ||
                   (process.env.DB_HOST && process.env.DB_HOST.includes('supabase')) ||
                   String(process.env.DB_PORT) === '5432' ||
                   String(process.env.DB_PORT) === '6543';

let pool = null;

function sanitizeParams(params) {
  if (!Array.isArray(params)) return [];
  return params.map(val => (val === undefined ? null : val));
}

function convertSqlForPg(sql) {
  let paramIndex = 1;
  let converted = sql.replace(/\?/g, () => `$${paramIndex++}`);

  // Automatically convert common MySQL functions to Postgres equivalents
  converted = converted.replace(/DATE_FORMAT\s*\(\s*([^,]+)\s*,\s*['"]%Y-%m-%d['"]\s*\)/gi, "TO_CHAR($1, 'YYYY-MM-DD')");
  converted = converted.replace(/DATE_FORMAT\s*\(\s*([^,]+)\s*,\s*['"]%Y-%m['"]\s*\)/gi, "TO_CHAR($1, 'YYYY-MM')");
  converted = converted.replace(/\bIFNULL\s*\(/gi, 'COALESCE(');

  return converted;
}

function init() {
  if (pool) return pool;

  if (isPostgres) {
    const { Pool } = require('pg');
    pool = new Pool({
      host: process.env.DB_HOST || 'db.dxuugoceugoscgbtunod.supabase.co',
      port: parseInt(process.env.DB_PORT, 10) || 5432,
      database: process.env.DB_NAME || 'postgres',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
      idleTimeoutMillis: 30000,
      max: 15
    });
    return pool;
  } else {
    const mysql = require('mysql2/promise');
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'billpro',
      waitForConnections: true,
      connectionLimit: 15,
      queueLimit: 0,
      multipleStatements: true,
      dateStrings: true,
      decimalNumbers: true
    });
    return pool;
  }
}

// Auto-initialize connection pool
init();

async function testConnection() {
  try {
    if (!pool) init();
    if (isPostgres) {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      console.log(`[Supabase PostgreSQL] Successfully connected to database: ${process.env.DB_NAME || 'postgres'} at ${process.env.DB_HOST}`);
      return true;
    } else {
      const conn = await pool.getConnection();
      await conn.ping();
      conn.release();
      console.log(`[MySQL] Successfully connected to database: ${process.env.DB_NAME || 'billpro'} at ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}`);
      return true;
    }
  } catch (err) {
    console.error(`[Database Connection Error]:`, err.message);
    throw err;
  }
}

async function query(sql, params = []) {
  if (!pool) init();
  const cleanParams = sanitizeParams(params);
  if (isPostgres) {
    const pgSql = convertSqlForPg(sql);
    const res = await pool.query(pgSql, cleanParams);
    return res.rows;
  } else {
    const [rows] = await pool.execute(sql, cleanParams);
    return rows;
  }
}

async function get(sql, params = []) {
  if (!pool) init();
  const cleanParams = sanitizeParams(params);
  if (isPostgres) {
    const pgSql = convertSqlForPg(sql);
    const res = await pool.query(pgSql, cleanParams);
    return res.rows && res.rows.length > 0 ? res.rows[0] : null;
  } else {
    const [rows] = await pool.execute(sql, cleanParams);
    return rows && rows.length > 0 ? rows[0] : null;
  }
}

async function run(sql, params = []) {
  if (!pool) init();
  const cleanParams = sanitizeParams(params);
  if (isPostgres) {
    let pgSql = convertSqlForPg(sql);
    const isInsert = /^\s*INSERT\s+INTO/i.test(sql);
    if (isInsert && !/RETURNING/i.test(pgSql)) {
      pgSql += ' RETURNING id';
    }
    const res = await pool.query(pgSql, cleanParams);
    const insertId = res.rows && res.rows[0] && res.rows[0].id ? res.rows[0].id : null;
    return {
      lastInsertRowid: insertId,
      changes: res.rowCount,
      affectedRows: res.rowCount
    };
  } else {
    const [result] = await pool.execute(sql, cleanParams);
    return {
      lastInsertRowid: result.insertId,
      changes: result.affectedRows,
      affectedRows: result.affectedRows
    };
  }
}

async function exec(sql) {
  if (!pool) init();
  if (isPostgres) {
    const res = await pool.query(sql);
    return res;
  } else {
    const [result] = await pool.query(sql);
    return result;
  }
}

module.exports = {
  init,
  testConnection,
  query,
  get,
  run,
  exec,
  getPool: () => pool,
  isPostgres: () => isPostgres,
  isMySQL: () => !isPostgres
};
