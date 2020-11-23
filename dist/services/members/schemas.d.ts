declare const _default: {
    $id: string;
    definitions: {
        member: {
            type: string;
            properties: {
                id: {
                    type: string;
                };
                name: {
                    type: string;
                };
                email: {
                    type: string;
                };
                type: {
                    type: string;
                };
            };
            additionalProperties: boolean;
        };
        partialMember: {
            type: string;
            properties: {
                name: {
                    type: string;
                };
                email: {
                    type: string;
                    format: string;
                };
                type: {
                    type: string;
                    enum: string[];
                };
            };
            additionalProperties: boolean;
        };
    };
};
export default _default;
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
declare const create: {
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
        200: {
            $ref: string;
        };
    };
};
export { getOne, create };
