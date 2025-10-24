import { config } from 'dotenv';
import { getEmbeddings, EXPECTED_DIM } from '../server/embeddingsAdapter';

// Load environment variables from .env file
config();

async function testEmbeddings() {
  try {
    console.log('Testing Cohere embeddings...');
    const vectors = await getEmbeddings(['Hello world']);
    console.log(`Success! Got ${vectors.length} embeddings of dimension ${vectors[0].length}`);
    console.log('First few values:', vectors[0].slice(0, 5));
  } catch (err) {
    console.error('Test embeddings failed:', err);
  }
}

testEmbeddings();