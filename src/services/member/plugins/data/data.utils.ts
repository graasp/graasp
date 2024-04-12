import { ChatMessage } from '../../../chat/chatMessage';

const ANONYMIZED_ID = 'anonymous-id';

export const anonymizeResults = <T, K extends keyof T, V extends T[K]>({
  results,
  exportingActorId,
  memberIdKey,
}: {
  results: T[];
  exportingActorId: string;
  memberIdKey: K[];
}) => {
  return results.map((r) => {
    memberIdKey.forEach((k) => {
      if (r[k] !== exportingActorId) {
        r[k] = ANONYMIZED_ID as V;
      }
    });

    return r;
  });
};

const replaceNoneActorId = (message: string, exportingActorId: string) => {
  // convert the actor uuid in none uuid format to prevent anonymizing it
  const actorId = exportingActorId.replace('-', '');
  const uuidRegex = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
  const messageWithoutActorUUID = message.replace(exportingActorId, actorId);
  const regex = new RegExp(`${uuidRegex}`, 'gi');
  return messageWithoutActorUUID.replace(regex, ANONYMIZED_ID).replace(actorId, exportingActorId);
};

export const anonymizeMessage = ({
  results,
  exportingActorId,
}: {
  results: ChatMessage[];
  exportingActorId: string;
}) => {
  return results.map((r) => ({
    ...r,
    body: replaceNoneActorId(r.body, exportingActorId),
  }));
};
