import { Router, Request, Response } from 'express';
import multer from 'multer';
import { parseCapitalGainsFile } from '../utils/capitalGainsParser';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel',                                           // .xls
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/octet-stream', // some browsers send this for xlsx
    ];
    const allowedExts = /\.(xlsx|xls|docx)$/i;

    if (allowedMimes.includes(file.mimetype) || allowedExts.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel (.xlsx, .xls) and Word (.docx) files are allowed.'));
    }
  },
});

/**
 * POST /api/capital-gains/parse
 * Accepts: multipart/form-data with a single "file" field
 * Returns: ParsedCapitalGainsResult JSON
 */
router.post(
  '/parse',
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: 'No file uploaded.' });
        return;
      }

      const result = await parseCapitalGainsFile(req.file.buffer, req.file.originalname);
      res.json({ success: true, data: result });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse file.';
      res.status(400).json({ success: false, error: message });
    }
  }
);

export default router;
