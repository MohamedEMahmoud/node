const { CronJob } = require('cron');

class CronManager {
    constructor() {
        this._jobs = {};
    }

    add(id, periodText, fn) {
        this._jobs[id] = {
            id,
            cron: new CronJob(periodText, fn, null, true)
        };
    }

    stop(id) {
        return this._jobs[id].cron.stop();
    }

    delete(id) {
        this.stop(id);
        delete this._jobs[id];
    }

    stopAll() {
        for (let cron in this._jobs) 
        {
            let activeCron = this._jobs[cron].cron.running;

            if (activeCron.running) 
            {
                activeCron.stop();
            }
        }
    }

    job(id) {
        return this._jobs[id];
    }

    list() {
        return this._jobs;
    }

    running(id) {
        return this._jobs[id].cron.running;
    }

    lastDate(id) {
        return this._jobs[id].cron.lastDate();
    }

    nextDates(id) {
        return this._jobs[id].cron.nextDates();
    }
}

module.exports = new CronManager()