/**
 * Generative AI Ad Creative Engine (Google Enterprise Agent Platform on Google Cloud via ADC)
 * 
 * Invokes Google Cloud Enterprise Agent Platform (gemini-3.5-flash-lite & gemini-3.1-flash-image)
 * dynamically on-the-fly for ANY arbitrary user prompt using Application Default Credentials.
 */

interface GeneratedAdCreative {
  title: string;
  tagline: string;
  category: 'gaming' | 'fashion' | 'tech';
  imageUrl: string;
}

export async function generateAdImageFromPrompt(prompt: string): Promise<GeneratedAdCreative> {
  const res = await fetch('/campaign/generate-creative', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(errText || `Creative generation failed (HTTP ${res.status})`);
  }

  const data = await res.json();
  if (!data.image_data) {
    throw new Error(data.error || 'No creative image was generated. Please try again.');
  }

  return {
    title: data.title || deriveTitleFromPrompt(prompt),
    tagline: data.banner || '',
    category: (data.category as 'gaming' | 'fashion' | 'tech') || 'tech',
    imageUrl: data.image_data,
  };
}

function deriveTitleFromPrompt(prompt: string): string {
  const p = prompt.trim();
  if (!p) return 'Ad Campaign';
  const words = p.split(/\s+/).slice(0, 4);
  return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

