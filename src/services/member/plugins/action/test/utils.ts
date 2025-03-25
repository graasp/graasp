export const getDateBeforeOrAfterNow = (dateDiff: number) => {
  const date = new Date(); // Today's date
  date.setDate(date.getDate() + dateDiff);
  return date.toISOString();
};

// export const generateActionsWithItems = async (
//   member: MinimalMember,
//   { saveActionForNotOwnedItem = false } = {},
// ) => {
//   const item = await testUtils.saveItem({ actor: member });
//   const actions = [
//     ActionFactory({
//       account: member,
//       item: item as unknown as DiscriminatedItem,
//       createdAt: new Date().toISOString(),
//     }),
//     ActionFactory({
//       account: member,
//       type: ActionTriggers.CollectionView,
//       createdAt: new Date().toISOString(),
//     }),
//     ActionFactory({ account: member }),
//     ActionFactory({
//       account: member,
//       createdAt: new Date().toISOString(),
//       type: ActionTriggers.ItemLike,
//     }),
//   ];

//   if (saveActionForNotOwnedItem) {
//     const m = await saveMember();
//     const notOwnItem = await testUtils.saveItem({ actor: m });
//     actions.push(
//       ActionFactory({
//         account: member,
//         createdAt: new Date().toISOString(),
//         item: notOwnItem as unknown as DiscriminatedItem,
//       }),
//     );
//   }
//   return actions;
// };
