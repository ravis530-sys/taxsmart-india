import { Router, Request, Response, NextFunction } from 'express';
import multer, { FileFilterCallback } from 'multer';
import { parseForm16 } from '../utils/form16Parser';

const router = Router();

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',                                                        // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',   // .docx
]);

// Memory storage — file never touches disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB max
    files: 1,
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and Word (.doc/.docx) files are accepted'));
    }
  },
});

/**
 * POST /api/parse-form16
 * Multipart body: field "form16" → PDF or DOC/DOCX file
 * Returns: Form16Data JSON
 */
router.post(
  '/',
  upload.single('form16'),
  async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file uploaded. Send the file in the "form16" field.' });
      return;
    }

    try {
      const data = await parseForm16(req.file.buffer, req.file.mimetype);
      res.json({ success: true, data });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown parse error';
      console.error('Form 16 parse error:', message);
      res.status(422).json({
        success: false,
        error: 'Could not extract data from the document. Please fill in the fields manually.',
      });
    }
  },
);

// Handle multer errors (file too large, wrong type)
router.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err.message?.includes('File too large')) {
    res.status(413).json({ success: false, error: 'File exceeds the 10 MB limit.' });
    return;
  }
  res.status(400).json({ success: false, error: err.message || 'Upload error' });
});

export default router;
