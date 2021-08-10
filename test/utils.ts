export const buildPathFromId = (id: string): string => {
  return id.replace(/-/g, '_');
};

export const getIdsFromPath = (path: string): string[] => path.replace(/_/g, '-').split('.');
