import { MemberPasswordRepository } from '../../src/services/auth/plugins/password/repository';
import { saveMember } from './members';

export const MOCK_PASSWORD = {
  password: 'asd',
  hashed: '$2b$10$WFVpHW6qSpZrMnk06Qxmtuzu1OU2C3LqQby5szT0BboirsNx4cdD.',
};

export const saveMemberAndPassword = async (member, { hashed }) => {
  const m = await saveMember(member);
  await MemberPasswordRepository.save({ member: m, password: hashed });
  return m;
};
