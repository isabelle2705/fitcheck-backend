import { config } from '../config.js';

const BASE_URL = 'https://api.higgsfield.ai/v1';

function isMockMode(): boolean {
  return config.mockMode || !config.higgsfield.apiKey;
}

function authHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.higgsfield.apiKey}`,
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Soul ID ──────────────────────────────────────────────────────────────────

export async function createSoulId(imageUrls: string[]): Promise<{ soul_id: string }> {
  if (isMockMode()) {
    console.log('[higgsfield:mock] createSoulId called with', imageUrls.length, 'images');
    await sleep(300);
    return { soul_id: `mock-soul-${Date.now()}` };
  }

  const response = await fetch(`${BASE_URL}/soul-id`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ image_urls: imageUrls }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Higgsfield createSoulId failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as { soul_id: string };
  return { soul_id: data.soul_id };
}

// ─── Outfit Shot ──────────────────────────────────────────────────────────────

export async function generateOutfitShot(
  soulId: string,
  garmentImageUrls: string[],
  pose?: string
): Promise<{ job_id: string }> {
  if (isMockMode()) {
    console.log('[higgsfield:mock] generateOutfitShot soul_id=%s garments=%d', soulId, garmentImageUrls.length);
    await sleep(300);
    return { job_id: `mock-job-${Date.now()}` };
  }

  const body: Record<string, unknown> = {
    soul_id: soulId,
    garment_image_urls: garmentImageUrls,
  };
  if (pose) body['pose'] = pose;

  const response = await fetch(`${BASE_URL}/outfit-shot`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Higgsfield generateOutfitShot failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as { job_id: string };
  return { job_id: data.job_id };
}

// ─── Poll Job ─────────────────────────────────────────────────────────────────

export async function pollJob(
  jobId: string
): Promise<{ status: string; result_url?: string }> {
  if (isMockMode()) {
    // After a random short delay, pretend the job is done
    const elapsed = parseInt(jobId.split('-').pop() ?? '0', 10);
    const age = Date.now() - elapsed;
    if (age < 5000) {
      return { status: 'processing' };
    }
    return {
      status: 'completed',
      result_url: `https://mock.fitcheck.dev/results/${jobId}.jpg`,
    };
  }

  const response = await fetch(`${BASE_URL}/jobs/${jobId}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Higgsfield pollJob failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as { status: string; result_url?: string };
  return { status: data.status, result_url: data.result_url };
}
