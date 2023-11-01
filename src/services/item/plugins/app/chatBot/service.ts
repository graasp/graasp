import { ChatBotMessage, PermissionLevel } from '@graasp/sdk';

import { InvalidJWTItem, ItemNotFound, MemberCannotAccess } from '../../../../../utils/errors';
import { Repositories } from '../../../../../utils/repositories';
import { validatePermission } from '../../../../authorization';
import { GPTVersion } from './interfaces/gptVersion';
import { fetchOpenAI } from './utils';

export class ChatBotService {
  async post(
    actorId: string | undefined,
    repositories: Repositories,
    itemId: string,
    body: Array<ChatBotMessage>,
    gptVersion?: GPTVersion,
  ) {
    const { memberRepository, itemRepository } = repositories;

    if (!actorId) throw new MemberCannotAccess();

    const member = await memberRepository.get(actorId);
    const item = await itemRepository.get(itemId);

    // check that the member can read the item to be allowed to interact with the chat
    await validatePermission(repositories, PermissionLevel.Read, member, item);

    return await fetchOpenAI(body, gptVersion);
  }

  /**
   * Check that the app item in the JWT token corresponds to the given item id.
   * @param jwtItemId The id of the item in the Token.
   * @param itemId The id of the item the app try to access.
   * @param repositories The repositories.
   * @throws `ItemNotFound` if JWT id not found or `InvalidJWTItem` if the item ids are not the same.
   */
  async checkJWTItem(jwtItemId: string | undefined, itemId: string, repositories: Repositories) {
    if (jwtItemId !== itemId) {
      const item = await repositories.itemRepository.get(itemId);
      if (!item) {
        throw new ItemNotFound();
      }
      throw new InvalidJWTItem(jwtItemId ?? '<EMPTY>', itemId);
    }
  }
}
