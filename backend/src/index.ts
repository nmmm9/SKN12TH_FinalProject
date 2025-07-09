/**
 * DdalKkak Backend Server
 * 메인 애플리케이션 진입점
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import { authMiddleware } from './middleware/auth';
import { TenantMiddleware } from './middleware/tenant';

// 환경 변수 로드
dotenv.config();

// 환경 변수 검증
import { validateAndExit } from './utils/envValidator';
validateAndExit();

// Prisma 클라이언트 초기화
const prisma = new PrismaClient();

// Express 앱 생성
const app = express();
const server = createServer(app);

// Multi-tenant 미들웨어 초기화
const tenantMiddleware = new TenantMiddleware(prisma);

// Socket.IO 서버 설정
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3001",
    methods: ["GET", "POST"]
  }
});

const PORT = parseInt(process.env.PORT || '3500', 10);
const HOST = process.env.HOST || '0.0.0.0';

// 미들웨어 설정
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3001",
  credentials: true
}));
app.use(compression());
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate Limiting
app.use(rateLimiter);

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API 라우트 (Multi-tenant 지원)
// Slack 요청 (테넌트 자동 식별)
// app.use('/api/slack', 
//   tenantMiddleware.extractTenantFromSlack,
//   tenantMiddleware.authenticateSlackUser,
//   slackRoutes
// );

// 일반 API 요청 (인증 필요)
// app.use('/api/meetings', 
//   tenantMiddleware.extractTenantFromSlack,
//   tenantMiddleware.authenticateSlackUser,
//   tenantMiddleware.checkUsageLimits,
//   tenantMiddleware.checkDataAccess('meeting', 'read'),
//   meetingRoutes
// );

// app.use('/api/tasks', 
//   tenantMiddleware.extractTenantFromSlack,
//   tenantMiddleware.authenticateSlackUser,
//   tenantMiddleware.checkDataAccess('task', 'read'),
//   taskRoutes
// );

// OAuth 인증 라우트
import authRoutes from './routes/auth';
app.use('/auth', authRoutes);

// Socket.IO 이벤트 핸들러 (실시간 STT용)
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  // 실시간 회의 시작
  socket.on('start_meeting', (data) => {
    logger.info(`Meeting started: ${data.meetingId}`);
    socket.join(data.meetingId);
  });

  // 실시간 오디오 청크 수신
  socket.on('audio_chunk', (data) => {
    // AI 엔진으로 STT 처리 전송 (추후 구현)
    logger.debug(`Audio chunk received: ${data.chunkId}`);
  });

  // 연결 해제
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// 에러 핸들러
app.use(errorHandler);

// 404 핸들러
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  });
});

// 서버 시작
server.listen(PORT, HOST, () => {
  logger.info(`🚀 DdalKkak Backend Server started on ${HOST}:${PORT}`);
  logger.info(`📊 Health check: http://${HOST}:${PORT}/health`);
  logger.info(`🔌 Socket.IO ready for real-time connections`);
});

// Graceful Shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
  });
});

export { app, io };