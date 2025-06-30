export const Queues = {
  ItemExport: { queueName: 'item-export', jobs: { exportFolderZip: 'export-folder-zip' } },
  SearchIndex: { queueName: 'search-index', jobs: { buildIndex: 'build-index' } },
} as const;
