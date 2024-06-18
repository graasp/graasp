import { StatusCodes } from 'http-status-codes';

import { ErrorFactory } from '@graasp/sdk';

import { PLUGIN_NAME } from '../constants/constants.js';

export const GraaspActionError = ErrorFactory(PLUGIN_NAME);
export class CannotWriteFileError extends GraaspActionError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPAERR001',
        statusCode: StatusCodes.NOT_FOUND,
        message: 'A file was not created properly for the requested archive',
      },
      data,
    );
  }
}

export class InvalidAggregationError extends GraaspActionError {
  constructor(message?: string) {
    super({
      code: 'GPAERR002',
      statusCode: StatusCodes.BAD_REQUEST,
      message: 'The query parameters for the aggregation are invalid: ' + message,
    });
  }
}

export class AggregateByCannotUserError extends GraaspActionError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPAERR003',
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'aggregate by cannot be "user"',
      },
      data,
    );
  }
}

export class AggregateByCannotIncludeAggregateMetricError extends GraaspActionError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPAERR004',
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'aggregateBy cannot include aggregateMetric',
      },
      data,
    );
  }
}

// todo: not sure of the name, I'm not sure what it really does
export class CountGroupByShouldIncludeAggregateMetricError extends GraaspActionError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPAERR005',
        statusCode: StatusCodes.BAD_REQUEST,
        message:
          "countGroupBy should include aggregateMetric, except for aggregateMetric !== 'actionCount'",
      },
      data,
    );
  }
}

export class CountGroupByShouldIncludeAggregateByError extends GraaspActionError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPAERR006',
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'countGroupBy should include aggregateBy, unless it is actionCount',
      },
      data,
    );
  }
}

export class InvalidAggregateFunctionError extends GraaspActionError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPAERR007',
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'aggregateFunction cannot be applied on aggregateMetric=actionCount',
      },
      data,
    );
  }
}
