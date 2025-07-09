/**
 * DdalKkak Backend Server with AI Integration
 * 로컬 백엔드 + Runpod AI 서버 연동
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import multer from 'multer';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

import { SimpleTenantMiddleware } from './middleware/simple-tenant';
import { AIService } from './services/ai-service';

// 환경 변수 로드
dotenv.config();

// Prisma 클라이언트 초기화
const prisma = new PrismaClient();

// Express 앱 생성
const app = express();
const server = createServer(app);

// Multi-tenant 미들웨어 초기화
const tenantMiddleware = new SimpleTenantMiddleware(prisma);

// AI 서비스 초기화
const aiService = new AIService();

// 파일 업로드 설정 (메모리 저장)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
  fileFilter: (req, file, cb) => {
    // 오디오 파일만 허용
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  }
});

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
app.get('/health', async (req, res) => {
  try {
    // AI 서버 연결 확인
    const aiConnected = await aiService.testConnection();
    
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      database: 'connected',
      ai_server: aiConnected ? 'connected' : 'disconnected',
      version: '1.0.0'
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// AI 서버 상태 확인
app.get('/ai/health', async (req, res) => {
  try {
    const health = await aiService.healthCheck();
    res.json(health);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'AI server unreachable'
    });
  }
});

// 기본 라우트
app.get('/', (req, res) => {
  res.json({ 
    message: 'DdalKkak Backend API with AI',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    features: [
      'Multi-tenant architecture',
      'Meeting transcription (WhisperX)',
      'AI-powered analysis (Qwen3)',
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

// ===== AI 관련 API 엔드포인트 =====

// 음성 파일 전사만
app.post('/api/transcribe', 
  tenantMiddleware.createDevTenant,
  upload.single('audio'), 
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No audio file provided' });
      }

      console.log(`🎤 Processing audio file: ${req.file.originalname} (${req.file.size} bytes)`);

      const result = await aiService.transcribeAudio(req.file.buffer, req.file.originalname);

      res.json(result);
    } catch (error) {
      console.error('Transcription error:', error);
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  }
);

// 텍스트 분석만
app.post('/api/analyze', 
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const { transcript } = req.body;

      if (!transcript) {
        return res.status(400).json({ error: 'No transcript provided' });
      }

      const result = await aiService.analyzeMeeting(transcript);

      res.json(result);
    } catch (error) {
      console.error('Analysis error:', error);
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  }
);

// 전체 파이프라인: 음성 → 전사 → 분석 → DB 저장
app.post('/api/process-meeting', 
  tenantMiddleware.createDevTenant,
  upload.single('audio'), 
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No audio file provided' });
      }

      const tenantId = req.tenantId!;
      const { title, hostEmail } = req.body;

      console.log(`🚀 Processing meeting: ${req.file.originalname}`);

      // AI 파이프라인 실행
      const aiResult = await aiService.processFullPipeline(req.file.buffer, req.file.originalname);

      if (!aiResult.success) {
        return res.status(500).json({
          success: false,
          error: `AI processing failed: ${aiResult.error}`,
          step: aiResult.step
        });
      }

      // 호스트 사용자 찾기 또는 생성
      let host = await prisma.user.findUnique({
        where: {
          tenantId_email: {
            tenantId,
            email: hostEmail || 'dev@example.com'
          }
        }
      });

      if (!host) {
        host = await prisma.user.create({
          data: {
            tenantId,
            email: hostEmail || 'dev@example.com',
            name: (hostEmail || 'dev@example.com').split('@')[0],
            role: 'MEMBER'
          }
        });
      }

      // 회의 레코드 생성
      const meeting = await prisma.meeting.create({
        data: {
          tenantId,
          title: title || `회의 ${new Date().toLocaleDateString()}`,
          hostId: host.id,
          audioFileUrl: `temp://uploaded/${req.file.originalname}`,
          audioDuration: Math.round(aiResult.transcription?.duration || 0),
          sttStatus: 'COMPLETED',
          transcriptText: aiResult.transcription?.full_text || '',
          transcriptSegments: aiResult.transcription?.segments || [],
          aiSummary: aiResult.analysis?.summary || '',
          aiActionItems: aiResult.analysis?.action_items || []
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

      // 업무 생성 (action_items가 있는 경우)
      if (aiResult.analysis?.action_items && Array.isArray(aiResult.analysis.action_items)) {
        const tasks = await Promise.all(
          aiResult.analysis.action_items.map(async (item: any) => {
            return prisma.task.create({
              data: {
                tenantId,
                meetingId: meeting.id,
                title: item.task || 'Untitled Task',
                description: `마감일: ${item.deadline || 'TBD'}\n우선순위: ${item.priority || 'medium'}`,
                status: 'TODO',
                priority: item.priority === 'high' ? 'HIGH' : 
                         item.priority === 'low' ? 'LOW' : 'MEDIUM',
                assigneeId: host.id, // 임시로 호스트에게 할당
                createdById: host.id
              }
            });
          })
        );

        // Socket으로 실시간 알림
        io.to(`tenant:${req.tenant?.slug}`).emit('meeting-processed', {
          meeting,
          tasks,
          analysis: aiResult.analysis
        });

        res.json({
          success: true,
          meeting,
          tasks,
          transcription: aiResult.transcription,
          analysis: aiResult.analysis
        });
      } else {
        res.json({
          success: true,
          meeting,
          tasks: [],
          transcription: aiResult.transcription,
          analysis: aiResult.analysis
        });
      }

    } catch (error) {
      console.error('Meeting processing error:', error);
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  }
);

// 테넌트별 회의 조회
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
            status: true,
            priority: true
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
  console.log('🚀 DdalKkak Backend Server with AI 시작됨');
  console.log(`📍 서버 주소: http://${HOST}:${PORT}`);
  console.log(`📊 헬스 체크: http://${HOST}:${PORT}/health`);
  console.log(`🤖 AI 헬스 체크: http://${HOST}:${PORT}/ai/health`);
  console.log(`🔧 개발 설정: http://${HOST}:${PORT}/dev/setup-tenant`);
  console.log(`🌍 환경: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 AI 서버: ${process.env.RUNPOD_AI_URL || 'http://localhost:8000'}`);
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