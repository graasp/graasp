declare type Anything = string | number | boolean | null | Anything[] | {
    [key: string]: Anything;
};
export interface UnknownExtra {
    [key: string]: Anything;
}
export interface Item<T = UnknownExtra> {
    id: string;
    name: string;
    description: string;
    type: string;
    path: string;
    extra: T;
    creator: string;
    createdAt: string;
    updatedAt: string;
}
export {};
