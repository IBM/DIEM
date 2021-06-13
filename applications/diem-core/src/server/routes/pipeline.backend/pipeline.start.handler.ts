import { utils } from '@common/utils';
import { DataModel, EJobStatus, IJob, IJobDetails, EJobStatusCodes, IJobModel } from '@models';
import { pubSub } from '@config/pubsub';
import { flatten__, addTrace } from '@functions';
import { jobStartHandler } from '../job.backend/job.start.handler';
import { findByFilter } from '../job.backend/job.functions';
import { saveDoc } from '../job.backend/job.savedoc';

const findOne: (id: string) => any = async (id: string) => DataModel.findOne({ _id: id }).exec();

const findRootJobs: (jobs: IJobDetails, id: string) => Promise<string[]> = async (
    jobs: IJobDetails,
    id: string
): Promise<string[]> => {
    const rootJobs: string[] = [];

    for await (const [key, value] of Object.entries(jobs)) {
        if (value && value.from) {
            for (const ref of value.from) {
                if (ref === id) {
                    rootJobs.push(key);
                }
            }
        }
    }

    return Promise.resolve(rootJobs);
};

export const resetQueue: (jobs: IJobDetails) => Promise<IJobDetails> = async (
    jobs: IJobDetails
): Promise<IJobDetails> => {
    for await (const [key, value] of Object.entries(jobs)) {
        if (jobs[key]) {
            if (value && value.from) {
                jobs[key].queue = [];
            }
            value.status = EJobStatus.pending;
        }
    }

    return Promise.resolve(jobs);
};

const updateJobs: (doc: IJobModel) => Promise<void> = async (doc: IJobModel): Promise<void> => {
    const id: string = doc._id.toString();

    const jobs: IJobDetails = doc.jobs;

    let set: any = { 'job.status': EJobStatus.pending };

    /** There are additional parameters
     * so we need to flatten them out using a dot . notation
     * we also need to prepend config value to obtain
     *
     * 'config.target.connection': 'SBLIWS'
     */
    if (
        doc.job &&
        doc.job.params &&
        doc.job.params.pipeline &&
        doc.job.params.pipeline.passdown &&
        Array.isArray(doc.job.params.pipeline.passdown)
    ) {
        const passdownList: string[] = doc.job.params.pipeline.passdown;

        const passdownValues: any = {};

        passdownList.forEach((passdownItem: string) => {
            if (doc.job && doc.job.params && doc.job.params[passdownItem]) {
                passdownValues[passdownItem] = doc.job.params[passdownItem];
            }
        });

        const params: any = flatten__({ 'job.params': passdownValues }, '.');

        // const params: any = flatten__({ ...doc.job.params }, '.');
        set = { ...set, ...params };

        utils.logInfo(`$pipeline.start.handler (updateJobs): applying params - pl: ${id}`, doc.job.transid);
    }

    await DataModel.updateMany({ _id: { $in: Object.keys(jobs) } }, { $set: set }).exec();

    return Promise.resolve();
};

const publishPl: (doc: IJobModel, status: EJobStatusCodes, jobs: IJob[] | undefined) => Promise<void> = async (
    doc: IJobModel,
    status: EJobStatusCodes,
    jobs: IJob[] | undefined
): Promise<void> => {
    void pubSub.publish({
        count: null,
        email: doc.job.email,
        executor: doc.job.executor,
        id: doc._id.toString(),
        jobend: null,
        jobid: doc.job.jobid,
        jobstart: new Date(),
        jobs,
        name: doc.name,
        runby: doc.job.runby,
        runtime: null,
        status,
        transid: doc.job.transid,
        org: doc.project.org,
    });

    return Promise.resolve();
};

export const plStartHandler: (doc: IJobModel) => Promise<void> = async (doc: IJobModel): Promise<any> => {
    try {
        /**
         * If there are no jobs in this pipeline then just publish the Completed state
         */

        const plid: string = doc._id.toString();

        if (!doc.jobs || Object.keys(doc.jobs).length === 0) {
            utils.logInfo(
                `$pipeline.start.handler (plStartHandler): pipeline without jobs - pl: ${plid}`,
                doc.job.transid
            );

            await publishPl(doc, 'Completed', undefined);

            return Promise.resolve(true);
        }

        /**
         * Here we reset the queue we've added a field called queue
         * and we delete it here
         */
        // doc.set({ jobs: await resetQueue2(doc.jobs) });
        doc.jobs = await resetQueue(doc.jobs);

        // needed for mongo if you update nested fields
        doc.markModified('jobs');

        // set the status to submitted
        // doc.job.status = EJobStatus.running;  why ?

        await saveDoc(doc).catch(async (err) => {
            err.trace = addTrace(err.trace, '@at $pipeline.start.handler (plStartHandler) - save');

            return Promise.reject(err);
        });

        /**
         * Here we reset the queue and set the value of all to pending
         * It is also here that we need to pass any params send by the
         */
        await updateJobs(doc);

        const jobs: IJob[] = await findByFilter({ _id: { $in: Object.keys(doc.jobs) } }, { first: 0, rows: 0 });

        // set the pipeline to be running
        await publishPl(doc, doc.job.status, jobs);

        const batchJobs: string[] = await findRootJobs(doc.jobs, plid);

        utils.logInfo(
            `$pipeline.start.handler (plStartHandler): found ${batchJobs.length} jobs to run - pl: ${plid}`,
            doc.job.transid
        );

        for (const batchid of batchJobs) {
            /* The slack message will be handled in the job.type.handler */

            const batch_doc: IJobModel = await findOne(batchid);

            if (([EJobStatus.running, EJobStatus.submitted] as EJobStatusCodes[]).includes(batch_doc.job.status)) {
                utils.logInfo(
                    `$pipeline.start.handler (plStartHandler): already running - pl: ${plid} - pl status: ${batch_doc.job.status}`,
                    doc.job.transid
                );
            } else {
                batch_doc.job.email = doc.job.email;
                batch_doc.job.executor = doc.job.executor;
                batch_doc.job.jobstart = doc.job.jobstart;
                batch_doc.job.status = EJobStatus.submitted;
                batch_doc.job.transid = doc.job.transid;
                batch_doc.job.jobid = plid;
                batch_doc.job.runby = doc.job.runby || 'pipeline';
                void jobStartHandler(batch_doc).catch(async (err) => {
                    err.trace = addTrace(err.trace, '@at $pipeline.start.handler (plStartHandler)');

                    return Promise.reject(err);
                });
            }
        }

        return Promise.resolve();
    } catch (err) {
        err.trace = addTrace(err.trace, '@at $pipeline.start.handler (plStartHandler)');

        return Promise.reject(err);
    }
};
