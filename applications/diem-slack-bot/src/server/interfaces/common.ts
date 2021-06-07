/**
 * Common environment for all modules
 *
 * @export
 * @interface IntEnv
 */
export interface IntEnv {
    NODE_ENV: string;
    app: string;
    appurl: string /** @param appurl the url to the application itself */;
    apppath: string;
    appcookie: string;
    description: string /** @param description description from package.json */;
    K8_APP: string;
    K8_APPURL: string /** @param k8_url the route to the root url */;
    K8_APPURLSHORT: string;
    K8_SYSTEM: string;
    K8_SYSTEM_NAME: string;
    packname: string /** @param packname name from package.json */;
    version: string /** @param version version from package.json */;
}

export interface IXorg {
    current: {
        org: string;
        role: string;
        rolenbr: number;
    };
    orgs: string[];
}

import { Request } from 'express';

export { Request };

export { NextFunction, Response as IResponse } from 'express';

export interface IRequest extends Request {
    transid?: string;
    rawBody?: any;
}

export interface IntInternal {
    source: string;
    err?: Error;
    message: string;
    fatal: boolean;
    pid: number;
    trace: string[];
}

export interface IError extends Error {
    [index: string]: any;
    email?: string;
    endpoint?: string;
    location?: string;
    log?: Record<string, unknown>;
    time?: string;
    transid?: string;
    url?: string;
    blocks?: any;
    caller: string;
}
