declare const _default: {
    $id: string;
    definitions: {
        item: {
            type: string;
            properties: {
                id: {
                    $ref: string;
                };
                name: {
                    type: string;
                };
                description: {
                    type: string[];
                };
                type: {
                    type: string;
                };
                /**
                 * itemPath's 'pattern' not supported in serialization.
                 * since 'item' schema is only used for serialization it's safe
                 * to just use `{ type: 'string' }`
                 */
                path: {
                    type: string;
                };
                extra: {
                    type: string;
                    additionalProperties: boolean;
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
        partialItem: {
            type: string;
            properties: {
                name: {
                    type: string;
                    minLength: number;
                };
                type: {
                    type: string;
                    minLength: number;
                };
                description: {
                    type: string;
                };
                extra: {
                    type: string;
                    additionalProperties: boolean;
                };
            };
            additionalProperties: boolean;
        };
        partialItemRequireOne: {
            allOf: ({
                $ref: string;
                anyOf?: undefined;
            } | {
                anyOf: {
                    required: string[];
                }[];
                $ref?: undefined;
            })[];
        };
    };
};
export default _default;
declare const create: {
    querystring: {
        type: string;
        properties: {
            parentId: {
                $ref: string;
            };
        };
        additionalProperties: boolean;
    };
    body: {
        allOf: ({
            $ref: string;
            required?: undefined;
        } | {
            required: string[];
            $ref?: undefined;
        })[];
    };
    response: {
        201: {
            $ref: string;
        };
    };
};
declare const getOne: {
    params: {
        $ref: string;
    };
    response: {
        200: {
            $ref: string;
        };
    };
};
declare const getChildren: {
    params: {
        $ref: string;
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
declare const getMany: {
    querystring: {
        allOf: ({
            $ref: string;
            properties?: undefined;
        } | {
            properties: {
                id: {
                    maxItems: number;
                };
            };
            $ref?: undefined;
        })[];
    };
    response: {
        200: {
            type: string;
            items: {
                anyOf: {
                    $ref: string;
                }[];
            };
        };
    };
};
declare const getOwnAndShared: {
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
declare const updateMany: {
    querystring: {
        allOf: ({
            $ref: string;
            properties?: undefined;
        } | {
            properties: {
                id: {
                    maxItems: number;
                };
            };
            $ref?: undefined;
        })[];
    };
    body: {
        $ref: string;
    };
    response: {
        200: {
            type: string;
            items: {
                anyOf: {
                    $ref: string;
                }[];
            };
        };
        202: {
            type: string;
            items: {
                $ref: string;
            };
        };
    };
};
declare const deleteOne: {
    params: {
        $ref: string;
    };
    response: {
        200: {
            $ref: string;
        };
    };
};
declare const deleteMany: {
    querystring: {
        allOf: ({
            $ref: string;
            properties?: undefined;
        } | {
            properties: {
                id: {
                    maxItems: number;
                };
            };
            $ref?: undefined;
        })[];
    };
    response: {
        200: {
            type: string;
            items: {
                anyOf: {
                    $ref: string;
                }[];
            };
        };
        202: {
            type: string;
            items: {
                $ref: string;
            };
        };
    };
};
declare const moveOne: {
    params: {
        $ref: string;
    };
    body: {
        type: string;
        properties: {
            parentId: {
                $ref: string;
            };
        };
        additionalProperties: boolean;
    };
};
declare const moveMany: {
    querystring: {
        allOf: ({
            $ref: string;
            properties?: undefined;
        } | {
            properties: {
                id: {
                    maxItems: number;
                };
            };
            $ref?: undefined;
        })[];
    };
    body: {
        type: string;
        properties: {
            parentId: {
                $ref: string;
            };
        };
        additionalProperties: boolean;
    };
};
declare const copyOne: {
    params: {
        $ref: string;
    };
    body: {
        type: string;
        properties: {
            parentId: {
                $ref: string;
            };
        };
        additionalProperties: boolean;
    };
};
declare const copyMany: {
    querystring: {
        allOf: ({
            $ref: string;
            properties?: undefined;
        } | {
            properties: {
                id: {
                    maxItems: number;
                };
            };
            $ref?: undefined;
        })[];
    };
    body: {
        type: string;
        properties: {
            parentId: {
                $ref: string;
            };
        };
        additionalProperties: boolean;
    };
};
export { create, getOne, getChildren, getMany, getOwnAndShared, updateOne, updateMany, deleteOne, deleteMany, moveOne, moveMany, copyOne, copyMany };
