import { FastifyLoggerInstance } from 'fastify';
import { Database } from '../plugins/database';
import { TaskManager } from '../interfaces/task-manager';
import { Task, PreHookHandlerType, PostHookHandlerType } from '../interfaces/task';
import { Actor } from '../interfaces/actor';
import { Result } from '../interfaces/result';
export declare abstract class BaseTaskManager<T extends Result> implements TaskManager<Actor, T> {
    private databasePool;
    protected logger: FastifyLoggerInstance;
    constructor(database: Database, logger: FastifyLoggerInstance);
    private handleTaskFinish;
    /**
     * Run each task, and any subtasks, in a transaction.
     * If something goes wrong the whole task is canceled/reverted.
     *
     * @param task Task to run
     * @param log Logger instance
     * @returns Task's `result` or, if it has subtasks, the `result` of the last subtask.
     */
    private runTransactionally;
    /**
     * Run each subtask in a nested transaction.
     * If something goes wrong the execution stops at that point and returns.
     * Subtasks that ran successfully are not reverted/rolledback.
     *
     * @param subtasks Subtasks to run
     * @param handler Task's transactional handler
     * @param log Logger instance
     */
    private runTransactionallyNested;
    /**
     * Run given tasks.
     * * If only one task, run task and return the task's result: value or error.
     * * If >1 task, run tasks, collect results (values or errors) and return an array with everything.
     *
     * @param tasks List of tasks to run.
     * @param log Logger instance to use. Defaults to `this.logger`.
     */
    run(tasks: Task<Actor, T>[], log?: FastifyLoggerInstance): Promise<void | T | T[]>;
    abstract createCreateTask(actor: Actor, object: T, extra?: unknown): Task<Actor, T>;
    abstract createGetTask(actor: Actor, objectId: string): Task<Actor, T>;
    abstract createUpdateTask(actor: Actor, objectId: string, object: Partial<T>): Task<Actor, T>;
    abstract createDeleteTask(actor: Actor, objectId: string): Task<Actor, T>;
    protected tasksHooks: Map<string, {
        pre?: {
            handlers: PreHookHandlerType<T>[];
            wrapped: PreHookHandlerType<T>;
        };
        post?: {
            handlers: PostHookHandlerType<T>[];
            wrapped: PostHookHandlerType<T>;
        };
    }>;
    private wrapTaskPreHookHandlers;
    private wrapTaskPostHookHandlers;
    protected setTaskPreHookHandler(taskName: string, handler: PreHookHandlerType<T>): void;
    protected setTaskPostHookHandler(taskName: string, handler: PostHookHandlerType<T>): void;
    protected unsetTaskPreHookHandler(taskName: string, handler: PreHookHandlerType<T>): void;
    protected unsetTaskPostHookHandler(taskName: string, handler: PostHookHandlerType<T>): void;
}
