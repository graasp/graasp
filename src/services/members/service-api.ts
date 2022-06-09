// global
import { FastifyPluginAsync } from 'fastify';
import fastifyCors from 'fastify-cors';
import thumbnailsPlugin, {
  buildFilePathWithPrefix,
  THUMBNAIL_MIMETYPE,
} from 'graasp-plugin-thumbnails';
import { IdParam, IdsParams } from '../../interfaces/requests';
// local
import {
  FILE_ITEM_PLUGIN_OPTIONS,
  SERVICE_METHOD,
  S3_FILE_ITEM_PLUGIN_OPTIONS,
  AVATARS_PATH_PREFIX,
} from '../../util/config';
import { CannotModifyOtherMembers } from '../../util/graasp-error';
import { Member } from './interfaces/member';
import { MemberTaskManager } from './interfaces/member-task-manager';
import { EmailParam } from './interfaces/requests';
import common, { getOne, getMany, getBy, updateOne, deleteOne } from './schemas';
import { TaskManager } from './task-manager';

const ROUTES_PREFIX = '/members';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { members, taskRunner: runner } = fastify;

  const { dbService } = members;
  const taskManager: MemberTaskManager = new TaskManager(dbService);
  members.taskManager = taskManager;

  // schemas
  fastify.addSchema(common);

  // routes
  fastify.register(
    async function (fastify) {
      // add CORS support
      if (fastify.corsPluginOptions) {
        fastify.register(fastifyCors, fastify.corsPluginOptions);
      }

      // auth plugin session validation
      fastify.addHook('preHandler', fastify.verifyAuthentication);

      fastify.decorate('s3FileItemPluginOptions', S3_FILE_ITEM_PLUGIN_OPTIONS);
      fastify.decorate('fileItemPluginOptions', FILE_ITEM_PLUGIN_OPTIONS);

      fastify.register(thumbnailsPlugin, {
        serviceMethod: SERVICE_METHOD,
        serviceOptions: {
          s3: S3_FILE_ITEM_PLUGIN_OPTIONS,
          local: FILE_ITEM_PLUGIN_OPTIONS,
        },
        pathPrefix: AVATARS_PATH_PREFIX,

        uploadPreHookTasks: async ({ parentId: id }, { member }) => {
          if (member.id !== id) {
            throw new CannotModifyOtherMembers(member.id);
          }
          return [taskManager.createGetTask(member, id)];
        },
        downloadPreHookTasks: async ({ itemId: id, filename }, { member }) => {
          const task = taskManager.createGetTask(member, id);
          task.getResult = () => ({
            filepath: buildFilePathWithPrefix({
              itemId: (task.result as Member).id,
              pathPrefix: AVATARS_PATH_PREFIX,
              filename,
            }),
            mimetype: THUMBNAIL_MIMETYPE,
          });

          return [task];
        },

        prefix: '/avatars',
      });

      // get current
      fastify.get('/current', async ({ member }) => member);

      // get member
      fastify.get<{ Params: IdParam }>(
        '/:id',
        { schema: getOne },
        async ({ member, params: { id }, log }) => {
          const task = taskManager.createGetTask(member, id);
          return runner.runSingle(task, log);
        },
      );

      // get members
      fastify.get<{ Querystring: IdsParams }>(
        '/',
        { schema: getMany },
        async ({ member, query: { id: ids }, log }) => {
          const tasks = ids.map((id) => taskManager.createGetTask(member, id));
          return runner.runMultiple(tasks, log);
        },
      );

      // get members by
      fastify.get<{ Querystring: EmailParam }>(
        '/search',
        { schema: getBy },
        async ({ member, query: { email }, log }) => {
          const task = taskManager.createGetByTask(member, { email });
          return runner.runSingle(task, log);
        },
      );

      // update member
      fastify.patch<{ Params: IdParam }>(
        '/:id',
        { schema: updateOne },
        async ({ member, params: { id }, body, log }) => {
          const tasks = taskManager.createUpdateTaskSequence(member, id, body);
          return runner.runSingleSequence(tasks, log);
        },
      );

      // delete member
      fastify.delete<{ Params: IdParam }>(
        '/:id',
        { schema: deleteOne },
        async ({ member, params: { id }, log }) => {
          const tasks = taskManager.createDeleteTaskSequence(member, id);
          return runner.runSingleSequence(tasks, log);
        },
      );
    },
    { prefix: ROUTES_PREFIX },
  );
};

export default plugin;
