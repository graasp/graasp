/** Helper type for fastify-static */
export interface FastifyStaticReply {
  setHeader: (key: string, value: string) => void;
}
