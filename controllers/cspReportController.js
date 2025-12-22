// controllers/cspReportController.js
// Recebe relatórios CSP (report-only/enforce) e responde JSON.

let lastLogAt = 0;
let skipped = 0;

function extractReport(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (payload['csp-report']) return payload['csp-report'];
  if (payload.body && typeof payload.body === 'object') return payload.body;
  return payload;
}

function logReport(report, meta) {
  const now = Date.now();
  if (now - lastLogAt < 5000) {
    skipped += 1;
    return;
  }
  const summary = {
    document_uri: report?.['document-uri'] || report?.documentURI,
    blocked_uri: report?.['blocked-uri'] || report?.blockedURL,
    violated_directive: report?.['violated-directive'] || report?.effectiveDirective,
    disposition: report?.disposition,
    sample: report?.['script-sample'] || report?.sample,
    ...meta,
    skipped,
  };
  skipped = 0;
  lastLogAt = now;
  console.warn('[csp-report]', JSON.stringify(summary));
}

exports.report = (req, res) => {
  const report = extractReport(req.body);
  const meta = {
    ip: req.ip,
    ua: req.headers['user-agent'],
  };

  logReport(report, meta);

  res.set('Cache-Control', 'no-store');
  return res.status(200).json({ success: true });
};
