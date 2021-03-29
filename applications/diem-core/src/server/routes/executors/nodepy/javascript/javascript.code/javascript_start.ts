import { sparkCredentials } from '../../../../spark-operator/spark.base';
import { IETLJob } from '@models';

// ideal is to make this an env variable as it's the same path as spark in spark operator uses
const filepath: string = '/tmp/spark-local-dir';

export const javascript_start: (job: IETLJob) => string = (job: IETLJob): string => {
    const callback_url: string = sparkCredentials.callback_url;

    return String.raw`
/* javascript_start */

/*jshint esversion: 6 */

const axios = require('axios');
const moment = require('moment');

const mq = (data) => {
    data.id =  config.__id;
    data.jobid =  config.__jobid;
    data.transid =  config.__transid;
    data.email =  config.__email;
    data.name =  config.__name;

    if (data.out  && typeof data.out !== 'string') {
        try {
            data.out = JSON.stringify(data.out, undefined, 2)
        } catch (err) {
            /* nothing */
        }
    }
    axios.post(config.__url, data);
};

const out = (data) => {
    mq({ out: data });
};

const error = (err) => {
    now = time.strftime("%Y-%m-%d %H:%M:%S")

    data = {
        email: config.__email,
        error: err.toString(),
        id: config.__id,
        jobid: config.__jobid,
        jobend: now,
        name: config.__name,
        status: "Failed",
        out: __\`Job {config.__id} failed - time: {UtcNow()} - runtime: {(TimeNow() - config.__starttime).toFixed(3)} ms__\`
    };

    mq(data);
    process.exit();
};

const UtcNow = () => {
    return moment.utc(new Date(), 'YYYY-MM-DD HH:mm:ss')
}

const TimeNow = () => {
    return new Date().getTime() / 1000
}

const config = {
    __url : '${callback_url}',
    __id : '${job.id}',
    __email : '${job.email}',
    __jobid : '${job.jobid}',
    __name : '${job.name}',
    __filepath : '${filepath}',
    __transid : '${job.transid}',
    __org : '${job.org}',
    __count : 0,
    __starttime : new Date().getTime() / 1000,
    __jobstart : new Date()
}

msg = __\`Job __\${config.__id} started - email: __\${config.__email} - time: __\${UtcNow()}__\`

data = {
    jobstart: config.__jobstart,
    status: "Running",
    out: msg,
}
mq(data)

console.log = function() {}

/* ###### */`;
};
