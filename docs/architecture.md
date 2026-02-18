# Backend

## Technologies

The backend is based on **Typeorm** and **Fastify**. 

## Structure

The backend is structured using Fastify's plugins. Each plugin represents a feature (eg. member, item like, favorite, etc). Each plugin is structured with one or many controllers, services, repositories and entities:

- **Controllers**: the endpoints are defined in the controller. A json schema definition (per endpoint) verifies the input and output schemas of these endpoints.

- **Services**: the service provides an api to apply a set of operations. 
  - Services should check the member's authorization to access a particular data. 
  - Each function should start with `actor` and `repositories`. The repositories are always passed down because they ensure the following operations are scoped within the same transaction.  
  - *Hooks*: Each function can run pre- and post-hooks that get registered outside of the service. (to be removed?)
  - If possible, the service should be available and be used by other services instead of using the repository directly. This will ensure proper unauthorization. For instance:

```ts
post(actor: Actor, repositories: Repositories, myData: unknown) {
  repositories.itemRepository.post(...) // do not use this
  this.itemService.post(...) // use this
}
```

- **Repositories**: the repository is the interface to handle database queries. 

- **Entities**: A Typeorm's Entity represents a database table 



## Important Utils
`validatePermission` of `authorization.ts` is used to verify if a given actor has access (or has the necessary rights) to a given item. 
