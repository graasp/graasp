declare const _default: {
    $id: string;
    definitions: {
        uuid: {
            type: string;
            pattern: string;
        };
        itemPath: {
            type: string;
            pattern: string;
        };
        idParam: {
            type: string;
            required: string[];
            properties: {
                id: {
                    $ref: string;
                };
            };
            additionalProperties: boolean;
        };
        idsQuery: {
            type: string;
            required: string[];
            properties: {
                id: {
                    type: string;
                    items: {
                        $ref: string;
                    };
                    uniqueItems: boolean;
                };
            };
            additionalProperties: boolean;
        };
        error: {
            type: string;
            properties: {
                name: {
                    type: string;
                };
                message: {
                    type: string;
                };
                statusCode: {
                    type: string;
                };
                error: {
                    type: string;
                };
                data: {};
            };
            additionalProperties: boolean;
        };
    };
};
export default _default;
