import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';

const router = Router();
const securityTxtPath = path.join(__dirname, '../../public/.well-known/security.txt');

router.get('/.well-known/security.txt', async (req: Request, res: Response): Promise<void> => {
  try {
    const content = await fs.readFile(securityTxtPath, 'utf-8');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.status(200).send(content);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      res.status(404).json({ success: false, error: 'security.txt not found' });
    } else {
      res.status(500).json({ success: false, error: 'Failed to read security.txt' });
    }
  }
});

export default router;
