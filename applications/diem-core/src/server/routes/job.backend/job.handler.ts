/* eslint-disable @typescript-eslint/indent */
/* eslint-disable complexity */
/* eslint-disable sonarjs/cognitive-complexity */

import { EStoreActions, IntPayload } from '@interfaces';
import { utils } from '@common/utils';
import { DataModel, EJobTypes, IJobResponse, IJobModel, EJobStatus, ISocketPayload, ExecutorTypes } from '@models';
import { addTrace } from '@functions';
import { pipelineHandler } from '../pipeline.backend/pipeline.handler';
import { PayloadValues } from './job.functions';
import { finishJob, getPySparkJobLog } from './job.finish';

interface IOut {
    out: string;
    special?: string;
    outl?: boolean;
}

const jobdetail: string = 'jobdetail.store';

const runTime: (doc: IJobModel) => number = (doc: IJobModel): number => {
    const je: Date | undefined = doc.job.jobend ? new Date(doc.job.jobend) : new Date();

    const js: Date | undefined = doc.job.jobstart ? new Date(doc.job.jobstart) : new Date();

    return je && js ? Math.round(Math.abs(je.getTime() - js.getTime()) / 1000) : 0;
};

export const updateOne: (doc: IJobModel, obj: any) => any = async (doc: IJobModel, obj: any) =>
    Promise.resolve(await doc.updateOne(obj));

export const jobOutHandler: (doc: IJobModel, job: IJobResponse) => Promise<ISocketPayload> = async (
    doc: IJobModel,
    job: IJobResponse
): Promise<ISocketPayload> => {
    const id: string = doc._id.toString();
    const obj: IOut = {
        out: job.out,
        special: job.special,
    };

    if (job.outl) {
        doc.out = doc.out.concat(job.out);
    } else if (Array.isArray(doc.out)) {
        doc.out.push(obj);
    } else {
        doc.out = [obj];
    }

    await doc.save().catch(async (err: any) => {
        err.trace = addTrace(err.trace, '@at $job.handler (jobHandler)');
        err.id = id;

        void utils.emit('error', err);
    });

    utils.logInfo(`$job.handler (jobHandler): out payload - job: ${job.id}`, job.transid);

    const load: ISocketPayload = {
        org: doc.project.org,
        payload: [
            {
                loaded: true,
                store: jobdetail,
                targetid: job.id,
                options: {
                    field: 'out',
                },
                type: job.outl ? EStoreActions.APPEND_STORE_TABLE_RCD : EStoreActions.ADD_STORE_TABLE_RCD,
                values: {
                    out: job.out,
                    special: job.special,
                },
            },
        ],
    };

    return Promise.resolve(load);
};

const jobDocOutHandler: (payload: IntPayload[], doc: IJobModel, job: IJobResponse) => Promise<IntPayload[]> = async (
    payload: IntPayload[],
    doc: IJobModel,
    job: IJobResponse
): Promise<IntPayload[]> => {
    const obj: IOut = {
        out: job.out,
        special: job.special,
    };

    if (job.outl) {
        doc.out = doc.out.concat(job.out);
    } else if (Array.isArray(doc.out)) {
        doc.out.push(obj);
    } else {
        doc.out = [obj];
    }

    utils.logInfo(`$job.handler (jobDocOutHandler): out payload - job: ${job.id}`, job.transid);

    payload.push({
        loaded: true,
        store: jobdetail,
        targetid: job.id,
        options: {
            field: 'out',
        },
        type: job.outl ? EStoreActions.APPEND_STORE_TABLE_RCD : EStoreActions.ADD_STORE_TABLE_RCD,
        values: {
            out: job.out,
            special: job.special,
        },
    });

    return Promise.resolve(payload);
};

/**
 *
 *
 * @param {*} job
 * @returns {Promise<IjobHandler>}
 */
export const jobHandler: (job: IJobResponse) => Promise<ISocketPayload> = async (
    job: IJobResponse
): Promise<ISocketPayload> => {
    /**
     * @info Job can be a pipeline or a regular job
     *
     * if it's a pipeline we need to do some other pipeline actions
     */

    try {
        const id: string = job.id;
        const doc: IJobModel | null = await DataModel.findOne({ _id: id })
            .exec()
            .catch(async (err: any) => {
                err.trace = addTrace(err.trace, '@at $job.handler (jobHandler) - findOne');
                err.id = id;

                return Promise.reject(err);
            });

        if (doc === null) {
            return Promise.reject({
                id,
                message: 'The document could not be found',
                trace: ['@at $job.handler (jobHandler)'],
            });
        }

        let payload: IntPayload[] = [];

        // if it's just an out message and it's not the end then handle it as just an out

        if (job.out !== undefined && !job.status) {
            const load: any = await jobOutHandler(doc, job);

            return Promise.resolve(load);
        } else if (job.out) {
            payload = await jobDocOutHandler(payload, doc, job);
        }

        /**
         * @info it's a pipeline unless it's not a pipeline job in itsel
         */
        const isPl: boolean = doc.type === EJobTypes.pipeline; // is a pipeline
        const jobkind: string = isPl ? 'pl' : 'job';

        doc.job = { ...doc.toObject().job, ...job };

        doc.job.runtime = runTime(doc);

        if (doc.job.error && !job.error) {
            doc.job.error = null;
        }

        const values: IJobResponse = PayloadValues({
            id,
            status: doc.job.status,
            jobend: doc.job.jobend,
            jobstart: doc.job.jobstart,
            runtime: doc.job.runtime,
            count: doc.job.count,
            error: doc.job.error || null,
        });

        // remove log from values for jobs
        const { log, audit, ...rest } = values;

        // update the all jobs
        payload.push({
            key: 'id',
            loaded: true,
            store: 'jobs',
            type: EStoreActions.UPD_STORE_RCD, // update all jobs
            values: rest,
        });

        // get the log of the sparkjob in case of an error
        if (doc.job.error && doc.job.executor === ExecutorTypes.pyspark) {
            await getPySparkJobLog(doc);
        }

        // can i remove this
        const isActivePl: boolean = isPl && doc.jobs && Object.keys(doc.jobs).length > 0; // has pipeline items
        if (isActivePl && ['Running', 'Failed', 'Completed'].includes(doc.job.status)) {
            values.jobs = job.jobs;
        }

        if (doc.out?.length === 0) {
            values.out = doc.out;
        }

        // adding the job log
        if (['Failed', 'Stopped', 'Completed'].includes(job.status) && !isPl) {
            await finishJob(doc);

            // we don't now need the job audit anymore in the job itself
            doc.job.audit = undefined;
            doc.markModified('job.audit');
        }

        // here we save the job as no more values of the document will be changed
        await doc.save().catch(async (err: any) => {
            err.caller = '$job.handler';

            console.info(err.code, err.message);

            return Promise.reject(err);
        });

        // if it's a regular job , make sure that the stop is really stopped, so this does not include pipelines
        if (job.jobid !== id) {
            utils.logInfo(
                `$job.handler (jobHandler): handle pipeline - pl: ${job.jobid} - job: ${id} - job status: ${job.status}`,
                job.transid
            );

            // handles the pipeline and returns the payload for that pipeline
            payload = await pipelineHandler(job, payload).catch(async (err) => {
                err.trace = addTrace(err.trace, '@at $job.handler (pipelineHandler)');

                return Promise.reject(err);
            });

            // this is the payload for the pipeline table

            // remove log from values for jobs

            payload.push({
                key: 'id',
                loaded: true,
                options: {
                    field: 'jobs',
                },
                store: jobdetail,
                targetid: job.jobid,
                type: EStoreActions.UPD_STORE_TABLE_RCD,
                values,
            });
        }
        values.log = doc.toObject().log;

        payload.push({
            loaded: true,
            store: jobdetail,
            targetid: job.id,
            type: EStoreActions.UPD_STORE_FORM_RCD,
            values,
        });

        const load: ISocketPayload = {
            org: doc.project.org,
            payload,
        };

        // not all payload types require a popup message
        if (job.status) {
            load.message = `${jobkind}: ${doc.name} ${doc.job.status}`;
            load.success = job.status === EJobStatus.failed ? false : true; /** just display a success message */
        }

        return Promise.resolve(load);
    } catch (err) {
        err.trace = addTrace(err.trace, '@at $job.handler (jobHandler)');

        return Promise.reject(err);
    }
};
