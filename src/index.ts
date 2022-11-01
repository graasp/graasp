
import fastify from 'fastify';

import { AppDataSource } from './data-source';
import mercurius from 'mercurius';

import { buildSchema } from 'type-graphql';
import { ItemResolver } from './resolver/item-resolver';

const start = async () => {
  const instance = fastify({ logger: { level: 'info' } });

  // wait for connection with db
  await AppDataSource.initialize(); //.then(async () => {

      // // INSERT MEMBERS
      // const user = new Member();
      // user.name = 'wef';
      // user.email = 'gerfsd';
      // const memberRepository = AppDataSource.getRepository(Member);
      // await memberRepository.save(user);
      // console.log('Saved a new user with id: ' + user.id);

      // // ADD ITEMS WITH TREE
      // const itemRepository = AppDataSource.getRepository(Item);
      // const items = await itemRepository.find();
      // console.log('Loaded users: ', items.slice(0,3));

      // const parent = new Item();
      // // we add an id because the table is not correctly configured
      // parent.id='789abc9b-b50d-473a-a43e-aaa1d2c1eb86';
      // parent.name = 'parent';
      // await itemRepository.save(parent);

      // const children1 = new Item();
      // // we add an id because the table is not correctly configured
      // children1.id='ac38c34e-a623-4fa0-b125-1df115cce40f';
      // children1.parent = parent;
      // children1.name = 'children1';
      // await itemRepository.save(children1);

      // const children2 = new Item();
      // // we add an id because the table is not correctly configured
      // children2.id='6170c840-3eb4-494f-8ce8-74d0bb200bd2';
      // children2.name = 'children2';
      // children2.parent = children2;
      // await itemRepository.save(children2);

  // }).catch(error => console.log(error));

  // instance.decorate('db', await AppDataSource.initialize());


  // instance.register(itemRoutes);


  // build typeorm schema
  const schema = await buildSchema({
    resolvers: [ItemResolver],
  });

  // graphql-typeorm connector
  instance.register(mercurius, {
    schema,
    graphiql: true,

    errorFormatter: (executionResult, context) => {
      const log = context.reply ? context.reply.log : context.app.log;
      const errors = executionResult.errors.map((error) => {
        console.log(error);
          error.extensions.exception = error.originalError;
          Object.defineProperty(error, 'extensions', {enumerable: true});
          return error;
      });
      log.info({ err: executionResult.errors }, 'Argument Validation Error');
      return {
          statusCode: 201,
          response: {
              data: executionResult.data,
              errors
          }
      };
  }
  });

  try {
    await instance.listen({port:3000});
    console.log('running!');
    
    instance.log.info('App is running %s mode');
  } catch (err) {
    console.log(err);
    // instance.log.error(err);
    process.exit(1);
  }
};

start().catch(console.error);
