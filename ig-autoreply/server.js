// Instagram comment auto-reply: public reply + private DM. No dependencies (Node 18+).
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';

// Minimal .env loader
if (fs.existsSync('.env')) {
  for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

const {
  PORT = 3000,
  VERIFY_TOKEN,
  APP_SECRET,
  IG_ACCESS_TOKEN,
  IG_USER_ID,
  KEYWORD = '',                 // empty = reply to every comment
  PUBLIC_REPLY = 'שלחתי לך הודעה בפרטי 🙌',
  DM_TEXT = 'היי! תודה על התגובה. הנה הקישור: https://example.com',
} = process.env;

const GRAPH = 'https://graph.instagram.com/v21.0';
const handled = new Set(); // avoid replying twice to the same comment

async function graph(path, body) {
  const res = await fetch(`${GRAPH}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${IG_ACCESS_TOKEN}` },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) console.error('Graph error', path, JSON.stringify(json));
  return json;
}

async function onComment(c) {
  const { id, text = '', from } = c;
  if (!id || handled.has(id)) return;
  if (from?.id === IG_USER_ID) return; // ignore our own replies
  if (KEYWORD && !text.toLowerCase().includes(KEYWORD.toLowerCase())) return;
  handled.add(id);
  console.log(`comment ${id}: ${text}`);
  await graph(`/${id}/replies`, { message: PUBLIC_REPLY });
  await graph(`/${IG_USER_ID}/messages`, { recipient: { comment_id: id }, message: { text: DM_TEXT } });
}

function validSignature(raw, header) {
  if (!APP_SECRET) return true; // skip only if no secret configured
  const expected = 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(raw).digest('hex');
  return header && header.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname !== '/webhook') { res.writeHead(200).end('ok'); return; }

  if (req.method === 'GET') { // Meta verification handshake
    const ok = url.searchParams.get('hub.mode') === 'subscribe' &&
      url.searchParams.get('hub.verify_token') === VERIFY_TOKEN;
    res.writeHead(ok ? 200 : 403).end(ok ? url.searchParams.get('hub.challenge') : 'forbidden');
    return;
  }

  const chunks = [];
  req.on('data', (d) => chunks.push(d));
  req.on('end', () => {
    const raw = Buffer.concat(chunks);
    if (!validSignature(raw, req.headers['x-hub-signature-256'])) { res.writeHead(401).end(); return; }
    res.writeHead(200).end('ok'); // ack fast, work after
    try {
      const body = JSON.parse(raw.toString());
      for (const entry of body.entry ?? [])
        for (const ch of entry.changes ?? [])
          if (ch.field === 'comments') onComment(ch.value).catch((e) => console.error(e));
    } catch (e) { console.error('bad payload', e); }
  });
}).listen(PORT, () => console.log(`listening on :${PORT}`));
