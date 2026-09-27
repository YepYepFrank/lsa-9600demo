// 用 EG 库 admin-web 的源码与依赖构建演示版（不改 EG 库任何文件）：main.ts 最前面注入 mock-eg.ts，打成单个 JS / CSS
// 用法：node build-eg.mjs [admin-web 目录，缺省 eg-ui-v2 的 worktree]
import { pathToFileURL, fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
const here = dirname(fileURLToPath(import.meta.url))
const ROOT = process.argv[2] || 'D:/Work Files/GWDR/lsa-9600eg-ui/apps/admin-web'
const req = p => import(pathToFileURL(resolve(ROOT, 'node_modules', p)).href)
const { build } = await req('vite/dist/node/index.js')
const vue = (await req('@vitejs/plugin-vue/dist/index.mjs')).default
const MOCK = resolve(here, 'mock-eg.ts').replace(/\\/g, '/')
const norm = id => id.replace(/\\/g, '/')
await build({
  root: ROOT,
  configFile: false,
  base: './',
  logLevel: 'warn',
  plugins: [vue(), {
    name: 'demo-mock',
    enforce: 'pre',
    transform(code, id) {
      if (norm(id).endsWith('/src/main.ts')) return `import '${MOCK}'\n` + code
      // 演示包没有实时视频：本柜画面走播放器的「示意」画面（与子站演示一致），不去连 WHEP / HLS
      // 双光画面：演示包用样机抓到的真实帧当底图（mock-eg.ts 放在 window.__DEMO_VIS / __DEMO_IR），测温区照样按摄像机坐标叠框
      if (norm(id).endsWith('/components/kit/DualLightPlayer.vue')) {
        let s = code
        const rep = (a, b) => { const n = s.replace(a, b); if (n === s) throw new Error('DualLightPlayer 演示补丁没对上：' + a); s = n }
        rep(/const live = computed\(/, 'const demoVis = (window as any).__DEMO_VIS as string\nconst demoIr = (window as any).__DEMO_IR as string\nconst live = computed(')
        rep(/<svg v-else viewBox="0 0 320 240"[\s\S]*?<\/svg>/, '<img v-else class="demo-frame" :src="demoVis" alt="可见光" />')
        rep(/<template v-if="boxLabels && showBoxes && !live && !offline && mode !== 'fusion'">/, '<template v-if="false">')
        const roi = s.match(/<div v-if="showBoxes && rois\?\.length" class="roi-layer"[\s\S]*?<\/div>\s*<\/div>/)
        if (!roi) throw new Error('DualLightPlayer 演示补丁：没找到 roi-layer')
        rep(/<canvas ref="cv" \/>\s*<template v-if="showBoxes && !offline">[\s\S]*?<\/template>/, '<img class="demo-frame" :src="demoIr" alt="热像" />\n          ' + roi[0])
        rep(/<style scoped>/, '<style scoped>\n.demo-frame{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000}')
        return s
      }
      if (norm(id).endsWith('/src/monitor.ts')) {
        const out = code.replace(/export function streamsOf\(([^)]*)\) \{/, 'export function streamsOf($1) {\n  return null')
        if (out === code) throw new Error('monitor.ts 里没找到 streamsOf，演示补丁要更新')
        return out
      }
    },
  }],
  resolve: { alias: { '@': resolve(ROOT, 'src') } },
  build: {
    target: 'chrome88', outDir: resolve(here, 'dist'), emptyOutDir: true,
    cssCodeSplit: false, assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 100_000,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
})
console.log('EG 演示版构建完成：', ROOT)
