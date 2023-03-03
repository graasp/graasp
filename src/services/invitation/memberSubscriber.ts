// The subscriber throws strange errors: EntityMetadataNotFoundError: No metadata for "Invitation" was found.

// import { EntitySubscriberInterface, EventSubscriber, InsertEvent } from 'typeorm';

// import { Member } from '../member/entities/member';
// import { InvitationRepository } from './repository';

// // remove all invitations related to a newly registered member
// @EventSubscriber()
// export class MemberSubscriber implements EntitySubscriberInterface {
//   listenTo() {
//     return Member;
//   }

//   async afterInsert(event: InsertEvent<any>) {
//     console.log('AFTER ENTITY INSERTED: ', event.entity);

//     const email = event.entity.email;
//     await event.manager.withRepository(InvitationRepository).deleteForEmail(email);
//   }
// }
