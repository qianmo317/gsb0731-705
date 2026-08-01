# English Listening Learning App (英语听力学习应用)

这是一个高性能、移动优先的英语听力学习网站，支持LRC歌词同步与断点续传。

## 技术栈
- **核心框架**: React + Tailwind CSS + Vite
- **部署**: Docker (纯静态构建)
- **特性**: 
  - 📱 移动端优先设计 (响应式布局)
  - 🎵 LRC 歌词精确同步与高亮
  - 💾 播放进度自动保存 (LocalStorage)
  - 🌑 深/浅色模式切换
  - 📦 PWA 支持 (离线访问)


## 如何运行 (How to Run)

该项目可以使用 Docker 快速启动。

```bash
docker compose up
```

启动后访问: [http://localhost:3000](http://localhost:3000)

## 功能验证
1. **播放列表**: 打开首页，点击列表中的课程（如 "Lesson 1"）。
2. **播放控制**: 底部会出现迷你播放器。点击展开全屏。
3. **歌词同步**: 播放时歌词会随进度滚动并高亮当前行。
4. **深色模式**: 点击搜索栏右侧的 🌙 按钮切换主题。
5. **断点续传**: 刷新页面，播放进度应保留。

## 静态资源
音频文件和 LRC 歌词存放在 `frontend/public/audio/` 目录中。
数据索引文件为 `frontend/public/data.json`。

## 注意事项
1. 本地导入lrc 文件需满足如下格式
```
[category: GREETINGS]
[00:04.99]1. Hello.
[00:09.14]2. Good morning.
[00:13.69]3. I'm John Smith
[00:19.57]4. Are you Bill Jones?
[00:26.12]5. Yes. I am.
[00:30.80]6. How are you?
[00:36.55]7. Fine, thanks.
[00:40.99]8. How is Helen?
[00:46.34]9. She's very well, thank you.
[00:51.20]10. Good afternoon, Mr. Green.
[00:56.56]11. Good evening, Mrs. Brown.
[01:01.41]12. How are you this evening?
[01:09.07]13. Good night, John.
[01:14.03]14. Good-bye, Bill
[01:19.60]15. See you tomorrow.

```
