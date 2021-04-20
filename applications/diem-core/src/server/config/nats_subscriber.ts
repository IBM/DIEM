import { utils } from '@common/utils';
import { INatsPayload } from '@interfaces';
import { NatsConnection, Subscription, ServerInfo, Msg } from 'nats';
import { slackMsg } from '@common/slack/slack';
import { toBuff, fromBuff } from './nats_connect';
import { pubSub } from './pubsub';
import { WSS } from './socket';
import { getQueue } from './cron.jobs';

const queue: string = 'core';
const core_channel: string = 'core.*';
const global_core_channel: string = 'global.core.*';

class Subscriber {
    private nc!: NatsConnection;
    private info!: ServerInfo;
    private subscription!: Subscription;
    private global_subscription!: Subscription;
    private client: string;

    public constructor() {
        this.client = process.env.HOSTNAME || 'diem-core';
    }

    public connect = async (nc: NatsConnection) => {
        try {
            this.nc = nc;
        } catch (err) {
            void utils.logError('$nats_subscriber (connect): connect error:', err);

            return;
        }

        if (this.nc.info) {
            this.info = this.nc.info;
            utils.logInfo(
                `$nats_subscriber (connect): connected - nsid ${this.info.client_id} - nsc ${this.info.client_ip}`
            );
        }

        this.subscription = this.nc.subscribe(core_channel, { queue });
        this.global_subscription = this.nc.subscribe(global_core_channel);

        void this.subs();
        void this.global_subs();

        return Promise.resolve();
    };

    private subs = async (): Promise<void> => {
        for await (const msg of this.subscription) {
            const payload: INatsPayload | string | undefined = fromBuff(msg.data);

            if (payload && typeof payload === 'object' && payload.client) {
                const wait: number = 10 + (payload.size || 25) * 10;
                utils.logInfo(
                    `$nats_subscriber (sub): client: ${payload.client} - new data: ${
                        payload.size || 0
                    } - next wait: ${wait}`
                );
                void this.subs_handler(msg, payload);
                await new Promise((resolve) => setTimeout(resolve, wait));
            }
        }
    };

    private global_subs = async (): Promise<void> => {
        for await (const msg of this.global_subscription) {
            const payload: INatsPayload | string | undefined = fromBuff(msg.data);

            // if it's not the payload we need, we cannot handle it
            if (payload && typeof payload === 'object' && payload.client) {
                void this.global_subs_handler(msg, payload);
            }
        }
    };

    private json_handler = async (json_array: any) => {
        let i: number = -10;
        json_array.forEach(async (json: any) => {
            let parsed_json: any;
            i = i + 10;

            try {
                parsed_json = JSON.parse(json);
                if (parsed_json.serviceid) {
                    await pubSub.publishService(parsed_json);
                } else {
                    // let's add a timeout so that the messages have sufficient time to be processed
                    setTimeout(async () => {
                        await pubSub.publish(parsed_json);
                    }, i);
                }
            } catch (err) {
                utils.logInfo('$nats_subscriber (subs): job - unparsable json');
            }
        });
    };

    private subs_handler = async (msg: Msg, payload: INatsPayload) => {
        const subject: string = msg.subject;

        // if it's not the payload we need, we cannot handle it

        let msg_type: string;

        if (subject.includes('.')) {
            msg_type = subject.split('.')[1];
        } else {
            msg_type = subject;
        }

        switch (msg_type) {
            case 'info':
                utils.logInfo(`$nats_subscriber (${msg_type}): client: ${payload.client} - info: ${payload.data}`);
                break;

            case 'publish':
                utils.logInfo(`$nats_subscriber (${msg_type}): client: ${payload.client}`);
                const publish_msg: string = `📨 $publish (${payload.client}): ${payload.data}`;

                void slackMsg(publish_msg);
                break;

            case 'timer':
                utils.logInfo(`$nats_subscriber (${msg_type}): client: ${payload.client} - run: ${payload.data.run}`);
                getQueue();
                break;

            case 'job':
                const data = payload.data;

                if (data && typeof data === 'string' && data.endsWith('\n')) {
                    const json_array: string[] = data.split('\n').filter((s: string) => s);
                    utils.logInfo(
                        `$nats_subscriber (${msg_type}): client: ${payload.client} - incoming buffered data: ${json_array.length}`
                    );
                    // await new Promise((resolve) => setTimeout(resolve, 50));
                    void this.json_handler(json_array);
                } else {
                    utils.logInfo(`$nats_subscriber (${msg_type}): client: ${payload.client} - incoming data`);
                    await pubSub.publish(payload.data);
                }
                break;

            default:
                utils.logInfo(`$nats_subscriber (${msg_type}): client: ${payload.client}`);
        }

        if (msg.reply) {
            msg.respond(
                toBuff({
                    client: this.client,
                    sid: msg.sid || 0,
                })
            );
            utils.logInfo(`$$nats_subscriber (${msg_type}):  client: ${payload.client} - client: ${msg.sid}`);
        }

        if (!['timer', 'info', 'job'].includes(msg_type)) {
            utils.logInfo(`$nats_subscriber (${msg_type}): client: ${payload.client}`);
        }
    };

    private global_subs_handler = async (msg: Msg, payload: INatsPayload) => {
        const subject: string = msg.subject;

        let msg_type: string;

        if (subject.includes('.')) {
            msg_type = subject.split('.')[2]; // global.core.xxx
        } else {
            msg_type = subject;
        }

        switch (msg_type) {
            case 'info':
                utils.logInfo(
                    `$nats_subscriber (global.${msg_type}): client: ${payload.client} - data: ${payload.data}`
                );
                break;

            case 'error':
                utils.logInfo(`$nats_subscriber (global.${msg_type}): client: ${payload.client}`);

                await pubSub.publish(payload.data);
                break;

            case 'users':
                utils.logInfo(`$nats_subscriber (global.${msg_type}): client: ${payload.client}`);

                WSS.bc(payload.data);
                break;

            case 'user':
                utils.logInfo(`$nats_subscriber (global.${msg_type}): client: ${payload.client}`);

                const data: { email: string; payload: string } = payload.data;

                WSS.bcUser({ email: data.email, payload: data.payload });
                break;

            default:
                utils.logInfo(`$nats_subscriber (global.${msg_type}): client: ${payload.client}`);
        }
    };
}

export const subscriber = new Subscriber();
