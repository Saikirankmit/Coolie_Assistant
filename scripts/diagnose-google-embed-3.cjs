const fs = require('fs');

function readEnv() {
  const env = {};
  try {
    const s = fs.readFileSync('.env', 'utf8');
    for (const line of s.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m) {
        let v = m[2];
        if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1,-1);
        if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1,-1);
        env[m[1]] = v;
      }
    }
  } catch (e) {
    // ignore
  }
  return env;
}

(async () => {
  const env = readEnv();
  const key = process.env.GOOGLE_AI_API_KEY || env.GOOGLE_AI_API_KEY;
  if (!key) {
    console.error('No GOOGLE_AI_API_KEY found in env or .env');
    process.exit(1);
  }

  const apiVersions = ['v1', 'v1beta2', 'v1beta1', 'v1beta3'];
  const candidates = [
    'text-embedding-004',
    'embedding-001',
    'gemini-embedding-001',
    'textembedding-gecko-001',
    'text-embedding-001'
  ];
  const prefixes = ['', 'models/'];
  const endpoints = [':embedText', ':embed', ':embedContent', ':embedText?format=text'];

  const bodies = [
    { text: 'hello world' },
    { input: 'hello world' },
    { instances: ['hello world'] },
    { inputs: ['hello world'] },
    { content: 'hello world' },
    { content: ['hello world'] },
    { items: [{ text: 'hello world' }] },
    { inputs: [{ text: 'hello world' }] },
  ];

  const authModes = ['key', 'bearer'];

  let found = null;

  for (const version of apiVersions) {
    for (const prefix of prefixes) {
      for (const model of candidates) {
        for (const endpoint of endpoints) {
          for (const body of bodies) {
            for (const authMode of authModes) {
              const url = `https://generativelanguage.googleapis.com/${version}/models/${prefix}${model}${endpoint}` + (authMode === 'key' ? `?key=${key}` : '');
              const headers = { 'Content-Type': 'application/json' };
              if (authMode === 'bearer') headers['Authorization'] = `Bearer ${key}`;
              try {
                const res = await fetch(url, {
                  method: 'POST',
                  headers,
                  body: JSON.stringify(body),
                });
                const text = await res.text().catch(() => '<no body>');
                let parsed;
                try { parsed = JSON.parse(text); } catch (e) { parsed = text; }
                console.log(`Trying ${url} auth=${authMode} bodyKeys=${Object.keys(body).join(',')}`);
                console.log(`-> ${res.status} ok=${res.ok} body=${typeof parsed === 'object' ? JSON.stringify(parsed).slice(0,800) : parsed}`);

                if (res.ok) {
                  found = { version, prefix, model, endpoint, authMode, body, parsed };
                  console.log('\nFOUND WORKING COMBINATION:\n', found);
                  process.exit(0);
                }

                // also check for a possible embedding-like response (array, vectors)
                if (typeof parsed === 'object' && parsed) {
                  const maybeVectors = parsed['embeddings'] || parsed['embedding'] || parsed['data'] || parsed['outputs'];
                  if (maybeVectors) {
                    console.log('-> Received embedding-like field, treating as success');
                    found = { version, prefix, model, endpoint, authMode, body, parsed };
                    console.log('\nFOUND WORKING COMBINATION:\n', found);
                    process.exit(0);
                  }
                }

              } catch (e) {
                console.log(`Trying ${url} auth=${authMode} bodyKeys=${Object.keys(body).join(',')}`);
                console.log('-> error', e && e.message ? e.message : e);
              }
              await new Promise(r => setTimeout(r, 200));
            }
          }
        }
      }
    }
  }

  console.log('No working embedding combination found with heuristic tests.');
})();
