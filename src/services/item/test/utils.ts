export const getItemWithDepth = (remainingLevel: number) => {
  if (remainingLevel === 0) {
    return {};
  }

  return { children: [getItemWithDepth(remainingLevel - 1)] };
};
