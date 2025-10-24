import { getEmbeddings } from '../server/embeddingsAdapter';

(async () => {
  try {
    const res = await getEmbeddings(['hello world']);
    console.log('Got embeddings length:', res?.[0]?.length);
  } catch (e) {
    console.error('Test embeddings failed:', e);
  }
})();
