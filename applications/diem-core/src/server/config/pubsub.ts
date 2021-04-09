import { utils } from '@common/utils';
import { IntEnv } from '@interfaces';
import { IJobResponse, IUserPayload, ISocketPayload } from '@models';
import { addTrace } from '@functions';
import { servicesOutHandler } from '../routes/services/getservice';
import { jobHandler } from '../routes/job.backend/job.handler';
import { publisher } from './nats_publisher';

export class Server {
    public pack: IntEnv;

    public constructor() {
        this.pack = utils.Env;
    }

    public publish: (job: IJobResponse) => Promise<void> = async (job: IJobResponse): Promise<void> => {
        try {
            // setTimeout(async () => {
            const pl: ISocketPayload | void = await jobHandler(job);
            /* pass the message to redis for global handling */

            utils.logInfo(`$pubsub (publish): publishing payload - job: ${job.id}`);

            void publisher.publish('global.core.users', pl);

            return Promise.resolve();
            // }, 1);
        } catch (err) {
            err.trace = addTrace(err.trace, '@at $pubsub (publish)');

            await utils.logError(`$pubsub (publish): error - job: ${job.id}`, err);

            return Promise.reject(err);
        }
    };

    public publishService: (job: IJobResponse) => Promise<void> = async (job: IJobResponse): Promise<void> => {
        try {
            // setTimeout(async () => {
            const results: ISocketPayload | void = await servicesOutHandler(job);
            /* pass the message to redis for global handling */

            utils.logInfo(`$pubsub (publishservice): publishing payload - job: ${job.id}`);

            pubSub.publishUserPayload({
                email: job.email,
                payload: {
                    org: job.org,
                    payload: [results],
                },
            });

            return Promise.resolve();
            // }, 1);
        } catch (err) {
            err.trace = addTrace(err.trace, '@at $pubsub (publish)');

            await utils.logError(`$pubsub (publish): error - job: ${job.id}`, err);

            return Promise.reject(err);
        }
    };

    public publishUserPayload: (userPayload: IUserPayload) => void = (userPayload: IUserPayload) => {
        /* pass the message to redis for global handling */

        void publisher.publish('global.core.user', userPayload);
    };

    public toString: (json: any) => string = (json: any) => JSON.stringify(json);

    public toJson: (text: string) => any = (text: string) => JSON.parse(text);
}

export const pubSub: Server = new Server();
