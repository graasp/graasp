import { saveMember } from '../../../../../member/test/fixtures/members';
import { MemberPasswordRepository } from '../../repository';

export const MOCK_PASSWORD = {
  password: 'asd',
  hashed: '$2b$10$WFVpHW6qSpZrMnk06Qxmtuzu1OU2C3LqQby5szT0BboirsNx4cdD.',
};

export const saveMemberAndPassword = async (member, { hashed }) => {
  const m = await saveMember(member);
  await MemberPasswordRepository.save({ member: m, password: hashed });
  return m;
};
