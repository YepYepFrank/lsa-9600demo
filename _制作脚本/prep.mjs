// 把开发机抓的接口快照整理成演示数据：开发地址换成现场样式、路径换成 EG 上的路径、旁观实例的「上送已关闭」换成正常口径、媒体转 base64
// 用法：node prep.mjs [快照目录，缺省 snap2]
import { readFileSync, writeFileSync, statSync } from 'node:fs'
const DIR = process.argv[2] || 'snap2'
let t = readFileSync(`${DIR}/api.json`, 'utf8')
const cap = statSync(`${DIR}/api.json`).mtimeMs
const R = [
  [/http:\/\/127\.0\.0\.1:3001/g, 'https://192.168.1.10'],
  [/mqtt:\/\/127\.0\.0\.1:1883\b/g, 'mqtts://192.168.1.10:8883'],
  [/mqtt:\/\/127\.0\.0\.1:11883/g, 'mqtt://127.0.0.1:1884'],
  [/http:\/\/127\.0\.0\.1:3190\/emu\/cam/g, 'http://192.168.10.64/restv1'],
  [/http:\/\/localhost:910[01]\//g, 'http://192.168.1.21/'],
  [/"host": "localhost"/g, '"host": "192.168.1.10"'],
  [/"host": "127\.0\.0\.1"/g, '"host": "192.168.1.10"'],
  [/"ip": "127\.0\.0\.1"/g, '"ip": "192.168.1.10"'],
  [/rtspPort": 18554/g, 'rtspPort": 8554'],
  [/"readFrom": \[\s*"0\.0\.0\.0\/0"\s*\]/g, '"readFrom": ["192.168.1.10/32", "127.0.0.1/32"]'],
  [/@camera:8554/g, '@192.168.10.64:554'],
  [/host\.docker\.internal\/192\.168\.65\.254/g, '127.0.0.1'],
  [/host\.docker\.internal/g, '127.0.0.1'],
]
for (const [a, b] of R) t = t.replace(a, b)
const fix = v => typeof v === 'string'
  ? v.replace(/[A-Za-z]:[\\/]+Work Files[\\/]+GWDR[\\/]+lsa-9600eg(?:-ui)?[\\/]+run[\\/]+([^"\s]*)/g, (_, rest) => '/opt/lsa-eg/config/' + rest.replace(/\\+/g, '/'))
  : Array.isArray(v) ? v.map(fix) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fix(x)])) : v
const snap = fix(JSON.parse(t))

// 旁观实例（只收不发）→ 正常 EG 的口径：上送正常无积压、告警事件送子站
const d = snap.diag
Object.assign(d.uplink, { state: 'ok', text: '正常，无积压', depth: 0, oldestUnsent: null, lastAckAt: cap - 800, target: 'mqtts://192.168.1.10:8883', lost: 0, outboxMb: 0, backfillPct: null })
Object.assign(d.events, { target: 'https://192.168.1.10/ext/eg/AH03/events', state: 'ok', text: '正常', lastAckAt: cap - 5000, hook: { ...d.events.hook, count: 306, lastAt: cap - 5000 } })
for (const k of ['alarms?limit=200']) for (const a of snap[k]?.alarms ?? []) a.pending = false
if (snap.status?.sp) snap.status.sp.host = '192.168.1.10'

// 证据：子站侧按「已上线」展示，重要的已上传
for (const key of ['evidence?limit=300', 'evidence?limit=500']) {
  const ev = snap[key]; if (!ev) continue
  Object.assign(ev.status, { indexPending: 0, indexError: null, lastIndexAck: cap - 4000, uploadPending: 0, target: 'https://192.168.1.10/ext/eg/AH03/evidence' })
  for (const it of ev.items) {
    it.uploadError = null
    if (it.important && it.hasFile && it.status === 'READY') { it.status = 'UPLOADED'; it.location = 'both'; it.uploadWanted = false }
  }
}
snap['video/status'] = { ...snap['video/status'], available: true }
let s2 = JSON.stringify(snap)
s2 = s2.replace(/thingsboard\/tb-gateway:latest/g, 'thingsboard/tb-gateway:3.8.5').replace(/eclipse-mosquitto:2"/g, 'eclipse-mosquitto:2.1.2"').replace(/"port":1883\b/g, '"port":8883')
  .replace(/EG_UPLINK=off|EG_PASSIVE=1|旁观/g, '')
const clean = JSON.parse(s2)
const left = s2.match(/Work Files|rdpadmin|localhost|docker\.internal|lsa-9600eg-ui|127\.0\.0\.1:(3001|3190|11883|910[01])/g) ?? []
console.log('清理后剩余开发痕迹', left.length, [...new Set(left)])
const meta = JSON.parse(readFileSync(`${DIR}/ev-meta.json`, 'utf8'))
const media = {}
for (const [k, m] of Object.entries(meta)) media[k] = { type: m.type, b64: readFileSync(`${DIR}/${m.file}`).toString('base64') }
for (const ch of ['visible', 'ir']) media['snap.' + ch] = { type: 'image/jpeg', b64: readFileSync(`${DIR}/snap-${ch}.jpg`).toString('base64') }
writeFileSync('demo-data.json', JSON.stringify({ cap, snap: clean }))
writeFileSync('demo-media.json', JSON.stringify(media))
console.log('cap', new Date(cap).toISOString(), 'keys', Object.keys(clean).length, 'media', Object.keys(media).join(','))
