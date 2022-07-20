# Task runner and database access

The way Graasp accesses the database is by using a system of tasks, that works in the following way: 

```typescript
const tm = new TaskManager(dbService);
const ts = tm.createSequence();
const res = await runner.runSequence(ts);
```

The system uses the following components :

- Database services
- Tasks
- Task sequences
- Task managers

## Database services

The database services are the classes where the SQL queries are stored. The database services implement methods to access the database :

```typescript
// The trxHandler is given by the task when executed
async get<E extends UnknownExtra>(id: string, transactionHandler: TrxHandler): Promise<Item<E>> {
return transactionHandler
    .query<Item<E>>(
    sql`
    SELECT ${ItemService.allColumns}
    FROM item
    WHERE id = ${id}
    `,
    )
    .then(({ rows }) => rows[0] || null);
}
```

## Tasks

`Tasks` are the smallest unit used to interact with the database. Each task is run in its own transaction.

### Constructors
The constructor usually takes 3 arguments :

- The actor : The id of the member making the request
- One database service : The task should use only one service, if multiple services are needed the task should be split into a task sequence
- The input : The user defined parameters that the task needs to successfully execute its query

### Input and getInput()

When a task is created, the developer can give the task an input:

```typescript 
new GetItemTask(member, dbservice, input)
```

However it's possible that the task needs input coming from another task, to do that the `getInput` method will be used. The developer can implement this method in the following manner : 

```typescript
t2.getInput = () => {
    return t1.getResult();
};
```

Then, the input from the constructor will be combined with the result of the getInput() when the task is executed.

**Warning! The identical keys from the `input` will be replaced by the values of `getInput()`**

### Skip

This allows to skip the execution of the `Task`, this is especially useful for the task sequences. To skip the task set the property to true.

```typescript 
t1.skip = true;
```

### Result - getResult()

When the task has been successfully executed, the result will be accessible with the `result` property :

```typescript 
const result = t1.result;
```

The task can also use the `getResult()` method if the result of the task needs to be different from the result of the query.

```typescript 
// Check if the item exists
const t1 = new GetItemTask();
// Validate the member has read permission
const t2 = new GetMembershipTask();
// returns the item to the user
t2.getResult = () => t1.result;
```

### PreHooks and PostHooks

Every task needs to implement the `name` property, this allows a convenient way to implement pre-hook and post-hook handlers. These handlers allow plugin to do work on the data before or after an event has happened (eg. user creation, item copy, ...).

```typescript
get name() {
    // return task's name
    return UpdateItemTask.name;
}
```
When a `PreHookHandler` or `PostHookHandler` is registered, the task runner will ensure that all registered handlers are run. A handler is registered using the name of the task they are attached to.

```typescript
// This is executed before the task makes the query to the database
runner.setTaskPreHookHandler<Item>(taskManager.getCreateTaskName(), async (item) => { });

// this is exectued after the result has been retrieved
runner.setTaskPostHookHandler<Item>(moveItemTaskName, async (item) => { });
```

## Sequences

Sequences are arrays of related tasks that are run in the same transaction. If any task throws an error, the whole sequence is aborted. The `TaskRunner` will always return the result of the last task in the sequence.

```typescript
// the task runner will always return the result from t3, even if skipped
[ t1, t2, t3 ]
```

A function can create a sequence by using the information already provided and avoid running unncessary tasks. In the following example, the `parentItem` is only retrieved if the `parentId` is set.

``` typescript
createSequence(member: Actor, input: { parentId?: string, itemId: string }){
    const tasks = [];
    // if parentId is provided, we get the parent too
    if(input.parentId){
        tasks.push(new GetItemTask(member, dbService, { parentId }));
    }
    tasks.push(new GetItemTask(task));
    return tasks;
}
```

If the tasks to execute cannot be determined at creation, the sequence can dynamically skip a task. In the following example, the second task will be skipped if the `membersId` are not matching, otherwise the task will return the new input for the execution.

``` typescript
createSequence(member: Actor, itemMembershipId: string){
    const t1 = new GetItemMembershipTask(member, this.itemMembershipService, { itemMembershipId });

    const t2 = new GetItemTask(member, this.itemService);
    t2.getInput = () => {
        // if member doesn't have access to the item, no need to get the item
        if (member.id !== t1.result.memberId) 
            return { itemPath: t1.result.itemPath };
        t2.skip = true;
    };
}    
```

## Task Managers

Task managers are the main way to create tasks and task sequences. They implement the methods to create tasks, task sequences and methods returning the name of the tasks provided.

### Constructors

When a task manager is created, it needs to have all the db services required by all the tasks. By doing so, the task manager can automatically inject the db services when a new task is created.

```typescript
constructor(
    itemService: ItemService,
    itemMembershipService: ItemMembershipService,
    memberService: MemberService,
) {
    this.itemService = itemService;
    this.itemMembershipService = itemMembershipService;
    this.memberService = memberService;
}
```

### Task names

The method returning the name of the task is used to implement `preHookHandlers` and `postHookHandlers`. The method is implemented in the following way :

```typescript
getCreateTaskName(): string {
return CreateItemTask.name;
}
```

### Factory methods

The task manager also implements methods to create new tasks or task sequences. These methods are responsible to inject the database service when creating a new instance of the task.

```typescript
createCreateTask(member: Member, data: Partial<Item>): CreateItemTask {
// when the task is created, dbservice is injected
return new CreateItemTask(member, this.itemService, { data });
}
```

## Task Runner

The task runner executes all the tasks. It has 4 modes of execution.

```typescript
// Run given task (transactionally) and return the task's result (or throws error).
runSingle<T>(task: Task<A, T>, log?: FastifyLoggerInstance): Promise<T>;

// Run given tasks (one by one, each in a separate transaction), collect results (values or errors), and return an array with everything.
runMultiple(tasks: Task<A, unknown>[], log?: FastifyLoggerInstance): Promise<unknown[]>;

// Run given task sequence in a single transaction, sequencially, and return the last task's result.
runSingleSequence(tasks: Task<A, unknown>[], log?: FastifyLoggerInstance): Promise<unknown>;

// Run given task sequences (one by one, each in a separate transaction), collect results (values or errors), and return an array with everything.
runMultipleSequences(tasks: Task<A, unknown>[][], log?: FastifyLoggerInstance): Promise<unknown>;
```
