import AWS from 'ibm-cos-sdk';
import { Credentials } from './cfenv';

interface ICosCfg {
    accessKeyId?: string;
    apiKeyId?: string;
    endpoint: string;
    secretAccessKey?: string;
    signatureVersion?: string;
    serviceInstanceId?: string;
}

class Cos {
    public cos: AWS.S3;

    public constructor() {
        const cosCfg: ICosCfg = Credentials('COS');

        if (cosCfg.serviceInstanceId && !cosCfg.signatureVersion) {
            cosCfg.signatureVersion = 'iam';
        }

        this.cos = new AWS.S3(cosCfg);
    }
}

export const cos: AWS.S3 = new Cos().cos;

export interface ICos extends AWS.S3 {
    ICosObj: AWS.S3.Object;
}
