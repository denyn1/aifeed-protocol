'use strict';

const { randomUUID } = require('node:crypto');

const MAX_JOBS = 50;

function createJobManager() {
  const jobs = new Map();
  const subscribers = new Map();

  function start(name, runner) {
    const id = randomUUID();
    const job = {
      id,
      name,
      status: 'running',
      events: [],
      result: null,
      error: null,
      started_at: new Date().toISOString(),
      ended_at: null
    };
    jobs.set(id, job);
    subscribers.set(id, new Set());
    if (jobs.size > MAX_JOBS) {
      const oldest = [...jobs.keys()].slice(0, jobs.size - MAX_JOBS);
      for (const key of oldest) {
        jobs.delete(key);
        subscribers.delete(key);
      }
    }

    const emit = (event) => {
      const record = { ...event, at: new Date().toISOString() };
      job.events.push(record);
      for (const listener of subscribers.get(id) || []) {
        try {
          listener(record);
        } catch (error) {
          // a broken listener must not kill the job
        }
      }
    };

    Promise.resolve()
      .then(() => runner(emit))
      .then((result) => {
        job.result = result;
        job.status = 'done';
        job.ended_at = new Date().toISOString();
        emit({ type: 'done', result });
      })
      .catch((error) => {
        job.error = error && error.message ? error.message : String(error);
        job.status = 'error';
        job.ended_at = new Date().toISOString();
        emit({ type: 'error', message: job.error });
      });

    return id;
  }

  function get(id) {
    return jobs.get(id) || null;
  }

  function subscribe(id, listener) {
    const job = jobs.get(id);
    if (!job) return null;
    for (const event of job.events) listener(event);
    if (job.status !== 'running') return () => {};
    const set = subscribers.get(id);
    set.add(listener);
    return () => set.delete(listener);
  }

  return { start, get, subscribe };
}

module.exports = { createJobManager };
