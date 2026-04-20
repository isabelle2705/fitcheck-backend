import { Worker } from 'bullmq';
import { config } from '../config.js';
import { connection, tryonQueue, publishStatus } from './queue.js';
import type { TryonJob } from '../agents/types.js';

const SLA_MS = 90_000;

export function startWorker(): Worker<TryonJob> {
  const worker = new Worker<TryonJob>(
    'tryon',
    async (job: Job<TryonJob>) => {
      const { id, person_asset_id, garment_asset_ids } = job.data;
      const sessionId = job.name;

      const start = Date.now();
      console.log(`[worker] processing job ${id} for session ${sessionId}`);
      console.log(`[worker] person_asset_id=${person_asset_id}`);
      console.log(`[worker] garment_asset_ids=${JSON.stringify(garment_asset_ids)}`);

      await publishStatus(sessionId, {
        type: 'job_started',
        job_id: id,
        timestamp: new Date().toISOString(),
      });

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
        await new Promise((r) => setTimeout(r, 500));
        await publishStatus(sessionId, {
          type: 'stage_complete',
          stage: stage.name,
          timestamp: new Date().toISOString(),
        });
      }

      const elapsed = Date.now() - start;
      console.log(`[worker] job ${id} completed in ${elapsed}ms`);

      await publishStatus(sessionId, {
        type: 'job_complete',
        job_id: id,
        composite_url: `https://mock.fitcheck.dev/results/${id}.jpg`,
        score: 0.87,
        timestamp: new Date().toISOString(),
      });

      return { status: 'done', composite_url: `https://mock.fitcheck.dev/results/${id}.jpg`, score: 0.87 };
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
