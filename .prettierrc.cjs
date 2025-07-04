module.exports = {
  trailingComma: 'all',
  tabWidth: 2,
  semi: true,
  singleQuote: true,
  importOrder: ['^@?fastify', '^@?graasp', '^[./]'],
  importOrderSeparation: true,
  importOrderParserPlugins: ['typescript', 'decorators-legacy'],
  importOrderSortSpecifiers: true,
  plugins: ['@trivago/prettier-plugin-sort-imports'],
};
