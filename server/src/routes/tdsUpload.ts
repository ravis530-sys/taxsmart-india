import { Router, Request, Response, NextFunction } from 'express';
import multer, { FileFilterCallback } from 'multer';
import { parseTDSFile } from '../utils/tdsParser';

const router = Router();

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel',                                           // .xls
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword',                                                  // .doc
  'application/octet-stream', // generic fallback some browsers send
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    const allowedExts = /\.(xlsx|xls|docx|pdf)$/i;
    if (ALLOWED_MIME_TYPES.has(file.mimetype) || allowedExts.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel (.xlsx/.xls), Word (.docx), and PDF files are allowed.'));
    }
  },
});

/**
 * POST /api/tds/parse
 * Accepts: multipart/form-data with a single "file" field
 * Returns: ParsedTaxPaid JSON
 */
router.post(
  '/parse',
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file uploaded.' });
      return;
    }

    try {
      const result = await parseTDSFile(req.file.buffer, req.file.originalname, req.file.mimetype);
      res.json({ success: true, data: result });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse file.';
      res.status(400).json({ success: false, error: message });
    }
  }
);

// Multer error handler (file too large, wrong type)
router.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err.message?.includes('File too large')) {
    res.status(413).json({ success: false, error: 'File exceeds the 10 MB limit.' });
    return;
  }
  res.status(400).json({ success: false, error: err.message ?? 'Upload error.' });
});

export default router;
