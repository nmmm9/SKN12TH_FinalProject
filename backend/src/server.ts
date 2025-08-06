/**
 * TtalKkak Backend Server with AI Integration
 * Slack → AI 기획안 → 업무 생성 → 외부 연동
 */
import { Request, Response } from 'express';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import multer from 'multer';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

import { SimpleTenantMiddleware } from './middleware/tenant';
import { AIService } from './services/ai-service';
import { JiraService } from './services/jira-service';
import { SmartTaskAssigner } from './services/smart-task-assigner';

// Slack 핸들러 import
const { slackApp } = require('./slack-handler');

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

// JIRA 서비스 초기화
const jiraService = new JiraService(prisma);

// 스마트 업무 배정 서비스 초기화
const smartAssigner = new SmartTaskAssigner(prisma);

// 파일 업로드 설정 (메모리 저장)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
  fileFilter: (req, file, cb) => {
    // 오디오 파일만 허용 (M4A, MP3, WAV, WEBM 등)
    const allowedMimeTypes = [
      'audio/mpeg',
      'audio/mp3', 
      'audio/wav',
      'audio/m4a',
      'audio/mp4',
      'audio/x-m4a',
      'audio/webm',
      'audio/ogg'
    ];
    
    const allowedExtensions = ['.mp3', '.wav', '.m4a', '.mp4', '.webm', '.ogg'];
    const fileExtension = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    
    if (file.mimetype.startsWith('audio/') || 
        allowedMimeTypes.includes(file.mimetype) ||
        allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype} (${fileExtension}). Supported: MP3, WAV, M4A, WEBM, OGG`));
    }
  }
});

// Socket.IO 서버 설정
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3002",
    methods: ["GET", "POST"]
  }
});

const PORT = parseInt(process.env.PORT || '3500', 10);
const HOST = process.env.HOST || '0.0.0.0';

// 기본 미들웨어 설정
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3002",
  credentials: true
}));
app.use(compression());

// 모든 요청 로깅 (디버깅용)
app.use((req, res, next) => {
  console.log(`📨 요청: ${req.method} ${req.path}`);
  if (req.path.startsWith('/slack')) {
    console.log(`🔍 Slack 요청 상세:`, {
      method: req.method,
      path: req.path,
      userAgent: req.headers['user-agent'],
      contentType: req.headers['content-type']
    });
  }
  next();
});

// Slack 경로는 body parser를 건너뛰기
app.use((req, res, next) => {
  if (req.path.startsWith('/slack')) {
    return next();
  }
  express.json({ limit: '50mb' })(req, res, next);
});

app.use((req, res, next) => {
  if (req.path.startsWith('/slack')) {
    return next();
  }
  express.urlencoded({ extended: true, limit: '50mb' })(req, res, next);
});

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

// ===== OAuth 연동 엔드포인트 =====

// Notion OAuth 콜백 (구체적인 경로를 먼저 정의)
app.get('/auth/notion/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    
    if (error) {
      console.error('❌ Notion OAuth 오류:', error);
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3001'}/settings?notion=error&message=${encodeURIComponent(error as string)}`);
    }
    
    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state' });
    }
    
    // state 디코딩
    const stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());
    const { tenantId, userId } = stateData;
    
    console.log('🔄 Notion OAuth 콜백 처리:', { tenantId, userId });
    
    // 토큰 교환
    const tokenResponse = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.APP_URL + '/auth/notion/callback'
      })
    });
    
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('❌ Notion 토큰 교환 실패:', errorData);
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3001'}/settings?notion=error&message=token_exchange_failed`);
    }
    
    const tokens: any = await tokenResponse.json();
    console.log('✅ Notion 토큰 받음:', {
      workspace_name: tokens.workspace_name,
      bot_id: tokens.bot_id
    });
    
    // 암호화 함수 (간단한 버전)
    const encrypt = (text: string) => {
      // 실제로는 crypto 모듈 사용해야 함
      return Buffer.from(text).toString('base64');
    };
    
    // Slack 사용자 ID로 실제 User 찾기 또는 생성
    let user = await prisma.user.findFirst({
      where: {
        tenantId,
        slackUserId: userId
      }
    });

    if (!user) {
      console.log('🆕 새 사용자 생성:', { tenantId, slackUserId: userId });
      // 사용자가 없으면 새로 생성
      user = await prisma.user.create({
        data: {
          tenantId,
          slackUserId: userId,
          email: `${userId}@slack.local`, // 임시 이메일
          name: `Slack User ${userId}`,
          role: 'MEMBER'
        }
      });
    }

    console.log('👤 사용자 확인됨:', { userId: user.id, slackUserId: user.slackUserId });

    // 사용자별 토큰 저장 (실제 User UUID 사용)
    await prisma.integration.upsert({
      where: {
        tenantId_userId_serviceType: {
          tenantId,
          userId: user.id, // Slack ID가 아닌 실제 User UUID 사용
          serviceType: 'NOTION'
        }
      },
      update: {
        accessToken: encrypt(tokens.access_token),
        isActive: true,
        config: {
          workspace_name: tokens.workspace_name,
          workspace_id: tokens.workspace_id,
          bot_id: tokens.bot_id,
          owner: tokens.owner
        }
      },
      create: {
        tenantId,
        userId: user.id, // Slack ID가 아닌 실제 User UUID 사용
        serviceType: 'NOTION',
        accessToken: encrypt(tokens.access_token),
        isActive: true,
        config: {
          workspace_name: tokens.workspace_name,
          workspace_id: tokens.workspace_id,
          bot_id: tokens.bot_id,
          owner: tokens.owner
        }
      }
    });
    
    console.log('✅ Notion 연동 저장 완료');
    
    // 성공 페이지로 리다이렉트 (임시로 간단한 HTML)
    res.send(`
      <html>
        <head>
          <title>Notion 연동 완료</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
            .success { color: #28a745; font-size: 24px; margin-bottom: 20px; }
            .info { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="success">✅ Notion 연동이 완료되었습니다!</div>
          <div class="info">
            <h3>연동된 워크스페이스</h3>
            <p><strong>${tokens.workspace_name}</strong></p>
            <p>이제 TtalKkak에서 회의록을 생성하면 자동으로 Notion 페이지가 만들어집니다.</p>
          </div>
          <p>이 창을 닫고 Slack으로 돌아가세요.</p>
          <script>
            setTimeout(() => {
              window.close();
            }, 3000);
          </script>
        </body>
      </html>
    `);
    
  } catch (error) {
    console.error('❌ Notion OAuth 콜백 처리 오류:', error);
    res.status(500).json({ error: 'OAuth callback processing failed' });
  }
});

// Notion OAuth 시작
app.get('/auth/notion/:tenantSlug', async (req, res) => {
  try {
    const { tenantSlug } = req.params;
    const { userId, state } = req.query;
    
    console.log('🔍 OAuth 엔드포인트 호출됨:', {
      tenantSlug,
      userId,
      state,
      fullUrl: req.url,
      query: req.query
    });
    
    if (!userId) {
      console.error('❌ userId 파라미터가 누락됨. Slack 앱에서 버튼을 통해 접근해야 합니다.');
      return res.send(`
        <html>
          <head>
            <title>잘못된 접근</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
              .error { color: #dc3545; font-size: 24px; margin-bottom: 20px; }
              .info { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="error">❌ 잘못된 접근입니다</div>
            <div class="info">
              <h3>올바른 사용 방법</h3>
              <p>1. Slack에서 <strong>/tk start</strong> 명령어를 입력하세요</p>
              <p>2. <strong>노션 연결하기</strong> 버튼을 클릭하세요</p>
              <p>3. 브라우저에서 직접 URL에 접근하지 마세요</p>
            </div>
            <p>이 창을 닫고 Slack으로 돌아가세요.</p>
          </body>
        </html>
      `);
    }
    
    // tenantSlug에서 실제 tenant 찾기
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug }
    });
    
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    const stateData = {
      tenantId: tenant.id,
      userId: userId as string,
      timestamp: Date.now()
    };
    
    const encodedState = Buffer.from(JSON.stringify(stateData)).toString('base64');
    
    const authUrl = `https://api.notion.com/v1/oauth/authorize?` +
      `client_id=${process.env.NOTION_CLIENT_ID || 'YOUR_NOTION_CLIENT_ID'}&` +
      `response_type=code&` +
      `owner=user&` +
      `state=${encodedState}&` +
      `redirect_uri=${encodeURIComponent(process.env.APP_URL + '/auth/notion/callback')}`;
      
    console.log('🔗 Notion OAuth 시작:', {
      tenantSlug,
      userId,
      authUrl: authUrl.substring(0, 100) + '...'
    });
    
    return res.redirect(authUrl);
  } catch (error) {
    console.error('❌ Notion OAuth 시작 오류:', error);
    return res.status(500).json({ error: 'OAuth initialization failed' });
  }
});

// ===== JIRA OAuth 연동 =====

// JIRA OAuth 콜백 (구체적인 경로를 먼저 정의)
app.get('/auth/jira/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    
    if (error) {
      console.error('❌ JIRA OAuth 오류:', error);
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3001'}/settings?jira=error&message=${error}`);
    }
    
    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state' });
    }
    
    // state 디코딩
    const stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());
    const { tenantId, userId } = stateData;
    
    console.log('🔄 JIRA OAuth 콜백 처리:', { tenantId, userId });
    
    // 토큰 교환 (JIRA OAuth 2.0 3LO)
    const tokenResponse = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: process.env.JIRA_CLIENT_ID,
        client_secret: process.env.JIRA_CLIENT_SECRET,
        code,
        redirect_uri: process.env.APP_URL + '/auth/jira/callback'
      })
    });
    
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('❌ JIRA 토큰 교환 실패:', errorData);
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3001'}/settings?jira=error&message=token_exchange_failed`);
    }
    
    const tokens: any = await tokenResponse.json();
    console.log('✅ JIRA 토큰 받음:', {
      access_token: tokens.access_token ? 'received' : 'missing',
      refresh_token: tokens.refresh_token ? 'received' : 'missing'
    });
    
    // 사용자 정보 및 사이트 정보 가져오기
    const resourceResponse = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Accept': 'application/json'
      }
    });
    
    const resources: any = await resourceResponse.json();
    console.log('✅ JIRA 리소스 받음:', resources);
    
    // 암호화 함수 (간단한 버전)
    const encrypt = (text: string) => {
      return Buffer.from(text).toString('base64');
    };
    
    // Slack 사용자 ID로 실제 User 찾기 또는 생성
    let user = await prisma.user.findFirst({
      where: {
        tenantId,
        slackUserId: userId
      }
    });

    if (!user) {
      console.log('🆕 새 사용자 생성:', { tenantId, slackUserId: userId });
      user = await prisma.user.create({
        data: {
          tenantId,
          slackUserId: userId,
          email: `${userId}@slack.local`,
          name: `Slack User ${userId}`,
          role: 'MEMBER'
        }
      });
    }
    
    // 사용자별 토큰 저장
    await prisma.integration.upsert({
      where: {
        tenantId_userId_serviceType: {
          tenantId,
          userId: user.id,
          serviceType: 'JIRA'
        }
      },
      update: {
        accessToken: encrypt(tokens.access_token),
        refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
        isActive: true,
        config: {
          site: resources[0] || null,
          site_url: resources[0]?.url || null,
          site_name: resources[0]?.name || null,
          scope: tokens.scope
        }
      },
      create: {
        tenantId,
        userId: user.id,
        serviceType: 'JIRA',
        accessToken: encrypt(tokens.access_token),
        refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
        isActive: true,
        config: {
          site: resources[0] || null,
          site_url: resources[0]?.url || null,
          site_name: resources[0]?.name || null,
          scope: tokens.scope
        }
      }
    });
    
    console.log('✅ JIRA 연동 저장 완료');
    
    // 성공 페이지
    res.send(`
      <html>
        <head>
          <title>JIRA 연동 완료</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
            .success { color: #28a745; font-size: 24px; margin-bottom: 20px; }
            .info { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="success">✅ JIRA 연동이 완료되었습니다!</div>
          <div class="info">
            <h3>연동된 사이트</h3>
            <p><strong>${resources[0]?.name || 'JIRA 사이트'}</strong></p>
            <p>이제 TtalKkak에서 생성한 업무가 자동으로 JIRA 이슈로 만들어집니다.</p>
          </div>
          <p>이 창을 닫고 Slack으로 돌아가세요.</p>
          <script>
            setTimeout(() => {
              window.close();
            }, 3000);
          </script>
        </body>
      </html>
    `);
    
  } catch (error) {
    console.error('❌ JIRA OAuth 콜백 처리 오류:', error);
    res.status(500).json({ error: 'OAuth callback processing failed' });
  }
});

// JIRA OAuth 시작
app.get('/auth/jira/:tenantSlug', async (req, res) => {
  try {
    const { tenantSlug } = req.params;
    const { userId } = req.query;
    
    if (!userId) {
      console.error('❌ userId 파라미터가 누락됨. Slack 앱에서 버튼을 통해 접근해야 합니다.');
      return res.send(`
        <html>
          <head>
            <title>JIRA 연동 - 접근 오류</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
              .error { color: #dc3545; font-size: 24px; margin-bottom: 20px; }
              .info { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
              code { background: #e9ecef; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
            </style>
          </head>
          <body>
            <div class="error">⚠️ 잘못된 접근입니다</div>
            <div class="info">
              <h3>JIRA 연동 방법</h3>
              <p>이 페이지는 Slack 앱의 연동 버튼을 통해서만 접근할 수 있습니다.</p>
              <p>Slack에서 <code>/tk start</code> 명령어를 사용하여 연동을 시작해주세요.</p>
            </div>
            <p>올바른 경로로 다시 시도해주세요.</p>
          </body>
        </html>
      `);
    }
    
    // tenantSlug에서 실제 tenant 찾기
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug }
    });
    
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    const stateData = {
      tenantId: tenant.id,
      userId: userId as string,
      timestamp: Date.now()
    };
    
    const encodedState = Buffer.from(JSON.stringify(stateData)).toString('base64');
    
    // JIRA OAuth 2.0 (3LO) URL
    const authUrl = `https://auth.atlassian.com/authorize?` +
      `audience=api.atlassian.com&` +
      `client_id=${process.env.JIRA_CLIENT_ID || 'YOUR_JIRA_CLIENT_ID'}&` +
      `scope=read%3Ajira-user%20read%3Ajira-work%20write%3Ajira-work%20manage%3Ajira-project%20manage%3Ajira-configuration%20offline_access&` +
      `redirect_uri=${encodeURIComponent(process.env.APP_URL + '/auth/jira/callback')}&` +
      `state=${encodedState}&` +
      `response_type=code&` +
      `prompt=consent`;
      
    console.log('🔗 JIRA OAuth 시작:', {
      tenantSlug,
      userId,
      authUrl: authUrl.substring(0, 100) + '...'
    });
    
    return res.redirect(authUrl);
  } catch (error) {
    console.error('❌ JIRA OAuth 시작 오류:', error);
    return res.status(500).json({ error: 'OAuth initialization failed' });
  }
});

// JIRA OAuth 콜백 (중복 제거됨 - 위의 구현 사용)


// ===== 프론트엔드 API 엔드포인트 (기존 OAuth 엔드포인트들 뒤에 추가) =====

// 대시보드 통계 API
app.get('/api/dashboard/stats', 
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      
      // 기본 통계 조회
      const [totalMeetings, totalTasks, completedTasks] = await Promise.all([
        prisma.slackInput.count({ where: { tenantId } }),
        prisma.task.count({ where: { tenantId } }),
        prisma.task.count({ where: { tenantId, status: 'DONE' } })
      ]);

      const inProgressTasks = await prisma.task.count({ 
        where: { tenantId, status: 'IN_PROGRESS' } 
      });
      
      const scheduledTasks = await prisma.task.count({ 
        where: { tenantId, status: 'TODO' } 
      });

      res.json({
        totalMeetings,
        averageProcessingTime: 20, // 임시값
        accuracy: 95, // 임시값
        completedTasks,
        inProgressTasks,
        scheduledTasks
      });
    } catch (error) {
      console.error('Dashboard stats error:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
  }
);

// 최근 활동 조회 API
app.get('/api/dashboard/recent-activities', 
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      
      const activities = await prisma.slackInput.findMany({
        where: { tenantId },
        include: {
          projects: {
            select: { id: true, title: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      });

      res.json(activities);
    } catch (error) {
      console.error('Recent activities error:', error);
      res.status(500).json({ error: 'Failed to fetch recent activities' });
    }
  }
);

// 프로젝트 목록 조회 API
app.get('/api/projects', 
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      console.log('🔍 tenantId:', tenantId);
      
      // 1단계: 기본 프로젝트만 조회
      const basicProjects = await prisma.project.findMany({
        where: { tenantId }
      });
      console.log('📊 기본 프로젝트 수:', basicProjects.length);
      
      // 2단계: include 없이 tasks만 조회
      const projectsWithTasks = await prisma.project.findMany({
        where: { tenantId },
        include: {
          tasks: true
        }
      });
      console.log('📋 업무 포함 프로젝트:', projectsWithTasks.length);
      
      // 3단계: 전체 include로 조회
      const fullProjects = await prisma.project.findMany({
        where: { tenantId },
        include: {
          tasks: {
            include: {
              assignee: { select: { id: true, name: true, email: true } },
              metadata: true
            },
            orderBy: { taskNumber: 'asc' }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      console.log('🎯 전체 include 프로젝트:', fullProjects.length);
      
      return res.json(fullProjects);

    } catch (error) {
      console.error('❌ Projects fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch projects' });
    }
  }
);

// 프로젝트 상세 조회 API
app.get('/api/projects/:id', 
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      
      const project = await prisma.project.findFirst({
        where: { id: id!, tenantId },
        include: {
          slackInput: true,
          tasks: {
            include: {
              assignee: {
                select: { id: true, name: true, email: true }
              },
              metadata: true
            },
            orderBy: { taskNumber: 'asc' }
          }
        }
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      return res.json(project);
    } catch (error) {
      console.error('Project fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch project' });
    }
  }
);

// 업무 목록 조회 API
app.get('/api/tasks', 
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      const { status, assigneeId, priority } = req.query;
      
      const where: any = { tenantId };
      if (status) where.status = status;
      if (assigneeId) where.assigneeId = assigneeId;
      if (priority) where.priority = priority;

      const tasks = await prisma.task.findMany({
        where,
        include: {
          assignee: {
            select: { id: true, name: true, email: true }
          },
          metadata: {
            select: {
              estimatedHours: true,
              actualHours: true,
              requiredSkills: true,
              taskType: true,
              jiraIssueKey: true
            }
          },
          children: {
            include: {
              assignee: {
                select: { id: true, name: true, email: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return res.json(tasks);
    } catch (error) {
      console.error('Tasks fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  }
);

// 업무 상세 조회 API
app.get('/api/tasks/:id', 
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      
      const task = await prisma.task.findFirst({
        where: { id: id!, tenantId },
        include: {
          assignee: {
            select: { id: true, name: true, email: true }
          },
          metadata: true,
          children: {
            include: {
              assignee: {
                select: { id: true, name: true, email: true }
              }
            }
          },
          parent: {
            select: { id: true, title: true, taskNumber: true }
          }
        }
      });

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      return res.json(task);
    } catch (error) {
      console.error('Task fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch task' });
    }
  }
);

// 업무 상태 업데이트 API
app.patch('/api/tasks/:id/status', 
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const tenantId = req.tenantId!;

      const task = await prisma.task.updateMany({
        where: { id: id!, tenantId },
        data: { status }
      });

      if (task.count === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }

      return res.json({ success: true, message: 'Task status updated' });
    } catch (error) {
      console.error('Task status update error:', error);
      return res.status(500).json({ error: 'Failed to update task status' });
    }
  }
);

// 업무 배정 API
app.patch('/api/tasks/:id/assign', 
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { assigneeId } = req.body;
      const tenantId = req.tenantId!;

      const task = await prisma.task.updateMany({
        where: { id: id!, tenantId },
        data: { assigneeId }
      });

      if (task.count === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }

      return res.json({ success: true, message: 'Task assigned successfully' });
    } catch (error) {
      console.error('Task assignment error:', error);
      return res.status(500).json({ error: 'Failed to assign task' });
    }
  }
);

// 업무 생성 API
app.post('/api/tasks',
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      const { 
        title, 
        description, 
        status = 'TODO', 
        priority = 'MEDIUM',
        dueDate,
        assigneeId,
        projectId 
      } = req.body;

      // 프로젝트 ID 확인 (필수)
      if (!projectId) {
        return res.status(400).json({ error: 'Project ID is required' });
      }

      // 프로젝트 존재 확인
      const project = await prisma.project.findFirst({
        where: { id: projectId, tenantId }
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // 태스크 번호 생성
      const taskCount = await prisma.task.count({
        where: { tenantId }
      });
      const taskNumber = `TASK-${taskCount + 1}`;

      // 새 업무 생성
      const newTask = await prisma.task.create({
        data: {
          tenantId,
          projectId,
          title,
          description,
          status,
          priority,
          dueDate: dueDate ? new Date(dueDate) : null,
          assigneeId: assigneeId || null,
          taskNumber
        },
        include: {
          assignee: true,
          project: true,
          metadata: true
        }
      });

      return res.status(201).json(newTask);
    } catch (error) {
      console.error('Task creation error:', error);
      return res.status(500).json({ error: 'Failed to create task' });
    }
  }
);

// 업무 수정 API
app.patch('/api/tasks/:id',
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const { 
        title, 
        description, 
        status, 
        priority,
        dueDate,
        assigneeId
      } = req.body;

      // 업무 존재 확인
      const existingTask = await prisma.task.findFirst({
        where: { 
          id: id as string, 
          tenantId 
        }
      });

      if (!existingTask) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // 업무 수정
      const updatedTask = await prisma.task.update({
        where: { id: id as string },
        data: {
          title: title ?? existingTask.title,
          description: description !== undefined ? description : existingTask.description,
          status: status ?? existingTask.status,
          priority: priority ?? existingTask.priority,
          dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : existingTask.dueDate,
          assigneeId: assigneeId !== undefined ? assigneeId : existingTask.assigneeId,
          completedAt: status === 'DONE' ? new Date() : null
        },
        include: {
          assignee: true,
          project: true,
          metadata: true
        }
      });

      return res.json(updatedTask);
    } catch (error) {
      console.error('Task update error:', error);
      return res.status(500).json({ error: 'Failed to update task' });
    }
  }
);

// 업무 삭제 API
app.delete('/api/tasks/:id',
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;

      // 업무 존재 확인
      const existingTask = await prisma.task.findFirst({
        where: { 
          id: id as string, 
          tenantId 
        }
      });

      if (!existingTask) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // 하위 태스크가 있는지 확인
      const childTasks = await prisma.task.count({
        where: { 
          parentId: id as string, 
          tenantId 
        }
      });

      if (childTasks > 0) {
        return res.status(400).json({ 
          error: 'Cannot delete task with subtasks. Please delete subtasks first.' 
        });
      }

      // 업무 삭제
      await prisma.task.delete({
        where: { id: id as string }
      });

      return res.status(204).send();
    } catch (error) {
      console.error('Task deletion error:', error);
      return res.status(500).json({ error: 'Failed to delete task' });
    }
  }
);

// 사용자 목록 조회 API
app.get('/api/users', 
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      
      const users = await prisma.user.findMany({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          skills: true,
          availableHours: true,
          experienceLevel: true
        },
        orderBy: { name: 'asc' }
      });

      return res.json(users);
    } catch (error) {
      console.error('Users fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }
  }
);

// 사용자 생성 API
app.post('/api/users',
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      const { name, email, role = 'MEMBER', skills = [], availableHours = 40, experienceLevel = 'junior' } = req.body;

      // 필수 필드 검증
      if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required' });
      }

      // 이메일 중복 검사
      const existingUser = await prisma.user.findFirst({
        where: { tenantId, email }
      });

      if (existingUser) {
        return res.status(409).json({ error: 'User with this email already exists' });
      }

      // 새 사용자 생성
      const newUser = await prisma.user.create({
        data: {
          tenantId,
          name,
          email,
          role,
          skills,
          availableHours,
          experienceLevel
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          skills: true,
          availableHours: true,
          experienceLevel: true
        }
      });

      console.log(`✅ 새 사용자 생성됨: ${name} (${email}) - Tenant: ${tenantId}`);
      
      return res.status(201).json(newUser);
    } catch (error) {
      console.error('User creation error:', error);
      return res.status(500).json({ error: 'Failed to create user' });
    }
  }
);

// 사용자 수정 API
app.patch('/api/users/:id',
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const { name, email, role, skills, availableHours, experienceLevel } = req.body;

      // 사용자 존재 확인
      const existingUser = await prisma.user.findFirst({
        where: { id: id as string, tenantId }
      });

      if (!existingUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      // 이메일 중복 검사 (다른 사용자와의 중복)
      if (email && email !== existingUser.email) {
        const emailExists = await prisma.user.findFirst({
          where: { 
            tenantId, 
            email, 
            id: { not: id as string } 
          }
        });

        if (emailExists) {
          return res.status(409).json({ error: 'Email already exists' });
        }
      }

      // 사용자 정보 업데이트
      const updatedUser = await prisma.user.update({
        where: { id: id as string },
        data: {
          name: name ?? existingUser.name,
          email: email ?? existingUser.email,
          role: role ?? existingUser.role,
          skills: skills ?? existingUser.skills,
          availableHours: availableHours ?? existingUser.availableHours,
          experienceLevel: experienceLevel ?? existingUser.experienceLevel
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          skills: true,
          availableHours: true,
          experienceLevel: true
        }
      });

      console.log(`✅ 사용자 정보 업데이트됨: ${updatedUser.name} - Tenant: ${tenantId}`);
      
      return res.json(updatedUser);
    } catch (error) {
      console.error('User update error:', error);
      return res.status(500).json({ error: 'Failed to update user' });
    }
  }
);

// 사용자 삭제 API
app.delete('/api/users/:id',
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;

      // 사용자 존재 확인
      const existingUser = await prisma.user.findFirst({
        where: { id: id as string, tenantId }
      });

      if (!existingUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      // 할당된 작업이 있는지 확인
      const assignedTasks = await prisma.task.count({
        where: { assigneeId: id as string, tenantId }
      });

      if (assignedTasks > 0) {
        return res.status(400).json({ 
          error: 'Cannot delete user with assigned tasks. Please reassign tasks first.',
          assignedTasksCount: assignedTasks
        });
      }

      // 사용자 삭제
      await prisma.user.delete({
        where: { id: id as string }
      });

      console.log(`✅ 사용자 삭제됨: ${existingUser.name} - Tenant: ${tenantId}`);
      
      return res.status(204).send();
    } catch (error) {
      console.error('User deletion error:', error);
      return res.status(500).json({ error: 'Failed to delete user' });
    }
  }
);

// 현재 사용자 정보 조회 API
app.get('/api/users/me', 
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      
      // 임시로 첫 번째 사용자 반환 (실제로는 JWT에서 사용자 ID 추출)
      const user = await prisma.user.findFirst({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          skills: true,
          availableHours: true,
          experienceLevel: true
        }
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json(user);
    } catch (error) {
      console.error('Current user fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch current user' });
    }
  }
);

// Slack 입력 기록 조회 API
app.get('/api/slack/inputs', 
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      
      const inputs = await prisma.slackInput.findMany({
        where: { tenantId },
        include: {
          projects: {
            select: { id: true, title: true, overview: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      res.json(inputs);
    } catch (error) {
      console.error('Slack inputs fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch slack inputs' });
    }
  }
);

// 연동 상태 조회 API
app.get('/api/integrations/status', 
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      
      const integrations = await prisma.integration.findMany({
        where: { tenantId, isActive: true },
        select: { serviceType: true }
      });

      const status = {
        slack: integrations.some(i => i.serviceType === 'SLACK'),
        notion: integrations.some(i => i.serviceType === 'NOTION'),
        jira: integrations.some(i => i.serviceType === 'JIRA')
      };

      return res.json(status);
    } catch (error) {
      console.error('Integration status error:', error);
      return res.status(500).json({ 
        slack: false, 
        notion: false, 
        jira: false 
      });
    }
  }
);

// 연동 해지 API
app.delete('/api/integrations/:service',
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const { service } = req.params;
      const tenantId = req.tenantId!;

      // 서비스 파라미터 검증
      if (!service) {
        return res.status(400).json({ error: 'Service parameter is required' });
      }

      // 서비스 타입 검증
      const serviceType = service.toUpperCase();
      if (!['SLACK', 'NOTION', 'JIRA'].includes(serviceType)) {
        return res.status(400).json({ error: 'Invalid service type' });
      }

      // 해당 서비스의 모든 연동 비활성화
      const result = await prisma.integration.updateMany({
        where: {
          tenantId,
          serviceType: serviceType as 'SLACK' | 'NOTION' | 'JIRA',
          isActive: true
        },
        data: {
          isActive: false
        }
      });

      if (result.count === 0) {
        return res.status(404).json({ 
          error: 'No active integration found for this service' 
        });
      }

      console.log(`✅ ${serviceType} 연동 해지됨 (Tenant: ${tenantId})`);
      
      return res.json({ 
        success: true, 
        message: `${service} integration has been disconnected`,
        disconnectedCount: result.count
      });

    } catch (error) {
      console.error('Integration disconnection error:', error);
      return res.status(500).json({ 
        error: 'Failed to disconnect integration' 
      });
    }
  }
);

// OAuth 인증 라우트들
// Slack OAuth 인증
app.get('/auth/slack/:tenant', (req, res) => {
  const { tenant } = req.params;
  
  // 실제 Slack OAuth URL로 리다이렉트 (임시로 성공 페이지로)
  const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3002'}/integration?slack=connected&tenant=${tenant}`;
  
  // 임시로 바로 성공 상태로 리다이렉트 (실제로는 Slack OAuth 플로우)
  res.redirect(redirectUrl);
});

// Notion OAuth 인증
app.get('/auth/notion/:tenant', (req, res) => {
  const { tenant } = req.params;
  
  const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3002'}/integration?notion=connected&tenant=${tenant}`;
  res.redirect(redirectUrl);
});

// Jira OAuth 인증
app.get('/auth/jira/:tenant', (req, res) => {
  const { tenant } = req.params;
  
  const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3002'}/integration?jira=connected&tenant=${tenant}`;
  res.redirect(redirectUrl);
});

// 샘플 데이터 생성 API (개발용)
app.post('/api/dev/create-sample-data',
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const tenantId = req.tenantId!;

      // 샘플 SlackInput 먼저 생성
      const sampleSlackInput = await prisma.slackInput.create({
        data: {
          tenantId,
          slackChannelId: 'C1234567890',
          slackUserId: 'U1234567890',
          inputType: 'TEXT',
          content: '웹 대시보드 개발 프로젝트를 시작하겠습니다.',
          status: 'COMPLETED'
        }
      });

      // 샘플 프로젝트 생성
      const sampleProject = await prisma.project.create({
        data: {
          title: '웹 대시보드 개발',
          overview: '사용자 친화적인 웹 대시보드 구축 프로젝트',
          content: {
            summary: '프로젝트 진행상황 및 이슈 논의',
            actionItems: [
              { title: 'UI 개선안 마무리', assignee: '김미정', dueDate: '2025-01-22' },
              { title: 'API 문서화 완료', assignee: '이준호', dueDate: '2025-01-20' },
            ]
          },
          tenantId,
          slackInputId: sampleSlackInput.id,
          notionPageUrl: 'https://notion.so/sample-project'
        }
      });

      // 샘플 태스크들 생성
      const sampleTasks = [
        {
          title: 'UI 디자인 시스템 구축',
          description: '컴포넌트 라이브러리 및 디자인 가이드라인 작성',
          status: 'IN_PROGRESS' as const,
          priority: 'HIGH' as const,
          dueDate: new Date('2025-02-15'),
          taskNumber: 'WD-001',
          projectId: sampleProject.id,
          tenantId
        },
        {
          title: 'API 엔드포인트 개발',
          description: 'RESTful API 설계 및 구현',
          status: 'TODO' as const,
          priority: 'MEDIUM' as const,
          dueDate: new Date('2025-02-20'),
          taskNumber: 'WD-002',
          projectId: sampleProject.id,
          tenantId
        },
        {
          title: '사용자 인증 시스템',
          description: 'JWT 기반 로그인/로그아웃 기능',
          status: 'DONE' as const,
          priority: 'HIGH' as const,
          dueDate: new Date('2025-01-10'),
          taskNumber: 'WD-003',
          projectId: sampleProject.id,
          tenantId
        }
      ];

      await prisma.task.createMany({
        data: sampleTasks
      });

      console.log(`✅ 샘플 데이터 생성됨 - Tenant: ${tenantId}`);
      
      return res.json({ 
        success: true, 
        message: 'Sample data created successfully',
        data: {
          project: sampleProject,
          tasksCount: sampleTasks.length
        }
      });

    } catch (error) {
      console.error('Sample data creation error:', error);
      return res.status(500).json({ error: 'Failed to create sample data' });
    }
  }
);

// Slack 음성 처리 API (프론트엔드용)
app.post('/api/slack/process-audio', 
  tenantMiddleware.createDevTenant,
  upload.single('audio'), 
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          message: 'No audio file provided' 
        });
      }

      // 기존 전체 파이프라인 로직 재사용
      const result = {
        success: true,
        message: '음성 파일이 성공적으로 처리되었습니다.',
        projectId: 'temp-project-id' // 실제로는 생성된 프로젝트 ID
      };

      return res.json(result);
    } catch (error) {
      console.error('Audio processing error:', error);
      return res.status(500).json({ 
        success: false, 
        message: '음성 처리 중 오류가 발생했습니다.' 
      });
    }
  }
);





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
      'Slack integration',
      'AI-powered project planning (Qwen3)',
      'Voice/Text transcription (WhisperX)',
      'Task Master compatible tasks',
      'Notion auto-upload',
      'JIRA synchronization',
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

// ===== 팀원 관리 API 엔드포인트 =====

// 팀원 기술 정보 수집 (프로젝트 시작 시)
app.post('/api/team/collect-skills', 
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      const { teamMembers } = req.body;

      if (!teamMembers || !Array.isArray(teamMembers)) {
        return res.status(400).json({ error: 'Team members data required' });
      }

      const updatedUsers = [];
      for (const member of teamMembers) {
        const user = await prisma.user.upsert({
          where: {
            tenantId_email: {
              tenantId,
              email: member.email
            }
          },
          update: {
            name: member.name,
            skills: member.skills || [],
            availableHours: member.availableHours || 40,
            preferredTypes: member.preferredTypes || [],
            experienceLevel: member.experienceLevel || 'junior'
          },
          create: {
            tenantId,
            email: member.email,
            name: member.name,
            role: 'MEMBER',
            skills: member.skills || [],
            availableHours: member.availableHours || 40,
            preferredTypes: member.preferredTypes || [],
            experienceLevel: member.experienceLevel || 'junior'
          }
        });
        updatedUsers.push(user);
      }

      return res.json({
        success: true,
        message: `${updatedUsers.length}명의 팀원 정보가 업데이트되었습니다.`,
        users: updatedUsers
      });
    } catch (error) {
      console.error('Team skills collection error:', error);
      return res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  }
);

// 업무 배정 분석 API
app.get('/api/assignment/analysis/:taskId', 
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const { taskId } = req.params;

      const assignmentLog = await prisma.taskAssignmentLog.findFirst({
        where: { taskId: taskId! },
        include: {
          task: {
            select: {
              title: true,
              assignee: {
                select: { name: true, email: true }
              }
            }
          },
          user: {
            select: { name: true, email: true }
          }
        },
        orderBy: { assignedAt: 'desc' }
      });

      if (!assignmentLog) {
        return res.status(404).json({ error: 'Assignment log not found' });
      }

      return res.json({
        success: true,
        assignment: assignmentLog
      });
    } catch (error) {
      console.error('Assignment analysis error:', error);
      return res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  }
);

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

      return res.json(result);
    } catch (error) {
      console.error('Transcription error:', error);
      return res.status(500).json({ 
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

      return res.json(result);
    } catch (error) {
      console.error('Analysis error:', error);
      return res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  }
);

// Slack 입력 처리: 음성/텍스트 → 전사 → 분석 → 프로젝트 생성
app.post('/api/process-slack-input', 
  tenantMiddleware.createDevTenant,
  upload.single('audio'), 
  async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      const { slackChannelId, slackUserId, content, inputType = 'TEXT' } = req.body;

      // Slack 입력 데이터 저장
      const slackInput = await prisma.slackInput.create({
        data: {
          tenantId,
          slackChannelId: slackChannelId || 'C1234567890',
          slackUserId: slackUserId || 'U1234567890',
          inputType: inputType as 'VOICE' | 'TEXT',
          content: content || 'Sample meeting content',
          status: 'RECEIVED'
        }
      });

      // 음성 파일이 있으면 전사 처리
      let transcription = null;
      if (req.file && inputType === 'VOICE') {
        console.log(`🎤 Processing voice input: ${req.file.originalname}`);
        slackInput.status = 'PROCESSING';
        await prisma.slackInput.update({
          where: { id: slackInput.id },
          data: { status: 'PROCESSING' }
        });

        const transcribeResult = await aiService.transcribeAudio(req.file.buffer, req.file.originalname);
        if (transcribeResult.success) {
          transcription = transcribeResult.transcription;
          await prisma.slackInput.update({
            where: { id: slackInput.id },
            data: { content: transcription?.full_text || content }
          });
        }
      }

      // AI 기획안 생성
      const finalContent = transcription?.full_text || content;
      const aiResult = await aiService.generateNotionProject(finalContent);

      if (!aiResult.success) {
        await prisma.slackInput.update({
          where: { id: slackInput.id },
          data: { status: 'FAILED' }
        });
        return res.status(500).json({
          success: false,
          error: `AI processing failed: ${aiResult.error}`
        });
      }

      // 프로젝트 생성
      const project = await prisma.project.create({
        data: {
          tenantId,
          slackInputId: slackInput.id,
          title: aiResult.notion_project?.title || 'AI Generated Project',
          overview: aiResult.notion_project?.overview || '',
          content: aiResult.notion_project || {},
          notionStatus: 'pending'
        }
      });

      // Slack 입력 완료 처리
      await prisma.slackInput.update({
        where: { id: slackInput.id },
        data: { status: 'COMPLETED' }
      });

      // Socket으로 실시간 알림
      io.to(`tenant:${req.tenant?.slug}`).emit('slack-input-processed', {
        slackInput,
        project,
        transcription,
        aiResult: aiResult.notion_project
      });

      return res.json({
        success: true,
        slackInput,
        project,
        transcription,
        aiResult: aiResult.notion_project
      });

    } catch (error) {
      console.error('Slack input processing error:', error);
      return res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  }
);

// 테넌트별 프로젝트 조회
app.get('/tenants/:slug/projects', tenantMiddleware.extractTenant, async (req, res) => {
  try {
    const tenantId = req.tenantId!;
    
    const projects = await prisma.project.findMany({
      where: { tenantId },
      include: {
        slackInput: {
          select: {
            id: true,
            slackChannelId: true,
            slackUserId: true,
            inputType: true,
            status: true,
            createdAt: true
          }
        },
        tasks: {
          select: {
            id: true,
            taskNumber: true,
            title: true,
            status: true,
            priority: true,
            complexity: true,
            dueDate: true,
            assignee: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            metadata: {
              select: {
                estimatedHours: true,
                taskType: true,
                assignmentScore: true,
                jiraIssueKey: true,
                jiraStatus: true
              }
            }
          },
          orderBy: { taskNumber: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      status: 'success',
      tenant: req.tenant,
      projects
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ===== 2단계 AI 파이프라인 엔드포인트 =====

// 노션 프로젝트 생성
app.post('/api/generate-notion-project', 
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const { transcript } = req.body;

      if (!transcript) {
        return res.status(400).json({ error: 'No transcript provided' });
      }

      const result = await aiService.generateNotionProject(transcript);

      return res.json(result);
    } catch (error) {
      console.error('Notion project generation error:', error);
      return res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  }
);

// Task Master PRD 생성
app.post('/api/generate-prd', 
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const { notion_project } = req.body;

      if (!notion_project) {
        return res.status(400).json({ error: 'No notion project provided' });
      }

      const result = await aiService.generateTaskMasterPRD(notion_project);

      return res.json(result);
    } catch (error) {
      console.error('PRD generation error:', error);
      return res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  }
);

// 업무 생성
app.post('/api/generate-tasks', 
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const { prd } = req.body;

      if (!prd) {
        return res.status(400).json({ error: 'No PRD provided' });
      }

      const result = await aiService.generateTasks(prd);

      return res.json(result);
    } catch (error) {
      console.error('Task generation error:', error);
      return res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  }
);

// 전체 파이프라인: Slack 입력 → 기획안 → PRD → 업무 생성 → Notion 업로드
app.post('/api/process-slack-full-pipeline', 
  tenantMiddleware.createDevTenant,
  upload.single('audio'), 
  async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      const { slackChannelId, slackUserId, content, inputType = 'TEXT', userEmail } = req.body;

      console.log(`🚀 Processing full pipeline for Slack input`);

      // 사용자 찾기 또는 생성
      let user = await prisma.user.findUnique({
        where: {
          tenantId_email: {
            tenantId,
            email: userEmail || 'dev@example.com'
          }
        }
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            tenantId,
            email: userEmail || 'dev@example.com',
            name: (userEmail || 'dev@example.com').split('@')[0],
            role: 'MEMBER',
            skills: ['AI', 'Project Management']
          }
        });
      }

      // Slack 입력 저장
      const slackInput = await prisma.slackInput.create({
        data: {
          tenantId,
          slackChannelId: slackChannelId || 'C1234567890',
          slackUserId: slackUserId || 'U1234567890',
          inputType: inputType as 'VOICE' | 'TEXT',
          content: content || 'Sample project content',
          status: 'PROCESSING'
        }
      });

      // 음성 파일 처리
      let transcription = null;
      let finalContent = content;
      if (req.file && inputType === 'VOICE') {
        const transcribeResult = await aiService.transcribeAudio(req.file.buffer, req.file.originalname);
        if (transcribeResult.success) {
          transcription = transcribeResult.transcription;
          finalContent = transcription?.full_text || content;
          await prisma.slackInput.update({
            where: { id: slackInput.id },
            data: { content: finalContent }
          });
        }
      }

      // 2단계 AI 파이프라인 실행
      const aiResult = await aiService.processTwoStagePipeline(
        req.file?.buffer || Buffer.from(finalContent),
        req.file?.originalname || 'text-input.txt'
      );

      if (!aiResult.success) {
        await prisma.slackInput.update({
          where: { id: slackInput.id },
          data: { status: 'FAILED' }
        });
        return res.status(500).json({
          success: false,
          error: `AI processing failed: ${aiResult.error}`,
          step: aiResult.step
        });
      }

      // 프로젝트 생성
      const project = await prisma.project.create({
        data: {
          tenantId,
          slackInputId: slackInput.id,
          title: aiResult.notion_project?.title || 'AI Generated Project',
          overview: aiResult.notion_project?.overview || '',
          content: {
            notion_project: aiResult.notion_project,
            prd: aiResult.prd,
            generated_tasks: aiResult.tasks
          },
          notionStatus: 'pending'
        }
      });

      // Task Master 스타일로 업무 생성
      let tasks: any[] = [];
      if (aiResult.tasks && Array.isArray(aiResult.tasks)) {
        const taskCreationPromises = aiResult.tasks.map(async (taskItem: any, index: number) => {
          const taskNumber = taskItem.taskNumber || `${index + 1}`;
          const parentTaskNumber = taskNumber.includes('.') ? taskNumber.split('.')[0] : null;
          
          let parentTask = null;
          if (parentTaskNumber) {
            parentTask = await prisma.task.findFirst({
              where: { 
                tenantId, 
                projectId: project.id,
                taskNumber: parentTaskNumber
              }
            });
          }

          // 스마트 업무 배정 알고리즘 적용
          const task = {
            id: '',
            title: taskItem.title || 'Untitled Task',
            description: taskItem.description || '',
            complexity: taskItem.complexity || 'medium',
            estimatedHours: taskItem.estimated_hours || 0,
            priority: taskItem.priority === 'high' ? 'HIGH' : 
                     taskItem.priority === 'low' ? 'LOW' : 'MEDIUM',
            requiredSkills: taskItem.required_skills || [],
            taskType: taskItem.task_type || 'development'
          };

          // 최적 담당자 찾기
          const assignmentResult = await smartAssigner.assignBestUser(task, tenantId);
          const assigneeId = assignmentResult?.userId || user.id;

          const createdTask = await prisma.task.create({
            data: {
              tenantId,
              projectId: project.id,
              taskNumber,
              title: taskItem.title || 'Untitled Task',
              description: `${taskItem.description || ''}\n\n복잡도: ${taskItem.complexity || 'medium'}\n예상 시간: ${taskItem.estimated_hours || 0}시간\n\n수락 기준:\n${taskItem.acceptance_criteria?.join('\n') || ''}`,
              status: 'TODO',
              priority: taskItem.priority === 'high' ? 'HIGH' : 
                       taskItem.priority === 'low' ? 'LOW' : 'MEDIUM',
              assigneeId,
              parentId: parentTask?.id || null,
              complexity: taskItem.complexity || 'medium',
              metadata: {
                create: {
                  estimatedHours: taskItem.estimated_hours || 0,
                  requiredSkills: taskItem.required_skills || [],
                  taskType: taskItem.task_type || 'development',
                  assignmentScore: assignmentResult?.score || null,
                  assignmentReason: assignmentResult?.reason || null,
                  jiraStatus: 'pending'
                }
              }
            }
          });

          // 배정 로그 저장
          if (assignmentResult) {
            await smartAssigner.logAssignment(assignmentResult, createdTask.id);
          }

          return createdTask;
        });

        tasks = await Promise.all(taskCreationPromises);
      }

      // Slack 입력 완료 처리
      await prisma.slackInput.update({
        where: { id: slackInput.id },
        data: { status: 'COMPLETED' }
      });

      // Socket으로 실시간 알림
      io.to(`tenant:${req.tenant?.slug}`).emit('slack-pipeline-completed', {
        slackInput,
        project,
        tasks,
        transcription,
        notion_project: aiResult.notion_project,
        prd: aiResult.prd,
        generated_tasks: aiResult.tasks
      });

      return res.json({
        success: true,
        slackInput,
        project,
        tasks,
        transcription,
        notion_project: aiResult.notion_project,
        prd: aiResult.prd,
        generated_tasks: aiResult.tasks
      });

    } catch (error) {
      console.error('Full Slack pipeline processing error:', error);
      return res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  }
);

// ===== 지라 연동 엔드포인트 =====

// 지라 연결 상태 확인
app.get('/api/jira/status', 
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      const userId: string = req.body.userId || 'dev-user'; // 임시 사용자 ID

      const status = await jiraService.checkJiraConnection(tenantId, userId);
      
      return res.json(status);
    } catch (error) {
      console.error('JIRA status check error:', error);
      return res.status(500).json({ 
        connected: false,
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  }
);

// 단일 업무를 지라로 동기화
app.post('/api/jira/sync-task/:taskId', 
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const { taskId } = req.params;
      const userId: string = req.body.userId || 'dev-user';

      const jiraKey = await jiraService.syncTaskToJira(taskId!, userId);
      
      return res.json({
        success: true,
        jiraKey,
        message: `Task synchronized to JIRA as ${jiraKey}`
      });
    } catch (error) {
      console.error('JIRA task sync error:', error);
      return res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  }
);

// 프로젝트의 모든 업무를 지라로 동기화
app.post('/api/jira/sync-project/:projectId', 
  tenantMiddleware.createDevTenant,
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const userId: string = req.body.userId || 'dev-user';

      const results = await jiraService.syncProjectTasksToJira(projectId!, userId);
      
      const successCount = results.filter((r: any) => r.success).length;
      const failureCount = results.filter((r: any) => !r.success).length;

      return res.json({
        success: true,
        results,
        summary: {
          total: results.length,
          succeeded: successCount,
          failed: failureCount
        }
      });
    } catch (error) {
      console.error('JIRA project sync error:', error);
      return res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  }
);

// 전체 파이프라인 + JIRA 자동 동기화
app.post('/api/process-slack-with-jira', 
  tenantMiddleware.createDevTenant,
  upload.single('audio'), 
  async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      const { slackChannelId, slackUserId, content, inputType = 'TEXT', userEmail, autoSyncJira = true } = req.body;

      console.log(`🚀 Processing Slack input with JIRA sync`);

      // 사용자 찾기 또는 생성
      let user = await prisma.user.findUnique({
        where: {
          tenantId_email: {
            tenantId,
            email: userEmail || 'dev@example.com'
          }
        }
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            tenantId,
            email: userEmail || 'dev@example.com',
            name: (userEmail || 'dev@example.com').split('@')[0],
            role: 'MEMBER',
            skills: ['AI', 'Project Management']
          }
        });
      }

      // Slack 입력 저장
      const slackInput = await prisma.slackInput.create({
        data: {
          tenantId,
          slackChannelId: slackChannelId || 'C1234567890',
          slackUserId: slackUserId || 'U1234567890',
          inputType: inputType as 'VOICE' | 'TEXT',
          content: content || 'Sample project content',
          status: 'PROCESSING'
        }
      });

      // 음성 파일 처리
      let transcription = null;
      let finalContent = content;
      if (req.file && inputType === 'VOICE') {
        const transcribeResult = await aiService.transcribeAudio(req.file.buffer, req.file.originalname);
        if (transcribeResult.success) {
          transcription = transcribeResult.transcription;
          finalContent = transcription?.full_text || content;
          await prisma.slackInput.update({
            where: { id: slackInput.id },
            data: { content: finalContent }
          });
        }
      }

      // 2단계 AI 파이프라인 실행
      const aiResult = await aiService.processTwoStagePipeline(
        req.file?.buffer || Buffer.from(finalContent),
        req.file?.originalname || 'text-input.txt'
      );

      if (!aiResult.success) {
        await prisma.slackInput.update({
          where: { id: slackInput.id },
          data: { status: 'FAILED' }
        });
        return res.status(500).json({
          success: false,
          error: `AI processing failed: ${aiResult.error}`,
          step: aiResult.step
        });
      }

      // 프로젝트 생성
      const project = await prisma.project.create({
        data: {
          tenantId,
          slackInputId: slackInput.id,
          title: aiResult.notion_project?.title || 'AI Generated Project',
          overview: aiResult.notion_project?.overview || '',
          content: {
            notion_project: aiResult.notion_project,
            prd: aiResult.prd,
            generated_tasks: aiResult.tasks
          },
          notionStatus: 'pending'
        }
      });

      // Task Master 스타일로 업무 생성
      let tasks: any[] = [];
      if (aiResult.tasks && Array.isArray(aiResult.tasks)) {
        const taskCreationPromises = aiResult.tasks.map(async (taskItem: any, index: number) => {
          const taskNumber = taskItem.taskNumber || `${index + 1}`;
          const parentTaskNumber = taskNumber.includes('.') ? taskNumber.split('.')[0] : null;
          
          let parentTask = null;
          if (parentTaskNumber) {
            parentTask = await prisma.task.findFirst({
              where: { 
                tenantId, 
                projectId: project.id,
                taskNumber: parentTaskNumber
              }
            });
          }

          // 스마트 업무 배정 알고리즘 적용
          const task = {
            id: '',
            title: taskItem.title || 'Untitled Task',
            description: taskItem.description || '',
            complexity: taskItem.complexity || 'medium',
            estimatedHours: taskItem.estimated_hours || 0,
            priority: taskItem.priority === 'high' ? 'HIGH' : 
                     taskItem.priority === 'low' ? 'LOW' : 'MEDIUM',
            requiredSkills: taskItem.required_skills || [],
            taskType: taskItem.task_type || 'development'
          };

          // 최적 담당자 찾기
          const assignmentResult = await smartAssigner.assignBestUser(task, tenantId);
          const assigneeId = assignmentResult?.userId || user.id;

          const createdTask = await prisma.task.create({
            data: {
              tenantId,
              projectId: project.id,
              taskNumber,
              title: taskItem.title || 'Untitled Task',
              description: `${taskItem.description || ''}\n\n복잡도: ${taskItem.complexity || 'medium'}\n예상 시간: ${taskItem.estimated_hours || 0}시간\n\n수락 기준:\n${taskItem.acceptance_criteria?.join('\n') || ''}`,
              status: 'TODO',
              priority: taskItem.priority === 'high' ? 'HIGH' : 
                       taskItem.priority === 'low' ? 'LOW' : 'MEDIUM',
              assigneeId,
              parentId: parentTask?.id || null,
              complexity: taskItem.complexity || 'medium',
              metadata: {
                create: {
                  estimatedHours: taskItem.estimated_hours || 0,
                  requiredSkills: taskItem.required_skills || [],
                  taskType: taskItem.task_type || 'development',
                  assignmentScore: assignmentResult?.score || null,
                  assignmentReason: assignmentResult?.reason || null,
                  jiraStatus: 'pending'
                }
              }
            }
          });

          // 배정 로그 저장
          if (assignmentResult) {
            await smartAssigner.logAssignment(assignmentResult, createdTask.id);
          }

          return createdTask;
        });

        tasks = await Promise.all(taskCreationPromises);
      }

      // JIRA 자동 동기화
      let jiraResults = null;
      if (autoSyncJira && tasks.length > 0) {
        try {
          jiraResults = await jiraService.syncProjectTasksToJira(project.id, user.id || 'dev-user');
          console.log(`✅ JIRA sync completed: ${jiraResults.filter((r: any) => r.success).length}/${jiraResults.length} tasks`);
        } catch (error) {
          console.error('❌ JIRA sync failed:', error);
          jiraResults = { error: error instanceof Error ? error.message : 'JIRA sync failed' };
        }
      }

      // Slack 입력 완료 처리
      await prisma.slackInput.update({
        where: { id: slackInput.id },
        data: { status: 'COMPLETED' }
      });

      // Socket으로 실시간 알림
      io.to(`tenant:${req.tenant?.slug}`).emit('slack-pipeline-with-jira-completed', {
        slackInput,
        project,
        tasks,
        jiraResults,
        transcription,
        notion_project: aiResult.notion_project,
        prd: aiResult.prd,
        generated_tasks: aiResult.tasks
      });

      return res.json({
        success: true,
        slackInput,
        project,
        tasks,
        jiraResults,
        transcription,
        notion_project: aiResult.notion_project,
        prd: aiResult.prd,
        generated_tasks: aiResult.tasks
      });

    } catch (error) {
      console.error('Slack pipeline with JIRA processing error:', error);
      return res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  }
);

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

// ===== Slack 연동 =====
// Slack 이벤트 및 명령어 처리
if (slackApp && slackApp.receiver && slackApp.receiver.app) {
  // ExpressReceiver의 app을 직접 사용 (body parser 충돌 방지)
  app.use('/slack', slackApp.receiver.app);
  console.log('✅ Slack Express 앱 등록 완료');
} else {
  console.warn('⚠️ Slack 앱이 초기화되지 않아 라우터를 건너뜁니다.');
}

// Slack 디버깅 엔드포인트
app.get('/debug/slack', (req, res) => {
  const slackStatus = {
    botToken: process.env.SLACK_BOT_TOKEN ? '✅ 존재' : '❌ 없음',
    signingSecret: process.env.SLACK_SIGNING_SECRET ? '✅ 존재' : '❌ 없음',
    appUrl: process.env.APP_URL || '❌ 없음',
    slackHandlerLoaded: !!slackApp
  };
  
  res.json(slackStatus);
});

// 서버 시작
server.listen(PORT, HOST, () => {
  console.log('🚀 DdalKkak Backend Server with AI 시작됨');
  console.log(`📍 서버 주소: http://${HOST}:${PORT}`);
  console.log(`📊 헬스 체크: http://${HOST}:${PORT}/health`);
  console.log(`🤖 AI 헬스 체크: http://${HOST}:${PORT}/ai/health`);
  console.log(`🔧 개발 설정: http://${HOST}:${PORT}/dev/setup-tenant`);
  console.log(`🤖 Slack 웹훅: http://${HOST}:${PORT}/slack/events`);
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

//테스트
app.get('/tasks', async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
    res.json(tasks);
  } catch (error) {
    console.error('❌ /tasks API 오류:', error);
    res.status(500).json({ error: '서버 내부 오류' });
  }
});