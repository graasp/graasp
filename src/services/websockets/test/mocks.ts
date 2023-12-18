/**
 * graasp-plugin-websockets
 *
 * Mock instances for testing in graasp-plugin-websockets
 */

export const createMockMember = (extra?) => ({
  name: 'mockMemberName',
  email: 'mockMemberEmail',
  id: 'mockMemberId',
  type: 'individual',
  extra,
  createdAt: 'mockMemberCreatedAt',
  updatedAt: 'mockMemberUpdatedAt',
});

// mock preHandler to be injected in test fastify instance to simulate authentication
export const mockSessionPreHandler = async (request, _reply) => {
  request.member = createMockMember();
};

// Signature of @types/graasp/plugins/auth/interfaces/auth.d.ts is wrong! Force return of Promise
// instead of void to ensure termination (https://www.fastify.io/docs/latest/Hooks/#prehandler).
export const mockValidateSession = jest.fn().mockReturnValue(Promise.resolve());
