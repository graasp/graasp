import { FastifyPluginAsync } from 'fastify';

import { buildRepositories } from '../../../../utils/repositories';
import { AppActionService } from '../../../item/plugins/app/appAction/service';
import { AppDataService } from '../../../item/plugins/app/appData/service';
import { AppSettingService } from '../../../item/plugins/app/appSetting/service';
import { FavoriteService } from '../../../item/plugins/itemFavorite/services/favorite';
import { ItemLikeService } from '../../../item/plugins/itemLike/service';
import ItemMembershipService from '../../../itemMembership/service';
import { DataMemberService } from './service';

const plugin: FastifyPluginAsync = async (fastify) => {
  const {
    items: { service: itemService },
    actions: { service: actionService },
    itemsCategory: { service: itemsCategoryService },
    mailer,
  } = fastify;

  // TODO: check how to get those services to avoid service duplication ?
  const itemMembershipService = new ItemMembershipService(itemService, mailer);
  const favoriteService = new FavoriteService(itemService);
  const itemLikeService = new ItemLikeService(itemService);
  const appDataService = new AppDataService();
  const appActionService = new AppActionService();
  const appSettingService = new AppSettingService(itemService);

  const dataMemberService = new DataMemberService({
    actionService,
    appActionService,
    appDataService,
    appSettingService,
    favoriteService,
    itemLikeService,
    itemMembershipService,
    itemService,
  });

  // download all related data to the given user
  fastify.get<{ Params: { memberId: string } }>(
    '/:memberId',
    {
      // schema: getProfileForMember,
      preHandler: fastify.verifyAuthentication,
    },
    async ({ member }) => {
      const repositories = buildRepositories();

      // TODO: each service of memberData should have one function that returns the data table for the given member !
      // TODO: write one unit test per memberData service to check that all needed data are presents and NO LEAKS !
      // TODO: remove those comments guideline when the feature is done.
      // return one table per json file (after all is working)
      // return all data related to this member (via items, etc)
      // anonymize none user data (if it as access to an item who it is not the owner)

      const actions = await dataMemberService.getActions(member, repositories);
      // TODO: action_request_export
      // TODO: publisher -> no ?
      // TODO: apps, need publisher id... -> no ?
      const appActions = await dataMemberService.getAppActions(member, repositories);
      const appData = await dataMemberService.getAppData(member, repositories);
      const appSettings = await dataMemberService.getAppSettings(member, repositories);
      // TODO: chat_mention
      // TODO: chat_message
      // TODO: invitation ?
      // TODO: item_category
      // TODO: item_flag
      // TODO: item_geolocation
      // TODO: item_login ? and login schema
      const bookMarks = await dataMemberService.getBookMarks(member, repositories);
      const itemLikes = await dataMemberService.getItemLikes(member, repositories);
      const itemMemberShips = await dataMemberService.getItemsMemberShips(member, repositories);
      const ownItems = await dataMemberService.getOwnItems(member, repositories);
      // TODO: item_published
      // TODO: item_tag
      // TODO: item_validation ?, validation_group and validation_review ?
      // TODO: member
      // TODO: member_profile
      // TODO: recycled_item_data
      // TODO: short_link

      return {
        // actions,
        // appActions,
        // appData,
        appSettings,
        // bookMarks,
        // itemLikes,
        // itemMemberShips,
        // items: ownItems,
      };
    },
  );
};

export default plugin;
