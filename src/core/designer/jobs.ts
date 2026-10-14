export type JobKind = 'sweep' | 'walk_forward';
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface DesignerJob {
  id: string;
  kind: JobKind;
  name: string;
  status: JobStatus;
  createdAt: number;
  updatedAt: number;
  jobId: string | null;
  params: Record<string, unknown>;
  result: unknown | null;
  error: string | null;
}

export interface JobStorage {
  load(): DesignerJob[];
  save(jobs: DesignerJob[]): void;
}

export function memoryStorage(initial: DesignerJob[] = []): JobStorage {
  let jobs = [...initial];
  return {
    load: () => [...jobs],
    save: (next) => {
      jobs = [...next];
    },
  };
}

export function localJobStorage(key: string): JobStorage {
  return {
    load: () => {
      try {
        if (typeof localStorage === 'undefined') return [];
        const raw = localStorage.getItem(key);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as unknown;
        return Array.isArray(parsed) ? (parsed as DesignerJob[]) : [];
      } catch {
        return [];
      }
    },
    save: (jobs) => {
      try {
        if (typeof localStorage === 'undefined') return;
        localStorage.setItem(key, JSON.stringify(jobs));
      } catch {
        /* persistence is best-effort */
      }
    },
  };
}

export const TERMINAL_JOB_STATUSES: ReadonlyArray<JobStatus> = ['completed', 'failed'] as const;

export function isTerminal(status: JobStatus): boolean {
  return status === 'completed' || status === 'failed';
}

export function upsertJobs(jobs: DesignerJob[], job: DesignerJob): DesignerJob[] {
  const index = jobs.findIndex((entry) => entry.id === job.id);
  if (index < 0) return [job, ...jobs];
  return jobs.map((entry) => (entry.id === job.id ? job : entry));
}

export function nextJobState(job: DesignerJob, patch: Partial<DesignerJob>, clock: () => number = Date.now): DesignerJob {
  return { ...job, ...patch, updatedAt: clock() };
}

export function makeJob(
  kind: JobKind,
  name: string,
  params: Record<string, unknown>,
  clock: () => number = Date.now,
  random: () => number = Math.random,
): DesignerJob {
  const now = clock();
  const id = `job-${now.toString(36)}-${Math.floor(random() * 1e6).toString(36)}`;
  return { id, kind, name, status: 'queued', createdAt: now, updatedAt: now, jobId: null, params, result: null, error: null };
}
