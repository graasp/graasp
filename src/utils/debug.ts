import { ObjectLiteral, QueryBuilder } from 'typeorm';

import { NODE_ENV } from './config';

// Print a query with parameters already filled in, ready to be sent to the database
// Only for debugging purposes. DO NOT USE in production. (injection risk)
export const printFilledSQL = <T extends ObjectLiteral>(query: QueryBuilder<T>) => {
  if (NODE_ENV === 'production') {
    throw new Error('Do not use debug functions in productionsÒ');
  }

  // eslint-disable-next-line prefer-const
  let [sql, params] = query.getQueryAndParameters();

  params.forEach((value, index) => {
    if (typeof value === 'string') {
      sql = sql.replace(`$${index + 1}`, `'${value}'`);
    }
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        sql = sql.replace(
          `$${index + 1}`,
          value
            .map((element) => (typeof element === 'string' ? `'${element}'` : element))
            .join(','),
        );
      } else {
        sql = sql.replace(`$${index + 1}`, value);
      }
    }
    if (['number', 'boolean'].includes(typeof value)) {
      sql = sql.replace(`$${index + 1}`, value.toString());
    }
  });

  console.log(`SQLPRINT: ${sql}`);
};
