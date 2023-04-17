import { DB_TEST_SCHEMA } from '../constants';

export const getNumberOfTables = async (app) => {
  const result = await app.db.query(`select count(*)
      from information_schema.tables
      where table_schema = '${DB_TEST_SCHEMA}'`);
  return +result[0].count;
};

export const getTableNames = async (db) => {
  const result = await db.query(`select table_name
      from information_schema.tables
      where table_schema = '${DB_TEST_SCHEMA}'`);
  return result.map(({ table_name }) => table_name);
};

export const checkDatabaseIsEmpty = async (app) => {
  const result = await getNumberOfTables(app);
  expect(result).toEqual(0);
};

export const parseValue = (v) => {
  if (Array.isArray(v)) {
    return "'{" + v.map((str) => `"${str}"`).join(',') + "}'";
  } else if (typeof v === 'object') {
    return "'" + JSON.stringify(v) + "'";
  }
  return `'${v}'`;
};

export const buildInsertIntoQuery = (tableName, values) => {
  return `INSERT INTO ${tableName} (${Object.keys(values).join(',')}) values (${Object.values(
    values,
  )
    .map(parseValue)
    .join(',')}) RETURNING *`;
};

export const buildSelectQuery = (tableName, values) => {
  const conditions = Object.entries(values)
    .map(([key, value]) => {
      return `${key} = ${parseValue(value)}`;
    })
    .join(' AND ');

  return `SELECT * FROM ${tableName}  WHERE (${conditions})`;
};
