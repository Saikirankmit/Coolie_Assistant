import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { createClient } from '@supabase/supabase-js';
import { getEmbeddings, EXPECTED_DIM } from './embeddingsAdapter';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.warn('OPENAI_API_KEY not configured - PDF embeddings will not work');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export async function processPDFDocument(pdfBuffer: Buffer, userId: string, fileName: string) {
  try {
    // Create a temporary file from buffer
    const tempPath = path.join(os.tmpdir(), `${Date.now()}-${fileName}`);
    await fs.writeFile(tempPath, pdfBuffer);

    // Load PDF
    const loader = new PDFLoader(tempPath);
    const docs = await loader.load();

    // Process each page
    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      const pageContent = doc.pageContent;
      const metadata = {
        ...doc.metadata,
        fileName,
        pageNumber: i + 1
      };

  // Generate embedding using adapter
  const embs = await getEmbeddings([pageContent]);
  const embedding = embs[0];

      // Store in Supabase
      await supabase.from('document_embeddings').insert({
        user_id: userId,
        file_name: fileName,
        content: pageContent,
        page_number: i + 1,
        embedding,
        metadata
      });
    }

    // Cleanup temp file
    await fs.unlink(tempPath);

    return { 
      success: true, 
      pageCount: docs.length,
      message: `Successfully processed ${docs.length} pages from ${fileName}`
    };
  } catch (error: any) {
    console.error('PDF processing error:', error);
    throw new Error(`Failed to process PDF: ${error.message}`);
  }
}

export async function queryDocument(userId: string, query: string, webhookUrl?: string) {
  try {
  // Generate embedding for the query
  const [queryEmbedding] = await getEmbeddings([query]);

    // Search for similar content with lower similarity threshold
    const { data: matches, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_count: 5,
      match_threshold: 0.5  // Lower threshold to catch more matches
    });

    if (error) throw error;

    // Format the response
    const results = matches.map((match: any) => ({
      content: match.content,
      metadata: match.metadata,
      similarity: match.similarity
    }));

    // If webhook URL is provided, send results to n8n
    if (webhookUrl) {
      try {
        const payload = {
          userId,
          userQuery: query,
          type: 'pdf_query',
          matches: results
        };

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          console.warn('Failed to forward PDF query results to webhook:', response.status);
        }
      } catch (webhookError) {
        console.error('Error forwarding to webhook:', webhookError);
      }
    }

    return results;
  } catch (error: any) {
    console.error('Document query error:', error);
    throw new Error(`Failed to query documents: ${error.message}`);
  }
}