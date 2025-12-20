const fs = require('fs');
const path = require('path');

/**
 * Validate uploaded CSV files
 */
function validateCsvFile(filePath, originalName = '') {
  try {
    // 1. Check file extension
    const ext = path.extname(originalName || filePath).toLowerCase();
    if (ext !== '.csv') {
      return { valid: false, error: 'Arquivo deve ser um CSV' };
    }

    // 2. Check file size (max 10MB for CSV)
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    const stats = fs.statSync(filePath);
    if (stats.size > MAX_SIZE) {
      return { valid: false, error: 'Arquivo muito grande. Máximo: 10MB' };
    }

    // 3. Check if file is empty
    if (stats.size === 0) {
      return { valid: false, error: 'Arquivo CSV está vazio' };
    }

    // 4. Read first few bytes to validate content
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(8192); // 8KB sample
    const bytesRead = fs.readSync(fd, buffer, 0, Math.min(8192, stats.size), 0);
    fs.closeSync(fd);

    const sample = buffer.toString('utf8', 0, bytesRead);

    // 5. Check for binary content (not text)
    if (sample.includes('\x00')) {
      return { valid: false, error: 'Arquivo contém dados binários. CSV deve ser texto' };
    }

    // 6. Check for basic CSV structure
    const lines = sample.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) {
      return { valid: false, error: 'CSV deve ter pelo menos cabeçalho e uma linha de dados' };
    }

    // 7. Check for potential CSV injection
    const dangerousPatterns = [
      /^[=+\-@]/,  // Formula injection
      /\|\s*cmd/i,  // Command injection attempts
      /<script/i,   // Script tags
      /javascript:/i // JavaScript URLs
    ];

    for (const line of lines.slice(0, 10)) { // Check first 10 lines
      for (const pattern of dangerousPatterns) {
        if (pattern.test(line)) {
          return { valid: false, error: 'CSV contém conteúdo potencialmente perigoso' };
        }
      }
    }

    return { valid: true };
  } catch (error) {
    console.error('Error validating CSV:', error);
    return { valid: false, error: 'Erro ao validar arquivo CSV' };
  }
}

/**
 * Middleware for CSV file validation
 */
function csvUploadValidator(req, res, next) {
  // This middleware runs after formidable has processed the upload
  // We'll integrate it into the parseImportRequest function
  next();
}

module.exports = {
  validateCsvFile,
  csvUploadValidator
};