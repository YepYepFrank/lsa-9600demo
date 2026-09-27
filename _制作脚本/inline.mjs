// 把 Vite 产物的 JS / CSS 内联进 index.html：双击 index.html（file://）就能打开，不用任何服务
// 用法：node inline.mjs <dist 目录> <输出目录>
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
const [src, out] = process.argv.slice(2)
mkdirSync(out, { recursive: true })
let html = readFileSync(join(src, 'index.html'), 'utf8')
html = html.replace(/<script type="module" crossorigin src="\.\/(assets\/[^"]+\.js)"><\/script>/, (_, f) => {
  const js = readFileSync(join(src, f), 'utf8').replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--')
  return `<script type="module">${js}</script>`
})
html = html.replace(/<link rel="stylesheet" crossorigin href="\.\/(assets\/[^"]+\.css)">/, (_, f) => `<style>${readFileSync(join(src, f), 'utf8')}</style>`)
if (/src="\.\/assets|href="\.\/assets/.test(html)) throw new Error('还有没内联的资源')
writeFileSync(join(out, 'index.html'), html)
// 其余静态文件（如子站的 console.html）原样拷过去
for (const f of readdirSync(src)) if (f !== 'index.html' && f !== 'assets' && statSync(join(src, f)).isFile()) copyFileSync(join(src, f), join(out, f))
console.log(out, (html.length / 1048576).toFixed(1) + ' MB')
