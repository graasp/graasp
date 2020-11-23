declare const register: {
    body: {
        type: string;
        properties: {
            name: {
                type: string;
                minLength: number;
            };
            email: {
                type: string;
                format: string;
            };
        };
        additionalProperties: boolean;
    };
};
declare const login: {
    body: {
        type: string;
        properties: {
            email: {
                type: string;
                format: string;
            };
        };
        additionalProperties: boolean;
    };
};
declare const auth: {
    querystring: {
        type: string;
        properties: {
            t: {
                type: string;
            };
        };
        additionalProperties: boolean;
    };
};
export { register, login, auth };
