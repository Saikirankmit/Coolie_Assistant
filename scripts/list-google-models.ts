// Lists available Google generativelanguage models using GOOGLE_AI_API_KEY or service account
async function main() {
  try {
    const API_KEY = process.env.GOOGLE_AI_API_KEY;
    if (!API_KEY) {
      console.error('No GOOGLE_AI_API_KEY found in environment');
      process.exit(2);
    }
    const url = `https://generativelanguage.googleapis.com/v1/models?key=${encodeURIComponent(API_KEY)}`;
    console.log('Listing models via', url);
    const resp = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    const text = await resp.text();
    try {
      const json = JSON.parse(text);
      console.log(JSON.stringify(json, null, 2));
    } catch (e) {
      console.log('Raw response:', text);
    }
  } catch (err) {
    console.error('Failed to list models:', err);
    process.exit(1);
  }
}

main();
