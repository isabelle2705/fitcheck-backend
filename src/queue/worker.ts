import { Worker, Job } from 'bullmq';
import { connection, publishStatus } from './queue.js';
import type { TryonJob } from '../agents/types.js';
import { pollJob } from '../services/higgsfield.js';
import { updateGeneration } from '../models/generation.js';

const POLL_INTERVAL_MS = 3_000;
const SLA_MS = 90_000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll Higgsfield until the job completes, fails, or we hit the SLA.
 * Returns the final status and optional result URL.
 */
async function pollUntilDone(
  higgsfieldJobId: string,
  sessionId: string,
  generationId: string
): Promise<{ status: 'completed' | 'failed'; result_url?: string }> {
  const deadline = Date.now() + SLA_MS;

  while (Date.now() < deadline) {
    const { status, result_url } = await pollJob(higgsfieldJobId);

    if (status === 'completed') {
      await updateGeneration(generationId, { status: 'completed', resultUrl: result_url });
      await publishStatus(sessionId, {
        type: 'job_complete',
        job_id: generationId,
        composite_url: result_url,
        timestamp: new Date().toISOString(),
      });
      return { status: 'completed', result_url };
    }

    if (status === 'failed') {
      await updateGeneration(generationId, { status: 'failed' });
      await publishStatus(sessionId, {
        type: 'job_failed',
        job_id: generationId,
        error: 'Higgsfield reported failure',
        timestamp: new Date().toISOString(),
      });
      return { status: 'failed' };
    }

    // Still processing — update WS and wait
    await publishStatus(sessionId, {
      type: 'stage_update',
      stage: 'generating',
      higgsfield_status: status,
      timestamp: new Date().toISOString(),
    });

    await sleep(POLL_INTERVAL_MS);
  }

  // Timed out
  await updateGeneration(generationId, { status: 'failed' });
  await publishStatus(sessionId, {
    type: 'job_failed',
    job_id: generationId,
    error: 'Generation timed out',
    timestamp: new Date().toISOString(),
  });
  return { status: 'failed' };
}

/**
 * Legacy mock path — used when job has no higgsfield_job_id (e.g. old /tryon route).
 */
async function runMockStages(
  jobId: string,
  sessionId: string
): Promise<{ composite_url: string; score: number }> {
  const stages = [
    { name: 'analyzing_person', eta_ms: 5000 },
    { name: 'analyzing_garments', eta_ms: 8000 },
    { name: 'composing_tryon', eta_ms: 25000 },
    { name: 'scoring_result', eta_ms: 5000 },
  ];

  for (const stage of stages) {
    await publishStatus(sessionId, {
      type: 'stage_update',
      stage: stage.name,
      eta_ms: stage.eta_ms,
      timestamp: new Date().toISOString(),
    });
    await sleep(500);
    await publishStatus(sessionId, {
      type: 'stage_complete',
      stage: stage.name,
      timestamp: new Date().toISOString(),
    });
  }

  const composite_url = `https://mock.fitcheck.dev/results/${jobId}.jpg`;
  const score = 0.87;

  await publishStatus(sessionId, {
    type: 'job_complete',
    job_id: jobId,
    composite_url,
    score,
    timestamp: new Date().toISOString(),
  });

  return { composite_url, score };
}

export function startWorker(): Worker<TryonJob> {
  const worker = new Worker<TryonJob>(
    'tryon',
    async (job: Job<TryonJob>) => {
      const { id, higgsfield_job_id } = job.data;
      const sessionId = job.name;

      console.log(`[worker] processing generation ${id} for session ${sessionId}`);

      await publishStatus(sessionId, {
        type: 'job_started',
        job_id: id,
        timestamp: new Date().toISOString(),
      });

      // ── Real Higgsfield path ───────────────────────────────────────────────
      if (higgsfield_job_id) {
        console.log(`[worker] polling Higgsfield job ${higgsfield_job_id}`);
        const { status, result_url } = await pollUntilDone(higgsfield_job_id, sessionId, id);
        return { status, composite_url: result_url };
      }

      // ── Legacy mock path ──────────────────────────────────────────────────
      console.log(`[worker] running mock stages for job ${id}`);
      const { composite_url, score } = await runMockStages(id, sessionId);
      return { status: 'done', composite_url, score };
    },
    {
      connection,
      concurrency: 3,
    }
  );

  worker.on('completed', (job) => {
    console.log(`[worker] job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[worker] job ${job?.id} failed:`, err.message);
    if (job) {
      const genId = job.data.id;
      updateGeneration(genId, { status: 'failed' }).catch(console.error);
      publishStatus(job.name, {
        type: 'job_failed',
        job_id: job.id,
        error: err.message,
        timestamp: new Date().toISOString(),
      }).catch(console.error);
    }
  });

  return worker;
}
