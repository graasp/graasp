import { Member } from '../member/entities/member';

export type ItemSearchParams = { creatorId?: Member['id']; name?: string };
