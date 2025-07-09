/**
 * 간단한 테스트 서버
 * 단순화된 스키마와 기본 기능만 구현
 */

import express from 'express';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// 환경 변수 로드
dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3500;

// 기본 미들웨어
app.use(express.json());

// 헬스 체크 엔드포인트
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    database: 'connected'
  });
});

// 기본 라우트
app.get('/', (req, res) => {
  res.json({ 
    message: 'DdalKkak Backend API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// 데이터베이스 연결 테스트
app.get('/db-test', async (req, res) => {
  try {
    await prisma.$connect();
    const result = await prisma.$queryRaw`SELECT current_database(), current_user`;
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

// 테넌트 생성 테스트
app.post('/test-tenant', async (req, res) => {
  try {
    const tenant = await prisma.tenant.create({
      data: {
        name: 'Test Tenant',
        slug: 'test-tenant-' + Date.now()
      }
    });
    res.json({ 
      status: 'success',
      tenant
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다`);
  console.log(`📊 헬스 체크: http://localhost:${PORT}/health`);
  console.log(`🔌 데이터베이스 테스트: http://localhost:${PORT}/db-test`);
});

// 프로세스 종료 시 정리
process.on('SIGINT', async () => {
  console.log('\n🛑 서버 종료 중...');
  await prisma.$disconnect();
  process.exit(0);
});