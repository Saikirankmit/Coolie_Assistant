const MODELS = ['text-embedding-004', 'embedding-001', 'gemini-embedding-001', 'textembedding-gecko-001'];
const ENDPOINT_SUFFIXES = [':embedText', ':embed', ':embedContent'];

async function tryCall(url: string, body: any) {
  try {
    const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const text = await resp.text();
    return { ok: resp.ok, status: resp.status, text };
  } catch (err) {
    return { ok: false, status: null, text: String(err) };
  }
}

async function main() {
  const API_KEY = process.env.GOOGLE_AI_API_KEY;
  if (!API_KEY) {
    console.error('Set GOOGLE_AI_API_KEY in environment');
    process.exit(2);
  }

  for (const model of MODELS) {
    for (const suffix of ENDPOINT_SUFFIXES) {
      const url = `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}${suffix}?key=${encodeURIComponent(API_KEY)}`;
      console.log('Trying', url);
      const body = { input: ['hello world'] };
      const r = await tryCall(url, body);
      console.log('->', r.status, r.ok, r.text.slice(0, 1000));
      if (r.ok) {
        try {
          const j = JSON.parse(r.text);
          if (j?.data) {
            console.log('SUCCESS model', model, 'suffix', suffix, 'embedding len', j.data[0]?.embedding?.length);
            return;
          }
        } catch (e) {
          console.log('OK response but could not parse JSON');
        }
      }
    }
  }
  console.error('No working combination found');
}

main();
