import { BuildQueryResult, DBQueryConfig, ExtractTablesWithRelations } from 'drizzle-orm';

import * as relations from './relations';
import * as schema from './schema';

type Schema = typeof schema & typeof relations;
type TSchema = ExtractTablesWithRelations<Schema>;
export type IncludeRelation<TableName extends keyof TSchema> = DBQueryConfig<
  'one' | 'many',
  boolean,
  TSchema,
  TSchema[TableName]
>['with'];

export type InferResultType<
  TableName extends keyof TSchema,
  With extends IncludeRelation<TableName> | undefined = undefined,
> = BuildQueryResult<
  TSchema,
  TSchema[TableName],
  {
    with: With;
  }
>;
