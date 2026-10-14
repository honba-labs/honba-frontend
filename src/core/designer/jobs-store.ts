import { create } from 'zustand';

import {
  isTerminal,
  localJobStorage,
  makeJob,
  memoryStorage,
  nextJobState,
  upsertJobs,
  type DesignerJob,
  type JobKind,
  type JobStorage,
} from './jobs';

const STORAGE_KEY = 'honba_designer_jobs_v1';

interface JobsState {
  jobs: DesignerJob[];
  storage: JobStorage;
  useStorage: (storage: JobStorage) => void;
  refresh: () => void;
  enqueue: (kind: JobKind, name: string, params: Record<string, unknown>) => DesignerJob;
  markRunning: (id: string, jobId?: string) => void;
  complete: (id: string, result: unknown) => void;
  fail: (id: string, error: string) => void;
  remove: (id: string) => void;
  pending: () => DesignerJob[];
}

function persist(storage: JobStorage, jobs: DesignerJob[]): void {
  storage.save(jobs);
}

function defaultStorage(): JobStorage {
  try {
    if (typeof localStorage !== 'undefined') return localJobStorage(STORAGE_KEY);
  } catch {
    /* fall through to memory */
  }
  return memoryStorage();
}

export const useJobsStore = create<JobsState>((set, get) => {
  const storage = defaultStorage();
  return {
    jobs: storage.load(),
    storage,

    useStorage: (next) => set({ storage: next, jobs: next.load() }),

    refresh: () => set({ jobs: get().storage.load() }),

    enqueue: (kind, name, params) => {
      const job = makeJob(kind, name, params);
      const jobs = upsertJobs(get().jobs, job);
      persist(get().storage, jobs);
      set({ jobs });
      return job;
    },

    markRunning: (id, jobId) => {
      const jobs = get().jobs.map((job) =>
        job.id === id ? nextJobState(job, { status: 'running', ...(jobId ? { jobId } : {}) }) : job,
      );
      persist(get().storage, jobs);
      set({ jobs });
    },

    complete: (id, result) => {
      const jobs = get().jobs.map((job) =>
        job.id === id ? nextJobState(job, { status: 'completed', result }) : job,
      );
      persist(get().storage, jobs);
      set({ jobs });
    },

    fail: (id, error) => {
      const jobs = get().jobs.map((job) =>
        job.id === id ? nextJobState(job, { status: 'failed', error }) : job,
      );
      persist(get().storage, jobs);
      set({ jobs });
    },

    remove: (id) => {
      const jobs = get().jobs.filter((job) => job.id !== id);
      persist(get().storage, jobs);
      set({ jobs });
    },

    pending: () => get().jobs.filter((job) => !isTerminal(job.status)),
  };
});
