import {
  BuildSchemaOptions,
  DATE_TYPE,
  NULLABLE_TYPE,
  OBJECT_TYPE,
  STRING_TYPE,
  buildObjectSchema,
} from '../utils/schema.utils.js';

const simpleSchema = (options?: BuildSchemaOptions) =>
  buildObjectSchema(
    {
      id: STRING_TYPE,
      name: STRING_TYPE,
      createdAt: DATE_TYPE,
    },
    options,
  );

const schemaWithReference = (options?: BuildSchemaOptions) =>
  buildObjectSchema(
    {
      id: STRING_TYPE,
      name: NULLABLE_TYPE(STRING_TYPE),
      external: simpleSchema(options),
      extra: OBJECT_TYPE,
    },
    options,
  );

describe('Test utils', () => {
  describe('Schema utils', () => {
    it('Generates schema with all props required', () => {
      const expectedSchema = {
        required: ['id', 'name', 'createdAt'],
        additionalProperties: false,
        nullable: false,
        type: 'object',
        properties: {
          id: {
            type: 'string',
          },
          name: {
            type: 'string',
          },
          createdAt: {
            oneOf: [
              {
                type: 'string',
              },
              {
                type: 'object',
              },
            ],
          },
        },
      };

      expect(simpleSchema()).toEqual(expectedSchema);
    });
    it('Generates schema without required props', () => {
      const expectedSchema = {
        required: [],
        additionalProperties: false,
        nullable: false,
        type: 'object',
        properties: {
          id: {
            type: 'string',
          },
          name: {
            type: 'string',
          },
          createdAt: {
            oneOf: [
              {
                type: 'string',
              },
              {
                type: 'object',
              },
            ],
          },
        },
      };

      expect(simpleSchema({ requiredProps: [] })).toEqual(expectedSchema);
    });

    it('Generates schema with id prop required', () => {
      const expectedSchema = {
        required: ['id'],
        additionalProperties: false,
        nullable: false,
        type: 'object',
        properties: {
          id: {
            type: 'string',
          },
          name: {
            type: 'string',
          },
          createdAt: {
            oneOf: [
              {
                type: 'string',
              },
              {
                type: 'object',
              },
            ],
          },
        },
      };

      expect(simpleSchema({ requiredProps: ['id'] })).toEqual(expectedSchema);
    });

    it('Generates schema with nullable props', () => {
      const expectedSchema = {
        required: [],
        additionalProperties: false,
        nullable: true,
        type: 'object',
        properties: {
          id: {
            type: 'string',
          },
          name: {
            type: 'string',
          },
          createdAt: {
            oneOf: [
              {
                type: 'string',
              },
              {
                type: 'object',
              },
            ],
          },
        },
      };

      expect(simpleSchema({ requiredProps: [], nullable: true })).toEqual(expectedSchema);
    });

    it('Generates schema with reference correctly', () => {
      const expectedSchema = {
        required: ['id', 'name', 'external', 'extra'],
        additionalProperties: false,
        nullable: false,
        type: 'object',
        properties: {
          id: {
            type: 'string',
          },
          name: {
            oneOf: [
              {
                type: 'string',
              },
              {
                type: 'null',
              },
            ],
          },
          external: {
            required: ['id', 'name', 'createdAt'],
            additionalProperties: false,
            nullable: false,
            type: 'object',
            properties: {
              id: {
                type: 'string',
              },
              name: {
                type: 'string',
              },
              createdAt: {
                oneOf: [
                  {
                    type: 'string',
                  },
                  {
                    type: 'object',
                  },
                ],
              },
            },
          },
          extra: {
            type: 'object',
          },
        },
      };

      expect(schemaWithReference()).toEqual(expectedSchema);
    });
  });
});
