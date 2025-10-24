import { OpenAIEmbeddings } from '@langchain/openai';

const EXPECTED_DIM = Number(process.env.EMBEDDING_DIM || 1024);  // Updated to match Cohere's dimension
const PROVIDER = (process.env.EMBEDDING_PROVIDER || 'cohere').toLowerCase();

let openaiEmbeddings: OpenAIEmbeddings | null = null;
if (PROVIDER === 'openai') {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    console.warn('OPENAI_API_KEY not configured but EMBEDDING_PROVIDER=openai');
  } else {
    openaiEmbeddings = new OpenAIEmbeddings({ openAIApiKey: OPENAI_API_KEY });
  }
}

/**
 * Get embeddings for an array of texts. Returns number[][] where each inner array is the embedding vector.
 * Supports provider 'openai' out of the box. To use Google Gemini (or other providers) implement the
 * provider branch below and ensure the resulting vector dimension matches your database vector column
 * (default 1536). If dims don't match, the adapter will throw with a helpful message.
 */
export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  if (!Array.isArray(texts) || texts.length === 0) return [];

  if (PROVIDER === 'openai') {
    if (!openaiEmbeddings) throw new Error('OpenAI embeddings not initialized. Set OPENAI_API_KEY.');
    const res = await openaiEmbeddings.embedDocuments(texts);
    // embedDocuments returns number[][]
    // Validate dims
    if (res.length > 0 && res[0].length !== EXPECTED_DIM) {
      throw new Error(`OpenAI embeddings dimension ${res[0].length} does not match expected ${EXPECTED_DIM}. Update EMBEDDING_DIM or your DB schema.`);
    }
    return res as number[][];
  }

  if (PROVIDER === 'google' || PROVIDER === 'gemini') {
    const API_KEY = process.env.GOOGLE_AI_API_KEY;
    const MODEL = process.env.GOOGLE_EMBEDDING_MODEL || process.env.GOOGLE_EMBEDDING_MODEL_NAME || 'textembedding-gecko-001';
    const hasServiceAccount = Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS);
    if (!API_KEY && !hasServiceAccount) throw new Error('No Google credentials found. Set GOOGLE_AI_API_KEY or provide a service account via GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS');

    try {
      let vectors: number[][] | null = null;

      // 1) Try SDK if available
      if (API_KEY || hasServiceAccount) {
        try {
          const { GoogleGenerativeAI } = await import('@google/generative-ai');
          const client = new GoogleGenerativeAI(API_KEY ?? '');
          try {
            if (typeof (client as any).getEmbeddings === 'function') {
              const resp = await (client as any).getEmbeddings({ model: MODEL, input: texts });
              vectors = resp?.data?.map((d: any) => d.embedding) ?? null;
            }
          } catch (e) {
            // ignore and try other SDK shapes
          }

          if (!vectors) {
            try {
              const model = (client as any).getEmbeddingModel ? (client as any).getEmbeddingModel({ model: MODEL }) : null;
              if (model && typeof model.embed === 'function') {
                const resp = await model.embed(texts);
                vectors = resp?.data?.map((d: any) => d.embedding) ?? null;
              }
            } catch (e) {
              // ignore
            }
          }
        } catch (sdkErr) {
          console.error('Google SDK embed attempt failed:', sdkErr);
        }
      }

      // 2) REST fallback
      if (!vectors) {
  const baseUrl = `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(MODEL)}:embedText`;
        const body = { input: texts };

        const getServiceAccountAccessToken = async (): Promise<string | null> => {
          try {
            let creds: any = null;
            if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
              try {
                creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
              } catch (e) {
                try {
                  const decoded = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_JSON, 'base64').toString('utf8');
                  creds = JSON.parse(decoded);
                } catch (e2) {
                  creds = null;
                }
              }
            } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
              try {
                const p = process.env.GOOGLE_APPLICATION_CREDENTIALS;
                const fs = await import('fs/promises');
                const txt = await fs.readFile(p, 'utf8');
                creds = JSON.parse(txt);
              } catch (e) {
                creds = null;
              }
            }

            if (!creds) return null;

            try {
              const { GoogleAuth } = await import('google-auth-library');
              const auth = new GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
              const client = await auth.getClient();
              const token = await client.getAccessToken();
              return typeof token === 'string' ? token : token?.token ?? null;
            } catch (e) {
              return null;
            }
          } catch (e) {
            return null;
          }
        };

        const fetchWithRetries = async (url: string, options: any, attempts = 3, timeoutMs = 10000) => {
          for (let i = 0; i < attempts; i++) {
            try {
              const controller = new AbortController();
              const id = setTimeout(() => controller.abort(), timeoutMs);
              const resp = await fetch(url, { ...options, signal: controller.signal });
              clearTimeout(id);
              if (!resp.ok) {
                const txt = await resp.text().catch(() => '');
                if (resp.status >= 500 && i < attempts - 1) {
                  console.warn(`fetch attempt ${i + 1} got ${resp.status}; retrying...`);
                  await new Promise((r) => setTimeout(r, 500 * Math.pow(2, i)));
                  continue;
                }
                throw new Error(`HTTP ${resp.status} ${txt}`);
              }
              const json = await resp.json();
              return json;
            } catch (err: any) {
              console.error(`fetchWithRetries attempt ${i + 1} failed:`, err);
              const isAbort = err?.name === 'AbortError';
              if (i === attempts - 1) throw err;
              await new Promise((r) => setTimeout(r, 500 * Math.pow(2, i)));
              if (isAbort) continue;
            }
          }
          throw new Error('fetchWithRetries exhausted');
        };

          try {
            const accessToken = await getServiceAccountAccessToken();
            if (accessToken) {
              console.log('Calling Google embeddings REST with service-account token; url=', baseUrl);
              try {
                const json = await fetchWithRetries(baseUrl, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                vectors = json?.data?.map((d: any) => d.embedding) ?? null;
              } catch (e) {
                console.error('Google embedding call with service-account failed:', e);
              }
            }

            if (!vectors && API_KEY) {
              console.log('Calling Google embeddings REST with API key as bearer; url=', baseUrl);
              try {
                const json = await fetchWithRetries(baseUrl, { method: 'POST', headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                vectors = json?.data?.map((d: any) => d.embedding) ?? null;
              } catch (e) {
                console.error('Google embedding call with API key as bearer failed:', e);
              }
            }

            if (!vectors && API_KEY) {
              const urlWithKey = `${baseUrl}?key=${encodeURIComponent(API_KEY)}`;
              console.log('Calling Google embeddings REST with API key as query param; url=', urlWithKey);
              const json2 = await fetchWithRetries(urlWithKey, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
              vectors = json2?.data?.map((d: any) => d.embedding) ?? null;
            }
        } catch (fetchErr: any) {
          throw new Error(`Google embedding REST call fetch failed: ${fetchErr?.message ?? String(fetchErr)}`);
        }
      }

      if (!vectors || !Array.isArray(vectors) || vectors.length === 0) throw new Error('Google embeddings returned no vectors');
      if (vectors[0].length !== EXPECTED_DIM) throw new Error(`Google embeddings dimension ${vectors[0].length} does not match expected ${EXPECTED_DIM}. Set EMBEDDING_DIM or use a model that returns ${EXPECTED_DIM}`);
      return vectors as number[][];
    } catch (err: any) {
      throw new Error(`Failed to produce Google embeddings: ${err?.message ?? String(err)}`);
    }
    }

  if (PROVIDER === 'cohere') {
    const API_KEY = process.env.COHERE_API_KEY;
    if (!API_KEY) throw new Error('COHERE_API_KEY not configured');

    try {
      const url = 'https://api.cohere.ai/v1/embed';
      const cleanedTexts = texts.map((t: string) => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          texts: cleanedTexts,
          model: 'embed-english-v3.0',  // This model outputs 1024-dim vectors
          input_type: 'search_document'
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Cohere API error: ${response.status} ${text}`);
      }

      const json = await response.json();
      const vectors = json.embeddings;

      if (!vectors || !Array.isArray(vectors) || vectors.length === 0) {
        throw new Error('Cohere returned no embeddings');
      }

      if (vectors[0].length !== EXPECTED_DIM) {
        throw new Error(`Cohere embeddings dimension ${vectors[0].length} does not match expected ${EXPECTED_DIM}`);
      }

      return vectors as number[][];
    } catch (err: any) {
      throw new Error(`Failed to get Cohere embeddings: ${err?.message ?? String(err)}`);
    }
  }

  throw new Error(`Unknown EMBEDDING_PROVIDER: ${PROVIDER}`);
}

export { EXPECTED_DIM };
