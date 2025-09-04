const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 存储所有请求记录
let requestLogs = [];
// 存储所有SSE客户端
const clients = new Set();

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 记录请求的中间件
app.use((req, res, next) => {
  // 创建请求记录
  const requestLog = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    headers: req.headers,
    query: req.query,
    body: req.body,
    ip: req.ip,
    statusCode: null // 稍后更新
  };
  
  // 存储请求记录
  requestLogs.push(requestLog);
  
  // 限制日志数量，防止内存溢出
  if (requestLogs.length > 1000) {
    requestLogs = requestLogs.slice(-500);
  }
  
  // 重写res.end方法以获取状态码
  const originalEnd = res.end;
  res.end = function(...args) {
    requestLog.statusCode = res.statusCode;
    
    // 向所有连接的客户端发送更新
    const event = `data: ${JSON.stringify(requestLog)}\n\n`;
    clients.forEach(client => {
      client.write(event);
    });
    
    originalEnd.apply(this, args);
  };
  
  next();
});

// 日志输出到控制台
app.use(morgan('dev'));

// 提供静态文件
app.use(express.static(path.join(__dirname, 'public')));

// SSE端点 - 用于流式传输请求日志
app.get('/stream', (req, res) => {
  // 设置SSE响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders(); // 发送头信息
  
  // 将新客户端添加到集合
  clients.add(res);
  
  // 发送现有日志历史
  res.write('data: {"type": "history", "logs": ' + JSON.stringify(requestLogs) + '}\n\n');
  
  // 客户端断开连接时移除
  req.on('close', () => {
    clients.delete(res);
  });
});

// 测试端点 - 用于发送各种请求
app.get('/api/test-get', (req, res) => {
  res.json({ message: 'This is a GET response', query: req.query });
});

app.post('/api/test-post', (req, res) => {
  res.json({ message: 'This is a POST response', body: req.body });
});

// 首页路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`首页: http://localhost:${PORT}`);
  console.log(`可以发送测试请求到: http://localhost:${PORT}/api/test-get?param=1`);
  console.log(`或: http://localhost:${PORT}/api/test-post (POST方法)`);
});

// 处理未捕获的异常
process.on('uncaughtException', (err) => {
  console.error('未捕获的异常:', err);
});
