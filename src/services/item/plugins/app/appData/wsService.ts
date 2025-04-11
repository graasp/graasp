import { singleton } from 'tsyringe';

import { AuthorizationService } from '../../../../authorization';
import { BasicItemService } from '../../../basic.service';

@singleton()
export class WSService {
  constructor(bs: BasicItemService, a: AuthorizationService) {
    // TODO !!!!!!!!!!!!!!
    // websockets.register(appDataTopic, async (req) => {
    //   const { channel: id, member } = req;
    //   const item = await basicItemService.get(db, member, id);
    //   await authorizationService.validatePermission(db, PermissionLevel.Read, member, item);
    //   checkItemIsApp(item);
    // });
  }
}
