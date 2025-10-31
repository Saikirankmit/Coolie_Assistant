import express from 'express';
import { handleWebsiteRequest } from '../geminiWebsite';

const router = express.Router();

router.post('/open', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({
        status: 'error',
        error: 'No query provided'
      });
    }

    const result = await handleWebsiteRequest(query);
    return res.json(result);
  } catch (error) {
    console.error('Website open error:', error);
    return res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
});

export default router;