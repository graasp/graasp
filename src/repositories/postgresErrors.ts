export enum PostgresError {
  IntegrityConstraintViolation = '23000',
  NotNullViolation = '23502',
  ForeignKeyViolation = '23503',
  UniqueViolation = '23505',
  CheckViolation = '23514',
}
