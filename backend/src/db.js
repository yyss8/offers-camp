import knexLib from 'knex';

const {
  DB_HOST = '127.0.0.1',
  DB_PORT = '3306',
  DB_USER = 'root',
  DB_PASSWORD = '',
  DB_NAME = 'offers_campus',
} = process.env;

let db;

export function getDb() {
  if (db) return db;
  db = knexLib({
    client: 'mysql2',
    connection: {
      host: DB_HOST,
      port: Number(DB_PORT),
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
    },
    pool: { min: 0, max: 5 },
  });
  return db;
}
