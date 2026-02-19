/**
 * STORAGE UTILITIES
 * 
 * Handles secure file path generation, UUID naming, and directory management.
 * Enforces absolute paths and strictly confined directories.
 */

import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

const UPLOADS_ROOT = path.join(process.cwd(), 'public', 'uploads');
const DIRS = {
  original: path.join(UPLOADS_ROOT, 'original'),
  resized: path.join(UPLOADS_ROOT, 'resized'),
  thumbnails: path.join(UPLOADS_ROOT, 'thumbnails'),
};

// Ensure directories exist on startup
Object.values(DIRS).forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

export const StorageService = {
  
  /**
   * Generates a secure, UUID-based filename.
   */
  generateId: () => randomUUID(),

  /**
   * Returns the absolute path for an original image.
   */
  getOriginalPath: (id: string, extension: string) => {
    return path.join(DIRS.original, `${id}${extension}`);
  },

  /**
   * Returns the absolute path for a resized image (WebP).
   */
  getResizedPath: (id: string) => {
    return path.join(DIRS.resized, `${id}.webp`);
  },

  /**
   * Returns the absolute path for a thumbnail (WebP).
   */
  getThumbnailPath: (id: string) => {
    return path.join(DIRS.thumbnails, `${id}.webp`);
  },

  /**
   * Verifies that a path is within the allowed uploads directory.
   * Prevents Path Traversal attacks.
   */
  validatePath: (filePath: string) => {
    const relative = path.relative(UPLOADS_ROOT, filePath);
    return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
  }
};
