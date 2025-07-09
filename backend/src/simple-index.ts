/**
 * DdalKkak Backend Server - 단순화된 버전
 * 새로운 단순화된 스키마에 맞게 구현
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

import { SimpleTenantMiddleware } from './middleware/simple-tenant';

// 환경 변수 로드
dotenv.config();

// Prisma 클라이언트 초기화
const prisma = new PrismaClient();

// Express 앱 생성
const app = express();
const server = createServer(app);

// Multi-tenant 미들웨어 초기화
const tenantMiddleware = new SimpleTenantMiddleware(prisma);

// Socket.IO 서버 설정
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3001",
    methods: ["GET", "POST"]
  }
});

const PORT = parseInt(process.env.PORT || '3500', 10);
const HOST = process.env.HOST || '0.0.0.0';

// 기본 미들웨어 설정
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3001",
  credentials: true
}));
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 헬스 체크 엔드포인트
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    database: 'connected',
    version: '1.0.0'
  });
});

// 기본 라우트
app.get('/', (req, res) => {
  res.json({ 
    message: 'DdalKkak Backend API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    features: [
      'Multi-tenant architecture',
      'Meeting transcription',
      'AI-powered task generation',
      'Real-time collaboration'
    ]
  });
});

// 데이터베이스 연결 테스트
app.get('/db-test', async (req, res) => {
  try {
    await prisma.$connect();
    const result = await prisma.$queryRaw`SELECT current_database(), current_user, version()`;
    res.json({ 
      status: 'success',
      database: result
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 개발용 테넌트 생성 및 테스트
app.post('/dev/setup-tenant', async (req, res) => {
  try {
    const tenant = await prisma.tenant.upsert({
      where: { slug: 'dev-tenant' },
      update: {},
      create: {
        name: 'Development Tenant',
        slug: 'dev-tenant'
      }
    });

    // 개발용 사용자 생성
    const user = await prisma.user.upsert({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email: 'dev@example.com'
        }
      },
      update: {},
      create: {
        tenantId: tenant.id,
        email: 'dev@example.com',
        name: 'Development User',
        role: 'OWNER'
      }
    });

    res.json({ 
      status: 'success',
      tenant,
      user
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 테넌트별 데이터 조회 테스트
app.get('/tenants/:slug/meetings', tenantMiddleware.extractTenant, async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    
    const meetings = await prisma.meeting.findMany({
      where: { tenantId },
      include: {
        host: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        tasks: {
          select: {
            id: true,
            title: true,
            status: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      status: 'success',
      tenant: req.tenant,
      meetings
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 회의 생성 테스트
app.post('/tenants/:slug/meetings', tenantMiddleware.extractTenant, async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    const { title, hostEmail } = req.body;

    if (!title || !hostEmail) {
      res.status(400).json({ error: 'Title and hostEmail are required' });
      return;
    }

    // 호스트 사용자 찾기 또는 생성
    let host = await prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId,
          email: hostEmail
        }
      }
    });

    if (!host) {
      host = await prisma.user.create({
        data: {
          tenantId,
          email: hostEmail,
          name: hostEmail.split('@')[0],
          role: 'MEMBER'
        }
      });
    }

    const meeting = await prisma.meeting.create({
      data: {
        tenantId,
        title,
        hostId: host.id,
        sttStatus: 'PENDING'
      },
      include: {
        host: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    res.json({
      status: 'success',
      meeting
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Socket.IO 연결 처리
io.on('connection', (socket) => {
  console.log(`새로운 클라이언트 연결: ${socket.id}`);

  socket.on('join-tenant', (tenantSlug: string) => {
    socket.join(`tenant:${tenantSlug}`);
    console.log(`클라이언트 ${socket.id}가 테넌트 ${tenantSlug}에 참여`);
  });

  socket.on('disconnect', () => {
    console.log(`클라이언트 연결 해제: ${socket.id}`);
  });
});

// 서버 시작
server.listen(PORT, HOST, () => {
  console.log('🚀 DdalKkak Backend Server 시작됨');
  console.log(`📍 서버 주소: http://${HOST}:${PORT}`);
  console.log(`📊 헬스 체크: http://${HOST}:${PORT}/health`);
  console.log(`🔧 개발 설정: http://${HOST}:${PORT}/dev/setup-tenant`);
  console.log(`🌍 환경: ${process.env.NODE_ENV || 'development'}`);
});

// 프로세스 종료 시 정리
process.on('SIGINT', async () => {
  console.log('\n🛑 서버 종료 중...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 서버 종료 중...');
  await prisma.$disconnect();
  process.exit(0);
});