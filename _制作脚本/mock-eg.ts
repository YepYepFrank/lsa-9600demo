/* 演示版 EG 管理页的模拟接口：不连任何服务，页面发的 api/... 请求都在这里就地回答。
 * 数据来自开发机 AH03 样机某一时刻的接口快照（已把开发地址换成现场样式、口令本来就是打码的），
 * 打开页面时把快照里的时间整体平移到「现在」，实时值加一点小波动，看起来是活的。
 * 地址栏 ?cab=AH05&name=2#出线柜 可把柜号 / 柜名换掉（子站演示页「进入 EG 管理页」会带上）。 */
import demo from './demo-data.json'
import media from './demo-media.json'

type Json = unknown
const { cap } = demo as { cap: number; snap: Record<string, Json> }
const qs = new URLSearchParams(location.search)
const cab = (qs.get('cab') || 'AH03').replace(/[^A-Za-z0-9-]/g, '')
const name = qs.get('name') || ''

// 柜号 / 柜名替换在文本上做一次
let text = JSON.stringify((demo as { snap: Json }).snap)
if (cab !== 'AH03') text = text.split('AH03').join(cab)
if (name) text = text.split('1#出线柜').join(name)
const SNAP = JSON.parse(text) as Record<string, Json>

const LO = cap - 45 * 86400e3, HI = cap + 45 * 86400e3
const pad = (n: number) => String(n).padStart(2, '0')
/** 时间平移：毫秒时间戳、ISO 串、日志里的「2026/9/28 00:17:54」 */
function shift(v: Json, d: number): Json {
  if (typeof v === 'number') return v > LO && v < HI ? v + d : v
  if (typeof v === 'string') {
    let s = v
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) { const t = Date.parse(s); if (t > LO && t < HI) return new Date(t + d).toISOString() }
    s = s.replace(/\b1[78]\d{11}\b/g, m => { const n = Number(m); return n > LO && n < HI ? String(n + d) : m })
    s = s.replace(/(\d{4})\/(\d{1,2})\/(\d{1,2}) (\d{2}):(\d{2}):(\d{2})/g, (m, y, mo, da, h, mi, se) => {
      const t = new Date(+y, +mo - 1, +da, +h, +mi, +se).getTime() + d
      const x = new Date(t)
      return `${x.getFullYear()}/${x.getMonth() + 1}/${x.getDate()} ${pad(x.getHours())}:${pad(x.getMinutes())}:${pad(x.getSeconds())}`
    })
    return s
  }
  if (Array.isArray(v)) return v.map(x => shift(x, d))
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shift(x, d)]))
  return v
}

/** 实时值的小波动：只动测量值，不动坐标、计数、状态量 */
const FIXED = /(_x|_y|cnt|count|online|link|state|hot|regionsVer|\.pt)$/
function jitter(v: Json, key = ''): Json {
  if (typeof v === 'number' && key === 'v') return v
  if (Array.isArray(v)) return v.map(x => jitter(x, key))
  if (v && typeof v === 'object') {
    const o = v as Record<string, Json>
    if ('v' in o && typeof o.v === 'number' && !FIXED.test(key) && !Number.isInteger(o.v)) {
      const x = o.v as number, dec = (String(x).split('.')[1] ?? '').length
      const nx = x + x * 0.006 * (Math.random() * 2 - 1)
      return { ...o, v: Number(nx.toFixed(dec)) }
    }
    return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, jitter(x, k)]))
  }
  return v
}

const b64 = (s: string) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u }
const M = media as Record<string, { type: string; b64: string }>
const blobOf = (k: string) => (M[k] ? new Blob([b64(M[k].b64)], { type: M[k].type }) : null)

const json = (body: Json, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } })
const now = () => Date.now() - cap

const ME = (SNAP['auth/me'] ?? { user: 'maint', name: '本地维护', role: 'maint', via: 'local' }) as Record<string, Json>
const ok = (msg = '演示环境：操作已模拟，不会真的执行') => json({ ok: true, changed: [], message: msg })

function answer(path: string, method: string): Response {
  const [p, q = ''] = path.split('?')
  const d = now()
  if (p === 'auth/login' || p === 'auth/sso') return json({ ...ME, token: 'demo' })
  if (p === 'auth/logout' || p === 'auth/password') return ok()
  if (p === 'auth/me') return json(shift(ME, d))
  if (method !== 'GET') {
    if (p === 'video/snapshot') {
      const ch = new URLSearchParams(q).get('ch') || 'visible'
      const b = blobOf('snap.' + (ch.startsWith('ir') || ch.startsWith('th') ? 'ir' : 'visible'))
      return b ? new Response(b, { headers: { 'content-type': 'image/jpeg', 'x-snapshot-via': 'camera', 'x-snapshot-ts': String(Date.now()) } }) : json({ message: '演示环境无抓图' }, 404)
    }
    return ok() // 重启组件、改本地配置、上传证据……一律只回成功
  }
  if (p.startsWith('stream/')) return json({ message: '演示环境没有实时视频' }, 404)
  const m = p.match(/^evidence\/([^/]+)\/file$/)
  if (m) {
    const id = decodeURIComponent(m[1])
    const list = ((SNAP['evidence?limit=500'] ?? SNAP['evidence?limit=300']) as { items?: { evidenceId: string; kind: string; channelId: string }[] })?.items ?? []
    const it = list.find(i => i.evidenceId === id)
    const b = it && blobOf(`${it.kind}.${it.channelId}`)
    return b ? new Response(b, { headers: { 'content-type': b.type } }) : json({ message: '演示环境只带了部分证据文件' }, 404)
  }
  if (p.startsWith('logs/')) return json(shift(SNAP[`${p}?tail=200`] ?? { lines: [] }, d))
  if (p === 'evidence') return json(shift(SNAP['evidence?limit=500'] ?? SNAP['evidence?limit=300'], d))
  if (p === 'alarms') return json(shift(SNAP['alarms?limit=200'] ?? { alarms: [] }, d))
  if (p === 'audit') return json(shift(SNAP['audit?limit=500'], d))
  if (p === 'history') {
    // 查询串顺序与 monitor.ts 一致；柜号换过时 SNAP 里也已换好
    const hit = SNAP[path] ?? SNAP[path.replace(/&points=\d+/, '&points=288')]
    return json(shift(hit ?? { series: {} }, d))
  }
  const hit = SNAP[p] ?? SNAP[path]
  if (hit === undefined) return json({ message: '演示环境没有这项数据' }, 404)
  const out = shift(hit, d)
  return json(p.startsWith('live/') || p === 'status' || p === 'diag' ? jitter(out) : out)
}

const realFetch = window.fetch.bind(window)
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const mm = url.match(/(?:^|\/)api\/(.*)$/)
  if (!mm) return realFetch(input, init)
  await new Promise(r => setTimeout(r, 40 + Math.random() * 80))
  return answer(mm[1], (init?.method ?? 'GET').toUpperCase())
}

// 双光画面底图：样机抓到的真实可见光 / 热像帧（DualLightPlayer 的演示补丁读这两个）
const w = window as unknown as Record<string, string>
if (M['snap.visible']) w.__DEMO_VIS = `data:image/jpeg;base64,${M['snap.visible'].b64}`
if (M['snap.ir']) w.__DEMO_IR = `data:image/jpeg;base64,${M['snap.ir'].b64}`

// 免登录：直接带上演示会话
try { localStorage.setItem(`lsa-eg-session:${location.pathname}`, 'demo') } catch { /* 隐私模式 */ }
