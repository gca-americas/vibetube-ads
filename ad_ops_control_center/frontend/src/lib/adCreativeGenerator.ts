/**
 * Generative AI Ad Creative Engine (Vertex AI on Google Cloud via ADC)
 * 
 * Invokes Google Cloud Vertex AI (gemini-2.5-flash & gemini-2.5-flash-image)
 * dynamically on-the-fly for ANY arbitrary user prompt using Application Default Credentials.
 */

export interface GeneratedAdCreative {
  title: string;
  tagline: string;
  category: 'gaming' | 'fashion' | 'tech';
  imageUrl: string;
  seed: number;
}

export async function generateAdImageFromPrompt(prompt: string, seed: number = Date.now()): Promise<GeneratedAdCreative> {
  const res = await fetch('/campaign/generate-creative', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  if (!res.ok) {
    throw new Error(`Creative generation failed: Ad server returned status ${res.status}`);
  }

  const data = await res.json();
  if (!data.image_data) {
    throw new Error('Creative generation returned no image data from Vertex AI.');
  }

  return {
    title: data.title || 'Apex Innovation',
    tagline: data.banner || 'Engineered for the next generation of performance.',
    category: (data.category as 'gaming' | 'fashion' | 'tech') || 'tech',
    imageUrl: data.image_data,
    seed,
  };
}

