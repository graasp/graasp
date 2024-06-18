import { AppSettingRepository } from '../repository.js';

export const saveAppSettings = async ({ item, creator }) => {
  const defaultData = { name: 'setting-name', data: { setting: 'value' } };
  const s1 = await AppSettingRepository.save({ item, creator, ...defaultData });
  const s2 = await AppSettingRepository.save({ item, creator, ...defaultData });
  const s3 = await AppSettingRepository.save({ item, creator, ...defaultData });
  const s4 = await AppSettingRepository.save({
    item,
    creator,
    ...defaultData,
    name: 'new-setting',
  });
  return [s1, s2, s3, s4];
};
