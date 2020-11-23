declare const _default: {
    $id: string;
    definitions: {
        permission: {
            type: string;
            enum: string[];
        };
        itemMembership: {
            type: string;
            properties: {
                id: {
                    $ref: string;
                };
                memberId: {
                    $ref: string;
                };
                /**
                 * itemPath's 'pattern' not supported in serialization.
                 * since 'itemMembership' schema is only used for serialization it's safe
                 * to just use `{ type: 'string' }`
                 */
                itemPath: {
                    type: string;
                };
                permission: {
                    $ref: string;
                };
                creator: {
                    $ref: string;
                };
                createdAt: {
                    type: string;
                };
                updatedAt: {
                    type: string;
                };
            };
            additionalProperties: boolean;
        };
        createPartialItemMembership: {
            type: string;
            required: string[];
            properties: {
                memberId: {
                    $ref: string;
                };
                permission: {
                    $ref: string;
                };
            };
            additionalProperties: boolean;
        };
        updatePartialItemMembership: {
            type: string;
            required: string[];
            properties: {
                permission: {
                    $ref: string;
                };
            };
            additionalProperties: boolean;
        };
    };
};
export default _default;
declare const create: {
    querystring: {
        type: string;
        required: string[];
        properties: {
            itemId: {
                $ref: string;
            };
        };
        additionalProperties: boolean;
    };
    body: {
        $ref: string;
    };
    response: {
        201: {
            $ref: string;
        };
    };
};
declare const getItems: {
    querystring: {
        type: string;
        required: string[];
        properties: {
            itemId: {
                $ref: string;
            };
        };
        additionalProperties: boolean;
    };
    response: {
        200: {
            type: string;
            items: {
                $ref: string;
            };
        };
    };
};
declare const updateOne: {
    params: {
        $ref: string;
    };
    body: {
        $ref: string;
    };
    response: {
        200: {
            $ref: string;
        };
    };
};
declare const deleteOne: {
    params: {
        $ref: string;
    };
    querystring: {
        type: string;
        properties: {
            purgeBelow: {
                type: string;
            };
        };
        additionalProperties: boolean;
    };
    response: {
        200: {
            $ref: string;
        };
    };
};
export { getItems, create, updateOne, deleteOne };
