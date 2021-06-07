import { spawnSync, SpawnSyncReturns } from 'child_process';
import path from 'path';
import { utils } from '@config/utils';
import * as rimraf from 'rimraf';
import { ServicesJob, red, ECodeLanguage } from '@interfaces';

export const servicesNodepy: (job: ServicesJob) => Promise<any> = async (job: ServicesJob): Promise<any> => {
    const cleanup: () => void = (): void => {
        try {
            rimraf.sync(`${path.resolve()}/workdir/${id}`);

            utils.logInfo(`$services.nodepy ${process.pid} ${id}: removed folder ${id}`, job.transid);
        } catch (error) {
            console.error(
                red,
                `$services.nodepy ${process.pid} ${id}: folder ${id} not deelted - folder might already have been removed`
            );
        }
    };

    const id: string = job.id;

    let response: SpawnSyncReturns<Buffer>;

    if (job.language === ECodeLanguage.javascript) {
        response = spawnSync('node', [`${path.resolve()}/workdir/${id}/${id}.js`, job.params], {
            env: {
                PATH: `/home/app/.local/bin:${process.env.PATH}`,
            },
            cwd: `${path.resolve()}/workdir/${id}/workdir`,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
    } else {
        response = spawnSync('python3', ['-u', `${path.resolve()}/workdir/${id}/${id}.py`, job.params], {
            env: {
                PATH: process.env.PATH,
                APPPATH: process.env.APPPATH,
                CLASSPATH: '/opt/spark/jars/*',
            },
            cwd: `${path.resolve()}/workdir/${id}/workdir`,
        });
    }

    // collect data from script

    let response_string;

    if (response.status !== 0) {
        response_string = response.stderr.toString();
    } else {
        response_string = response.stdout.toString();
    }

    let data: any = {};

    console.info(response_string);

    try {
        data = JSON.parse(response_string);
    } catch (err) {
        data = {
            data: response_string,
        };
    }

    cleanup();

    return Promise.resolve(data);
};
