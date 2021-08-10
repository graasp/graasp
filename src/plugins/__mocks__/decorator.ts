import { FastifyPluginAsync } from 'fastify';
import { GlobalTaskRunner } from '../../services/global-task-runner';
import { ItemMembershipService } from '../../services/item-memberships/db-service';
import { ItemService } from '../../services/items/db-service';
import { MemberService } from '../../services/members/db-service';
import { ACTOR } from '../../../test/fixtures/members';

const mockedDecoratorPlugin: FastifyPluginAsync = async (fastify) => {
    const { db, log } = fastify;
    fastify.decorate('taskRunner', new GlobalTaskRunner(db, log));

    fastify.decorate('members', {
        dbService: new MemberService(),
        taskManager: null,
    });
    fastify.decorate('items', {
        dbService: new ItemService(),
        taskManager: null,
    });
    fastify.decorate('itemMemberships', {
        dbService: new ItemMembershipService(),
        taskManager: null,
    });

    // necessary to set a valid member when the auth plugin is mocked
    fastify.decorateRequest('member', ACTOR);

};
export default  mockedDecoratorPlugin;
