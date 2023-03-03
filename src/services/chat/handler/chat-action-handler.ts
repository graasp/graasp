// import { Hostname, HttpMethod, ItemService, Member } from '@graasp/sdk';
// import { ActionHandlerInput, BaseAction, getBaseAction } from 'graasp-plugin-actions';

// import { ACTION_TYPES, paths } from '../../constants/constants';

// declare module 'fastify' {
//   export interface FastifyRequest {
//     member: Member;
//   }
// }

// export const createChatActionHandler = async (
//   itemService: ItemService,
//   payload: string,
//   actionInput: ActionHandlerInput,
//   hosts: Hostname[],
// ): Promise<BaseAction[]> | null => {
//   const { request, log, dbHandler } = actionInput;
//   // function called each time there is a request in the chatbox in graasp-plugin-chatbox (onSend hook in
//   // graasp-plugin-chatbox) identify and check the correct endpoint of the request
//   const { method, url, params } = request;

//   const baseAction = getBaseAction(request, hosts);

//   // warning: this is really dependent on the url -> how to be more safe and dynamic?
//   const itemId: string = (params as { itemId: string })?.itemId;

//   if (!itemId) return null;

//   const item = await itemService.get(itemId, dbHandler);

//   const chatData = JSON.parse(payload);

//   const actionsToSave = [];
//   const actionBase = {
//     ...baseAction,
//     extra: {
//       message: chatData,
//     },
//     itemPath: item.path,
//     itemType: item.type,
//   };

//   // identify the endpoint with method and url
//   switch (method) {
//     case HttpMethod.POST:
//       switch (true) {
//         case paths.postMessage.test(url):
//           actionsToSave.push({
//             ...actionBase,
//             actionType: ACTION_TYPES.CREATE,
//           });
//           break;
//       }
//       break;
//     case HttpMethod.PATCH:
//       switch (true) {
//         case paths.patchMessage.test(url):
//           actionsToSave.push({
//             ...actionBase,
//             actionType: ACTION_TYPES.UPDATE,
//           });
//           break;
//       }
//       break;
//     case HttpMethod.DELETE:
//       switch (true) {
//         case paths.deleteMessage.test(url):
//           actionsToSave.push({
//             ...actionBase,
//             actionType: ACTION_TYPES.DELETE,
//           });
//           break;
//         case paths.clearChat.test(url):
//           actionsToSave.push({
//             ...actionBase,
//             actionType: ACTION_TYPES.CLEAR,
//             extra: { chatId: chatData?.id },
//           });
//           break;
//       }
//       break;
//     default:
//       log.debug('chat-action: request does not match any allowed routes.');
//       break;
//   }
//   return actionsToSave;
// };
