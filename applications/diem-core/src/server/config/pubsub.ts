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

            utils.logInfo(`$pubsub (publish): passing to jobHandler - job: ${job.id}`);

            const payload: ISocketPayload | false = await jobHandler(job);

            if (payload === false) {
                utils.logInfo(`$pubsub (publish): not going to publish - job: ${job.id}`);

                return;
            }

            utils.logInfo(`$pubsub (publish): publishing payload - job: ${job.id}`);

            await publisher.publish('global.core.users', payload);

            // }, 1);
        } catch (err) {
            err.trace = addTrace(err.trace, '@at $pubsub (publish)');

            await utils.logError(`$pubsub (publish): error - job: ${job.id}`, err);

            // return Promise.reject(err);
        }
    };

    public publishService: (job: IJobResponse) => Promise<void> = async (job: IJobResponse): Promise<void> => {
        try {
            const results: ISocketPayload = await servicesOutHandler(job);

            utils.logInfo(`$pubsub (publishservice): publishing payload - job: ${job.id}`);

            void pubSub.publishUserPayload({
                email: job.email,
                payload: {
                    org: job.org,
                    payload: [results],
                },
            });

            return Promise.resolve();
            // }, 1);
        } catch (err) {
            err.trace = addTrace(err.trace, '@at $pubsub (publishService)');

            await utils.logError(`$pubsub (publish): error - job: ${job.id}`, err);

            void Promise.reject();
        }
    };

    public publishUserPayload: (userPayload: IUserPayload) => void = (userPayload: IUserPayload) => {
        void publisher.publish('global.core.user', userPayload);
    };

    public toString: (json: any) => string = (json: any) => JSON.stringify(json);

    public toJson: (text: string) => any = (text: string) => JSON.parse(text);
}

export const pubSub: Server = new Server();
