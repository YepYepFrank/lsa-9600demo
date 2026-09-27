// 无头 Edge + CDP 点几个关键交互：证据视频回放、抓帧、子站「EG 管理页」跳转（都在 file:// 下）
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const BASE = 'file:///D:/Work%20Files/GWDR/lsa-9600demo/'
const SP = BASE + encodeURI('子站') + '/index.html', EG = BASE + 'EG/index.html'
const prof = mkdtempSync(join(tmpdir(), 'demo-cdp-'))
const p = spawn(EDGE, ['--headless=new', '--disable-gpu', '--remote-debugging-port=9333', `--user-data-dir=${prof}`, '--window-size=1280,1024', 'about:blank'], { stdio: 'ignore' })
const sleep = ms => new Promise(r => setTimeout(r, ms))
let targets
for (let i = 0; i < 50; i++) { try { targets = await (await fetch('http://127.0.0.1:9333/json')).json(); break } catch { await sleep(200) } }
const page = targets.find(t => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise(r => ws.addEventListener('open', r))
let id = 0; const wait = new Map(); const errors = []
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data)
  if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id) }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description?.slice(0, 200))
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 200))
})
const cdp = (method, params = {}) => new Promise(r => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const ev = async (expr) => (await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value
await cdp('Runtime.enable'); await cdp('Page.enable')
const go = async (url, ms = 4000) => { await cdp('Page.navigate', { url }); await sleep(ms) }

// 1. EG 证据：点第一条「查看」→ 弹出视频，能读到时长
await go(EG + '#/manage/evidence')
await ev(`(() => { const b = [...document.querySelectorAll('button, a, span')].find(x => x.textContent.trim() === '查看'); b && b.click(); return !!b })()`)
await sleep(2500)
console.log('证据回放', await ev(`(() => { const v = document.querySelector('video'); return v ? { src: v.src.slice(0, 12), readyState: v.readyState, duration: Math.round(v.duration || 0), w: v.videoWidth } : null })()`))

// 2. EG 视频与测温：点「热像」抓帧 → 出图
await go(EG + '#/manage/video')
await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '热像'); b && b.click(); return !!b })()`)
await sleep(1500)
console.log('抓帧', await ev(`(() => { const i = document.querySelector('img[alt="抓帧"]'); return i ? { ok: i.complete && i.naturalWidth > 0, w: i.naturalWidth } : null })()`))

// 3. EG 日志、实时数据页有内容
await go(EG + '#/manage/logs', 3000)
console.log('日志行数', await ev(`document.body.innerText.split('\\n').filter(l => /\\d{4}\\/\\d+\\/\\d+/.test(l)).length`))
await go(EG + '#/live/SAM-AH03-A', 3000)
console.log('实时数据', await ev(`document.body.innerText.includes('us.amp') || document.body.innerText.includes('局放')`))

// 4. 子站网关页「EG 管理页」→ 新窗口打开 ../EG/
await go(SP + '#/gateway/AH05', 5000)
await ev(`window.__opened = []; window.open = (u) => { const w = { location: { set href(v) { window.__opened.push(v) } }, close() {} }; window.__opened.push(u); return w }; true`)
await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'EG 管理页'); b && b.click(); return !!b })()`)
await sleep(800)
console.log('子站跳转', await ev(`JSON.stringify(window.__opened)`))
await go(EG + '?cab=AH05&name=' + encodeURIComponent('3#出线柜') + '#/overview', 3000)
console.log('EG 换柜', await ev(`document.querySelector('.hd, header, body').innerText.slice(0, 80).replace(/\\s+/g, ' ')`))

// 4b. EG 新界面：事件与录像 → 点第一条「关联录像」→ 出双光录像
await go(EG + '#/events', 5000)
await ev(`(() => { const b = [...document.querySelectorAll('button, a, span, td')].find(x => /个文件/.test(x.textContent.trim()) && x.children.length === 0); b && b.click(); return !!b })()`)
await sleep(3000)
console.log('事件关联录像', await ev(`[...document.querySelectorAll('video')].map(v => ({ rs: v.readyState, w: v.videoWidth }))`))
for (const r of ['#/overview', '#/electric', '#/manage/status', '#/manage/devices', '#/manage/diag', '#/manage/system']) { await go(EG + r, 3000) }
// 5. 子站几页没报错
for (const r of ['#/overview', '#/cab/AH03', '#/monitor/wall', '#/alarms/live', '#/trend', '#/inspect', '#/system']) { await go(SP + r, 3000) }
console.log('页面错误', errors.length ? errors : '无')
ws.close(); p.kill()
