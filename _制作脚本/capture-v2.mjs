// 从开发机「旁观」agent（9101，eg-ui-v2 代码，只收不发）只读抓 EG 新界面要用的全部接口快照
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
const A = process.env.AGENT || 'http://127.0.0.1:9101', V = process.env.VIDEO || 'http://127.0.0.1:9110'
const RUN = process.env.RUN || 'D:/Work Files/GWDR/lsa-9600eg-ui/run'
mkdirSync('snap2', { recursive: true })
const pw = readFileSync(RUN + '/initial-password.txt', 'utf8').trim()
const lr = await fetch(A + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'maint', password: pw }) })
if (!lr.ok) throw new Error('login ' + lr.status)
const { token } = await lr.json()
const H = { Authorization: 'Bearer ' + token }
const out = {}
async function g(base, p) {
  const r = await fetch(base + '/api/' + p, { headers: H })
  const t = await r.text()
  console.log(r.status, p.slice(0, 90), t.length)
  if (r.ok) { try { out[p] = JSON.parse(t) } catch { out[p] = t } }
  return out[p]
}
const st = await g(A, 'status')
for (const p of ['diag', 'components', 'config', 'catalog', 'evidence?limit=300', 'evidence?limit=500', 'alarms?limit=200', 'auth/me', 'audit?limit=500']) await g(A, p)
await g(V, 'video/status')
await g(V, 'video/recording')
const devs = st.devices.map(d => d.name)
for (const d of [st.eg, ...devs]) { await g(A, 'live/' + encodeURIComponent(d)); await g(A, 'raw/' + encodeURIComponent(d)) }
for (const c of out['components'] ?? []) await g(A, `logs/${c.key}?tail=200`)
// 与 monitor.ts 完全相同的历史查询
const kind = k => st.devices.filter(d => d.kind === k).map(d => d.name).sort()
const H24 = (dev, keys, agg = 'AVG') => `history?device=${encodeURIComponent(dev)}&keys=${keys.join(',')}&hours=24&points=288&agg=${agg}`
const qs = []
for (const c of kind('camera')) qs.push(H24(c, ['ir.R1.max', 'ir.R2.max', 'ir.R3.max', 'ir.rmax', 'ir.rise']))
for (const s of kind('sam')) { qs.push(H24(s, ['env.t', 'env.rh', 'us.amp', 'us.cnt'])); qs.push(H24(s, ['uv.pulse'], 'NONE')) }
for (const p of kind('pm')) qs.push(H24(p, ['pm.1.0', 'pm.2.5', 'pm.10']))
for (const m of kind('meter')) qs.push(H24(m, ['el.Ia', 'el.Ib', 'el.Ic', 'el.P']))
for (const q of qs) await g(A, q)
for (const ch of ['visible', 'ir']) {
  const r = await fetch(`${V}/api/video/snapshot?ch=${ch}`, { method: 'POST', headers: H })
  if (r.ok) writeFileSync(`snap2/snap-${ch}.jpg`, Buffer.from(await r.arrayBuffer()))
  console.log('snap', ch, r.status)
}
// 每种证据取最小的一份文件（回放用）
const items = (out['evidence?limit=500']?.items ?? []).filter(i => i.hasFile && i.sizeBytes)
const pick = {}
for (const i of items) { const k = i.kind + '.' + i.channelId; if (!pick[k] || i.sizeBytes < pick[k].sizeBytes) pick[k] = i }
const meta = {}
for (const [k, i] of Object.entries(pick)) {
  const r = await fetch(`${A}/api/evidence/${encodeURIComponent(i.evidenceId)}/file`, { headers: H })
  if (r.ok) { writeFileSync(`snap2/ev-${k}`, Buffer.from(await r.arrayBuffer())); meta[k] = { file: `ev-${k}`, type: r.headers.get('content-type') } }
  console.log('ev', k, r.status, i.sizeBytes)
}
writeFileSync('snap2/ev-meta.json', JSON.stringify(meta, null, 1))
writeFileSync('snap2/api.json', JSON.stringify(out, null, 1))
console.log('ok', Object.keys(out).length)
