import moment, { Moment } from 'moment';
import { IJobDetails, IJobDetail, IJobModel, DataModel } from '@models';
import { addTrace } from '@functions';

export const getGantt: (pldoc: IJobModel) => Promise<string> = async (pldoc: IJobModel): Promise<string> => {
    const jobs: IJobDetails = pldoc.jobs;

    let gantt: string = `gantt
    title TEST ${pldoc.name}
    dateFormat  YYYY-MM-DD HH:mm:ss
    axisFormat  %H:%M:%S\n`;

    const nodes: string[] = [];

    Object.entries(jobs).forEach(([key]: [string, IJobDetail]) => {
        nodes.push(key);
    });

    const dbjobs: IJobModel[] = await DataModel.find({ _id: { $in: nodes } }, {})
        .sort({ name: 1 })
        .exec()
        .catch(async (err: any) => {
            err.trace = addTrace(err.trace, '@at $job.detail (getDBJobs) - findByFilter');

            return Promise.reject(err);
        });

    dbjobs.forEach((doc: IJobModel) => {
        const runtime: number = doc.job.runtime || 1;
        const m: Moment = moment(doc.job.jobstart);
        const starttime: string = m.format('YYYY-MM-DD HH:mm:ss');
        const jobname = doc.name.replace(':', '');

        gantt += `${jobname}  :${starttime}, ${runtime}sec\n`;
    });

    return Promise.resolve(gantt);
};
