import { AppDataSource } from '../../../../../../plugins/datasource';
import { type Member } from '../../../../../member/entities/member';
import { type Item } from '../../../../entities/Item';
import { AppSetting } from '../appSettings';

export const saveAppSettings = async ({ item, creator }: { item: Item; creator: Member }) => {
  const defaultData = { name: 'setting-name', data: { setting: 'value' } };
  const rawAppSettingRepository = AppDataSource.getRepository(AppSetting);
  const s1 = await rawAppSettingRepository.save({ item, creator, ...defaultData });
  const s2 = await rawAppSettingRepository.save({ item, creator, ...defaultData });
  const s3 = await rawAppSettingRepository.save({ item, creator, ...defaultData });
  const s4 = await rawAppSettingRepository.save({
    item,
    creator,
    ...defaultData,
    name: 'new-setting',
  });
  return [s1, s2, s3, s4];
};
