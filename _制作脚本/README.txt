重新生成演示包（开发机上）：
子站：在前端库 origin/main 的临时 worktree 里打上「子站-演示补丁.diff」（EG 管理页按钮改为打开 ../EG/），
      放入 子站-vite.demo.config.ts，执行 VITE_API=mock npx vite build -c vite.demo.config.ts，
      再 node inline.mjs <dist-demo> <演示包>/子站
EG：  起一个带新接口的 agent（开发机旁观实例 9101 或正常 agent）与 eg-video 9110，
      node capture-v2.mjs 只读抓接口快照与样例证据（AGENT / VIDEO / RUN 环境变量可改），
      node prep.mjs snap2 整理成演示数据（开发地址换现场样式、旁观口径换正常口径），
      node build-eg.mjs <EG 库 apps/admin-web> 构建（注入 mock-eg.ts；双光画面换成样机真实帧、streamsOf 置空；不改 EG 库），
      再 node inline.mjs dist <演示包>/EG
检查：node demo-check.mjs（无头 Edge：证据回放、抓帧、事件关联录像、子站跳 EG、各页无脚本错误）
本次：子站 49cbecf（0.9.0），EG b7b1ef2（界面与 bee14c9 相同）
