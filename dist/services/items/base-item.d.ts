import { Item, UnknownExtra } from './interfaces/item';
export declare class BaseItem implements Item {
    static propagatingProperties: (keyof Item)[];
    readonly id: string;
    name: string;
    description: string;
    type: string;
    path: string;
    extra: UnknownExtra;
    readonly creator: string;
    readonly createdAt: string;
    readonly updatedAt: string;
    constructor(name: string, description: string, type: string, extra: UnknownExtra, creator: string, parent?: Item);
    static itemDepth(item: Item): number;
    static parentPath(item: Item): string;
    static pathToId(path: string): string;
}
