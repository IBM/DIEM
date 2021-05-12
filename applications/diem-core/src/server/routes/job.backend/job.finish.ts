import { utils } from '@common/utils';
import { IError } from '@interfaces';
import { IModel, IJob, ExecutorTypes } from '@models';
import { addTrace } from '@functions';
import { deleteJob } from '../executors/spark/spark.job';
import { jobLogger } from '../job.logger/job.logger';
import { sparkWatcher } from '../spark-operator/spark.watcher';

export const getPySparkJobLog: (doc: IModel) => Promise<IModel> = async (doc: IModel): Promise<IModel> => {
    const id: string = doc._id.toString();

    const sparkLog: string | undefined = await sparkWatcher.getJobLog(id).catch(() => {
        // nothing
    });

    if (sparkLog) {
        doc.job.error = `${doc.job.error}\n\n*** Attaching Spark Log***\n\n${sparkLog}`;
    }

    return Promise.resolve(doc);
};

export const finishJob: (doc: IModel) => Promise<any> = async (doc: IModel): Promise<any> => {
    const id: string = doc._id.toString();

    if (doc.job.executor === ExecutorTypes.pyspark) {
        await deleteJob(id).catch((err: IError) => {
            err.trace = addTrace(err.trace, '@at $job.finish (finishJob)');
        });
    }

    if (!doc.job.jobend) {
        doc.job.jobend = new Date();
    }

    if (doc.job.jobstart) {
        // a zero never displays as equal to false.. so the minimum is one second
        const runtime: number = Math.round(Math.abs(doc.job.jobend.getTime() - doc.job.jobstart.getTime()) / 1000) || 1;
        doc.job.runtime = runtime === 0 ? 1 : runtime;
    }

    const log: IJob = {
        ...doc.toObject().job,
        count: doc.job.count ? Number(doc.job.count) : 0,
        name: doc.name,
    };

    // don't archive the audit trail in the log
    // we only keep it in the archiving
    delete log.audit;

    if (Array.isArray(doc.log)) {
        if (doc.log.length > 9) {
            doc.log.pop();
        }
        doc.log.unshift(log);
    } else {
        doc.log = [log];
    }

    await jobLogger(doc).catch(async (err: any) => {
        err.trace = addTrace(err.trace, '@at $job.finish (jobStop)');

        // we just log the error here
        void utils.logError('$job.start.handler (saveDoc): error', err);
    });

    return Promise.resolve();
};
