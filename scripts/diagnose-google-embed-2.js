const fs = require('fs');
const fetch = require('node-fetch');

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

  const candidates = [
    'text-embedding-004',
    'embedding-001',
    'gemini-embedding-001',
    'textembedding-gecko-001',
    'text-embedding-001'
  ];
  const prefixes = ['', 'models/'];
  const endpoints = [':embedText', ':embed', ':embedContent'];

  const bodies = [
    { input: 'hello world' },
    { instances: ['hello world'] },
    { input: ['hello world'] },
    { text: 'hello world' },
    { content: ['hello world'] },
  ];

  for (const prefix of prefixes) {
    for (const model of candidates) {
      for (const endpoint of endpoints) {
        const url = `https://generativelanguage.googleapis.com/v1/models/${prefix}${model}${endpoint}?key=${key}`;
        for (const body of bodies) {
          try {
            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
              timeout: 15000,
            });
            let text;
            try { text = await res.text(); } catch (e) { text = '<no body>'; }
            let ok = res.ok;
            let parsed;
            try { parsed = JSON.parse(text); } catch(e) { parsed = text; }
            console.log(`Trying ${url}`);
            console.log(`-> ${res.status} ${ok} ${typeof parsed === 'object' ? JSON.stringify(parsed).slice(0,1000) : parsed}`);
          } catch (e) {
            console.log(`Trying ${url}`);
            console.log('-> error', e && e.message ? e.message : e);
          }
          await new Promise(r => setTimeout(r, 300));
        }
      }
    }
  }
  console.log('Done');
})();
