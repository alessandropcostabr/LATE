// services/telephonyProcessor.js
// Worker para processar eventos de telefonia (Hangup/DialEnd) em call_logs.

const db = require("../config/database");
const { normalizePhone } = require("../utils/phone");

const DEFAULT_BATCH = Number(process.env.TELEPHONY_PROCESS_BATCH || 50);
const DEFAULT_INTERVAL_MS = Number(process.env.TELEPHONY_PROCESS_INTERVAL_MS || 5000);

let timer = null;
let running = false;

function deriveStatus(row, payload = {}) {
  const state = (
    row.state ||
    payload.state ||
    payload.channelstatedesc ||
    payload.ChannelStateDesc ||
    payload.ChannelState ||
    ""
  ).toString().toLowerCase();
  const dialStatus = (payload.dialstatus || payload.DialStatus || "").toString().toLowerCase();
  const causeTxt = (payload.cause_txt || payload["Cause-txt"] || payload.CauseTxt || "").toString().toLowerCase();
  const cause = Number(payload.hangupcause || payload.HangupCause || payload.cause || payload.Cause);

  const billsec = Number(payload.billsec ?? payload.Billsec ?? payload.BillSec ?? payload.duration ?? payload.Duration);
  const hasBill = Number.isFinite(billsec) && billsec > 0;

  const has = (str, sub) => str && str.includes(sub);
  const dialNoAnswer = dialStatus.replace(/\s+/g, "").includes("noanswer");
  const dialAnswered = has(dialStatus, "answer");
  const isRinging = has(state, "ring");
  const isUp = has(state, "up");

  if (has(dialStatus, "busy") || has(state, "busy") || has(causeTxt, "busy") || cause === 17) return "busy";
  if (has(dialStatus, "cancel") || has(causeTxt, "cancel")) return "cancel";
  if (cause === 21 || has(causeTxt, "reject")) return "rejected";
  if (has(causeTxt, "congestion")) return "congestion";

  if (hasBill || dialAnswered) return "answered";
  if (dialNoAnswer || isRinging || cause === 18 || cause === 19) return "no-answer";
  if ((row.event || "").toString().toLowerCase() === "hangup") {
    return hasBill ? "answered" : "no-answer";
  }
  if (isUp && hasBill) return "answered";

  return "unknown";
}

function resolveEndedAt(row, payload = {}) {
  if (payload.end_ts) return new Date(payload.end_ts);
  if (payload.event_ts) return new Date(payload.event_ts);
  if (row.received_at) return new Date(row.received_at);
  return new Date();
}

function resolveDurationSeconds(startedAt, endedAt, payload = {}) {
  if (payload.billsec !== undefined) return Number(payload.billsec);
  if (payload.BillSec !== undefined) return Number(payload.BillSec);
  if (payload.duration !== undefined) return Number(payload.duration);
  if (payload.Duration !== undefined) return Number(payload.Duration);
  if (startedAt && endedAt) {
    return Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000));
  }
  return null;
}

function pickCaller(row, payload = {}) {
  return (
    row.caller ||
    payload.callerid ||
    payload.calleridnum ||
    payload.CallerIDNum ||
    payload.CallerID ||
    null
  );
}

function pickCallee(row, payload = {}) {
  return (
    row.callee ||
    payload.exten ||
    payload.Exten ||
    payload.connectedlinenum ||
    payload.ConnectedLineNum ||
    null
  );
}

function pickRecording(payload = {}) {
  return payload.recording || payload.RecordingFile || payload.recordingfile || null;
}

function pickTrunk(row, payload = {}) {
  return row.trunk || payload.trunk || payload.channel || payload.Channel || payload.Context || null;
}

async function findContactId(client, phoneNormalized) {
  if (!phoneNormalized) return null;
  const { rows } = await client.query(
    "SELECT id FROM contacts WHERE phone_normalized = $1 LIMIT 1",
    [phoneNormalized]
  );
  return rows[0]?.id || null;
}

async function markProcessed(id) {
  await db.query("UPDATE telephony_events SET processed_at = NOW(), processed_error = NULL WHERE id = $1", [id]);
}

async function markError(id, error) {
  await db.query("UPDATE telephony_events SET processed_error = $1 WHERE id = $2", [error, id]);
}

async function fetchFirstStartTs(client, uniqueid) {
  const { rows } = await client.query(
    `SELECT start_ts FROM telephony_events
      WHERE uniqueid = $1 AND event ILIKE 'newchannel'
      ORDER BY start_ts ASC LIMIT 1`,
    [uniqueid]
  );
  return rows[0]?.start_ts ? new Date(rows[0].start_ts) : null;
}

async function processEvent(row) {
  const payload = row.payload || {};
  let startedAt = row.start_ts ? new Date(row.start_ts) : null;
  const endedAt = resolveEndedAt(row, payload);

  const callerRaw = pickCaller(row, payload);
  const calleeRaw = pickCallee(row, payload);
  const callerNormalized = normalizePhone(callerRaw);
  const calleeNormalized = normalizePhone(calleeRaw);

  const status = deriveStatus(row, payload);
  const dialStatusRaw = (payload.dialstatus || payload.DialStatus || "").toString().toLowerCase();
  const dialAnswered = dialStatusRaw.includes("answer");
  const billCandidate = Number(payload.billsec ?? payload.Billsec ?? payload.BillSec ?? payload.duration ?? payload.Duration);
  const hasBill = Number.isFinite(billCandidate) && billCandidate > 0;
  let durationSeconds = resolveDurationSeconds(startedAt, endedAt, payload);
  const recording = pickRecording(payload);
  const trunk = pickTrunk(row, payload);

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const firstStart = await fetchFirstStartTs(client, row.uniqueid);
    if (firstStart && (!startedAt || firstStart < startedAt)) {
      startedAt = firstStart;
    }

    const shouldRecalcDuration = durationSeconds == null || (durationSeconds === 0 && startedAt && endedAt && startedAt < endedAt);
    if (shouldRecalcDuration && startedAt && endedAt) {
      const diffMs = endedAt.getTime() - startedAt.getTime();
      durationSeconds = Math.max(0, Math.round(diffMs / 1000));
    }

    const { rows: existing } = await client.query("SELECT id FROM call_logs WHERE uniqueid = $1", [row.uniqueid]);
    if (existing.length > 0) {
      await client.query("COMMIT");
      await markProcessed(row.id);
      return { action: "skip" };
    }

    const contactId = await findContactId(client, callerNormalized);
    let finalStatus = status;
    const evidenceAnswered = dialAnswered || hasBill;
    if (finalStatus === "answered" && !evidenceAnswered) finalStatus = "no-answer";
    if (finalStatus === "ended" || finalStatus === "unknown") {
      finalStatus = evidenceAnswered ? "answered" : "no-answer";
    }

    await client.query(
      `INSERT INTO call_logs (
         uniqueid,
         direction,
         status,
         caller,
         caller_normalized,
         callee,
         trunk,
         started_at,
         ended_at,
         duration_seconds,
         recording,
         payload,
         customer_id
       ) VALUES ($1, 'inbound', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (uniqueid) DO NOTHING`,
      [
        row.uniqueid,
        finalStatus,
        callerRaw || null,
        callerNormalized || null,
        calleeRaw || null,
        trunk || null,
        startedAt,
        endedAt,
        durationSeconds,
        recording,
        row.payload,
        contactId,
      ]
    );

    await client.query("COMMIT");
    await markProcessed(row.id);
    return { action: "processed", contactId };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[telephony] falha ao processar", row.uniqueid, err?.message || err);
    await markError(row.id, err?.message || String(err));
    return { action: "failed", error: err };
  } finally {
    client.release();
  }
}

async function processPending(options = {}) {
  const limit = Number(options.limit || DEFAULT_BATCH);
  const { rows } = await db.query(
    `SELECT * FROM telephony_events
     WHERE processed_at IS NULL
       AND lower(event) IN ('hangup','dialend')
     ORDER BY received_at ASC
     LIMIT $1`,
    [limit]
  );

  let processed = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    const result = await processEvent(row);
    if (result.action === "processed") processed += 1;
    else if (result.action === "failed") failed += 1;
    else skipped += 1;
  }

  return { fetched: rows.length, processed, failed, skipped };
}

function startTelephonyProcessor(options = {}) {
  if (timer) return timer;
  const intervalMs = Number(options.intervalMs || DEFAULT_INTERVAL_MS);
  const batchSize = Number(options.limit || DEFAULT_BATCH);

  timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const summary = await processPending({ limit: batchSize });
      if (summary.processed || summary.failed) {
        console.info(
          `[telephony] lote: fetched=${summary.fetched} processed=${summary.processed} failed=${summary.failed} skipped=${summary.skipped}`
        );
      }
    } catch (err) {
      console.error("[telephony] loop erro:", err?.message || err);
    } finally {
      running = false;
    }
  }, intervalMs);

  console.log(`[telephony] processor iniciado (intervalo ${intervalMs}ms, batch ${batchSize})`);
  return timer;
}

function stopTelephonyProcessor() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = {
  processPending,
  startTelephonyProcessor,
  stopTelephonyProcessor,
};
