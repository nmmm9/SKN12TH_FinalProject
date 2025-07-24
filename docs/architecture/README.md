# TtalKkak 시스템 아키텍쳐 문서

## 📋 목차
1. [시스템 개요](#시스템-개요)
2. [아키텍쳐 다이어그램](#아키텍쳐-다이어그램)
3. [기술 스택](#기술-스택)
4. [주요 특징](#주요-특징)
5. [보안 고려사항](#보안-고려사항)
6. [성능 및 확장성](#성능-및-확장성)
7. [모니터링 및 로깅](#모니터링-및-로깅)

---

## 🎯 시스템 개요

### 프로젝트 소개
**TtalKkak**은 음성 입력을 통해 자동으로 기획안을 구조화하고, AI Agent 기반으로 체계적인 업무 분담 및 팀원 배정을 수행하는 통합 워크플로우 시스템입니다.

### 핵심 가치 제안
- 🎙️ **음성 기반 입력**: 회의 중 실시간 음성 입력으로 빠른 업무 생성
- 🤖 **AI 기반 자동화**: 2단계 AI 파이프라인으로 음성 → 기획안 → 업무 자동 생성
- 🎯 **스마트 업무 배정**: 스킬 매칭 및 워크로드 분석을 통한 최적 배정
- 🔄 **완전 자동화**: Slack → Notion → JIRA 전체 워크플로우 자동화
- 🏢 **멀티테넌트**: 단일 인스턴스로 여러 조직 지원

### 주요 워크플로우
```
음성 입력 → AI 처리 → 기획안 생성 → 업무 분해 → 스마트 배정 → 외부 연동
```

---

## 📊 아키텍쳐 다이어그램

### 1. [컨텍스트 다이어그램](01-context-diagram.md)
시스템과 외부 사용자/시스템 간의 관계를 보여주는 최상위 뷰

**주요 구성 요소:**
- 사용자: 프로젝트 매니저, 개발자, 팀 멤버
- 핵심 시스템: TtalKkak AI 프로젝트 관리 시스템
- 외부 시스템: Slack, Notion, JIRA, AI 서버

### 2. [데이터 플로우 다이어그램](02-dataflow-diagram.md)
핵심 비즈니스 프로세스의 데이터 흐름을 상세히 보여주는 뷰

**주요 프로세스:**
- 음성 입력 및 전처리
- 2단계 AI 처리 파이프라인
- 스마트 업무 배정 알고리즘
- 외부 시스템 연동

### 3. [컨테이너 다이어그램](03-container-diagram.md)
주요 애플리케이션, 서비스, 데이터베이스 간의 관계를 보여주는 뷰

**주요 컨테이너:**
- 클라이언트: 웹 대시보드, Slack 클라이언트, Chrome 확장
- 백엔드: Node.js API, Slack 핸들러, AI 커넥터
- 데이터: PostgreSQL, Redis, 파일 저장소
- 외부: AI 서버, 외부 API들

### 4. [컴포넌트 다이어그램](04-component-diagram.md)
백엔드 시스템 내부 컴포넌트의 상세 구조를 보여주는 뷰

**주요 레이어:**
- API 레이어: Express, 미들웨어, 라우터
- 컨트롤러: 인증, 프로젝트, 업무, Slack
- 서비스: AI, Notion, JIRA, 업무 배정
- 유틸리티: 암호화, 파일, 검증, 로깅

---

## 🛠 기술 스택

### 백엔드 (Node.js)
```javascript
{
  "runtime": "Node.js 18+",
  "framework": "Express.js",
  "language": "TypeScript",
  "database": "PostgreSQL + Prisma ORM",
  "cache": "Redis",
  "auth": "JWT + OAuth 2.0",
  "realtime": "Socket.IO",
  "upload": "Multer (100MB limit)",
  "security": "Helmet, CORS, Rate Limiting"
}
```

### AI 엔진 (Python)
```python
{
  "language": "Python 3.9+",
  "framework": "FastAPI",
  "stt": "WhisperX (large-v3)",
  "llm": "Qwen3-32B-AWQ",
  "gpu": "CUDA Support",
  "deployment": "Runpod Cloud"
}
```

### 프론트엔드 (React)
```javascript
{
  "framework": "React 18 + TypeScript",
  "styling": "Tailwind CSS",
  "state": "React Query",
  "build": "Vite",
  "notifications": "Sonner"
}
```

### 외부 연동
```javascript
{
  "slack": "@slack/bolt",
  "notion": "@notionhq/client",
  "jira": "Atlassian REST API",
  "deployment": "Docker Compose"
}
```

---

## ⭐ 주요 특징

### 1. 멀티테넌트 아키텍쳐
```typescript
// 테넌트별 데이터 격리
interface TenantContext {
  tenantId: string;
  slug: string;
  name: string;
  settings: TenantSettings;
}

// 미들웨어를 통한 자동 테넌트 분리
app.use('/api/:tenantSlug', tenantMiddleware);
```

### 2. 2단계 AI 파이프라인
```mermaid
graph LR
    A[음성 입력] --> B[Stage 1: 음성→기획안]
    B --> C[Stage 2: 기획안→업무]
    C --> D[외부 연동]
```

**Stage 1**: 음성 전사 + 기획안 생성
- WhisperX로 음성 → 텍스트
- Qwen3-32B로 구조화된 기획안 생성

**Stage 2**: 기획안 → 업무 분해
- PRD (Product Requirements Document) 생성
- Epic/Task 계층 구조 생성
- 스킬 요구사항 및 예상 시간 계산

### 3. 스마트 업무 배정 알고리즘
```typescript
interface AssignmentScore {
  skillScore: number;    // 40% 가중치
  workloadScore: number; // 30% 가중치
  experienceScore: number; // 20% 가중치
  priorityScore: number; // 10% 가중치
}

const totalScore = (skillScore * 0.4) + 
                  (workloadScore * 0.3) + 
                  (experienceScore * 0.2) + 
                  (priorityScore * 0.1);
```

### 4. 실시간 워크플로우
```typescript
// Socket.IO를 통한 실시간 업데이트
io.emit('workflow:progress', {
  stage: 'ai_processing',
  progress: 75,
  message: 'AI 분석 중...'
});
```

---

## 🔐 보안 고려사항

### 1. 인증 및 인가
```typescript
// OAuth 2.0 외부 서비스 연동
const authConfig = {
  slack: { clientId, clientSecret, scopes: ['bot'] },
  notion: { clientId, clientSecret, scopes: ['read', 'write'] },
  jira: { clientId, clientSecret, scopes: ['read:jira-work', 'write:jira-work'] }
};

// JWT 토큰 기반 내부 인증
const token = jwt.sign({ userId, tenantId }, secret, { expiresIn: '1h' });
```

### 2. 데이터 보호
```typescript
// 민감한 데이터 암호화
const encrypt = (text: string): string => {
  return crypto.createCipher('aes-256-cbc', secret).update(text, 'utf8', 'hex');
};

// 멀티테넌트 데이터 격리
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const tenantId = context.switchToHttp().getRequest().tenantId;
    return this.validateTenantAccess(tenantId);
  }
}
```

### 3. 입력 검증
```typescript
// 파일 업로드 보안
const uploadConfig = multer({
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/wav', 'audio/mp3', 'audio/m4a'];
    cb(null, allowedTypes.includes(file.mimetype));
  }
});
```

---

## 📈 성능 및 확장성

### 1. 수평 확장 전략
```yaml
# Docker Compose 스케일링
version: '3.8'
services:
  backend:
    image: ttalkkak-backend
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '2'
          memory: 4G
```

### 2. 캐싱 전략
```typescript
// Redis 캐싱으로 성능 최적화
@Injectable()
export class CacheService {
  async get(key: string): Promise<any> {
    return await this.redis.get(key);
  }
  
  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }
}
```

### 3. 데이터베이스 최적화
```sql
-- 인덱스 최적화
CREATE INDEX idx_tasks_tenant_status ON tasks (tenant_id, status);
CREATE INDEX idx_users_tenant_slack ON users (tenant_id, slack_user_id);
CREATE INDEX idx_integrations_tenant_service ON integrations (tenant_id, service_type);
```

### 4. 비동기 처리
```typescript
// 외부 API 호출 병렬 처리
const [notionResult, jiraResult] = await Promise.allSettled([
  this.notionService.createPage(projectData),
  this.jiraService.createIssues(taskData)
]);
```

---

## 📊 모니터링 및 로깅

### 1. 구조화된 로깅
```typescript
// Winston 로깅 설정
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

### 2. 헬스 체크
```typescript
// 서비스 상태 모니터링
@Get('/health')
async healthCheck(): Promise<HealthStatus> {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: await this.checkDatabase(),
      redis: await this.checkRedis(),
      aiServer: await this.checkAiServer(),
      externalApis: await this.checkExternalApis()
    }
  };
}
```

### 3. 성능 메트릭
```typescript
// 응답 시간 및 처리량 측정
@Injectable()
export class MetricsService {
  private readonly metrics = new Map<string, number>();
  
  recordApiCall(endpoint: string, duration: number): void {
    this.metrics.set(`api_${endpoint}_duration`, duration);
    this.metrics.set(`api_${endpoint}_count`, 
      (this.metrics.get(`api_${endpoint}_count`) || 0) + 1);
  }
}
```

---

## 🚀 배포 및 운영

### 1. 컨테이너 배포
```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3500
CMD ["npm", "start"]
```

### 2. 환경 설정
```bash
# .env 파일 구성
NODE_ENV=production
PORT=3500
DATABASE_URL=postgresql://user:pass@localhost:5432/ttalkkak
REDIS_URL=redis://localhost:6379
AI_SERVER_URL=https://ai.ttalkkak.com
SLACK_BOT_TOKEN=xoxb-...
NOTION_CLIENT_ID=...
JIRA_CLIENT_ID=...
```

### 3. CI/CD 파이프라인
```yaml
# GitHub Actions
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Build and Deploy
        run: |
          docker build -t ttalkkak-backend .
          docker push registry/ttalkkak-backend:latest
          kubectl apply -f k8s/
```

---

## 📚 참고 자료

### 아키텍쳐 문서
- [컨텍스트 다이어그램](01-context-diagram.md)
- [데이터 플로우 다이어그램](02-dataflow-diagram.md)
- [컨테이너 다이어그램](03-container-diagram.md)
- [컴포넌트 다이어그램](04-component-diagram.md)

### API 문서
- [REST API 명세](../api/README.md)
- [Slack Bot 가이드](../slack/README.md)
- [AI 서버 연동](../ai/README.md)

### 개발 가이드
- [프로젝트 설정](../development/setup.md)
- [테스트 가이드](../development/testing.md)
- [배포 가이드](../development/deployment.md)

---

**📅 문서 업데이트**: 2024년 11월 기준  
**👥 관리자**: TtalKkak 개발팀  
**🔄 버전**: v1.0.0