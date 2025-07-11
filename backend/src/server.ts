/**
 * TtalKkak Backend Server with AI Integration
 * Slack → AI 기획안 → 업무 생성 → 외부 연동
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