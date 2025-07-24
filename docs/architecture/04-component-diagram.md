# TtalKkak 컴포넌트 다이어그램

## 개요
TtalKkak 백엔드 API의 내부 컴포넌트 구조와 상호 작용을 보여줍니다.

## Mermaid 다이어그램

```mermaid
graph TB
    %% 외부 입력
    HTTP_CLIENT[🌐 HTTP 클라이언트<br/>웹/모바일 앱]
    SLACK_BOT[🤖 Slack Bot<br/>@slack/bolt]
    
    %% API 레이어
    subgraph "API 레이어"
        EXPRESS[🚪 Express 서버<br/>server.ts<br/>- 라우팅<br/>- 미들웨어 적용<br/>- 에러 핸들링]
        
        MIDDLEWARE[🔒 미들웨어<br/>- 인증/인가<br/>- 테넌트 검증<br/>- 로깅<br/>- CORS]
        
        ROUTES[🛣️ 라우터<br/>- /auth/* (인증)<br/>- /api/* (API)<br/>- /slack/* (Slack 이벤트)]
    end
    
    %% 컨트롤러 레이어
    subgraph "컨트롤러 레이어"
        AUTH_CTRL[🔐 인증 컨트롤러<br/>- OAuth 콜백<br/>- 토큰 갱신<br/>- 세션 관리]
        
        PROJECT_CTRL[📋 프로젝트 컨트롤러<br/>- 프로젝트 생성<br/>- 상태 관리<br/>- 메타데이터 처리]
        
        TASK_CTRL[✅ 업무 컨트롤러<br/>- 업무 생성<br/>- 배정 관리<br/>- 상태 변경]
        
        SLACK_CTRL[📱 Slack 컨트롤러<br/>slack-handler.js<br/>- 명령어 처리<br/>- 이벤트 리스너<br/>- 모달 처리]
    end
    
    %% 서비스 레이어
    subgraph "서비스 레이어"
        AI_SERVICE[🧠 AI 서비스<br/>ai-service.ts<br/>- 2단계 파이프라인<br/>- 에러 처리<br/>- 더미 데이터]
        
        NOTION_SERVICE[📝 Notion 서비스<br/>notion-service.ts<br/>- 페이지 생성<br/>- 블록 구조화<br/>- OAuth 관리]
        
        JIRA_SERVICE[🎫 JIRA 서비스<br/>jira-service.ts<br/>- 이슈 생성<br/>- Epic/Task 매핑<br/>- 토큰 관리]
        
        TASK_ASSIGNER[🎯 업무 배정 서비스<br/>smart-task-assigner.ts<br/>- 스코어링 알고리즘<br/>- 최적화 엔진]
    end
    
    %% 유틸리티 레이어
    subgraph "유틸리티 레이어"
        CRYPTO_UTIL[🔒 암호화 유틸<br/>- 토큰 암호화<br/>- 복호화<br/>- 해시 함수]
        
        FILE_UTIL[📁 파일 유틸<br/>- 업로드 처리<br/>- 타입 검증<br/>- 크기 제한]
        
        VALIDATION[✅ 검증 유틸<br/>- 입력 검증<br/>- 스키마 검증<br/>- 타입 체크]
        
        LOGGER[📊 로깅 유틸<br/>Winston<br/>- 구조화된 로그<br/>- 에러 추적]
    end
    
    %% 데이터 접근 레이어
    subgraph "데이터 접근 레이어"
        PRISMA[🗃️ Prisma ORM<br/>schema.prisma<br/>- 데이터베이스 접근<br/>- 타입 안전성<br/>- 마이그레이션]
        
        CACHE[⚡ 캐시 관리<br/>- Redis 연결<br/>- 세션 관리<br/>- 임시 데이터]
        
        REPOSITORY[📚 리포지토리<br/>- 데이터 추상화<br/>- 쿼리 최적화<br/>- 트랜잭션 관리]
    end
    
    %% 외부 연동 레이어
    subgraph "외부 연동 레이어"
        HTTP_CLIENT_UTIL[🌐 HTTP 클라이언트<br/>- API 호출<br/>- 재시도 로직<br/>- 타임아웃 처리]
        
        WEBHOOK_HANDLER[📡 웹훅 핸들러<br/>- Slack 이벤트<br/>- 서명 검증<br/>- 응답 처리]
        
        OAUTH_MANAGER[🔑 OAuth 관리<br/>- 인증 플로우<br/>- 토큰 갱신<br/>- 스코프 관리]
    end
    
    %% 모니터링 레이어
    subgraph "모니터링 레이어"
        HEALTH_CHECK[💓 헬스 체크<br/>- 서비스 상태<br/>- 외부 연동 확인<br/>- 성능 메트릭]
        
        ERROR_HANDLER[🚨 에러 핸들러<br/>- 전역 에러 처리<br/>- 에러 분류<br/>- 알림 발송]
        
        METRICS[📊 메트릭 수집<br/>- 성능 지표<br/>- 사용량 통계<br/>- 대시보드]
    end
    
    %% 외부 시스템
    POSTGRES_DB[(🗃️ PostgreSQL)]
    REDIS_DB[(⚡ Redis)]
    AI_SERVER[🤖 AI 서버]
    EXTERNAL_APIS[🌐 외부 API<br/>Slack, Notion, JIRA]
    
    %% 연결 관계
    HTTP_CLIENT --> EXPRESS
    SLACK_BOT --> SLACK_CTRL
    
    EXPRESS --> MIDDLEWARE
    MIDDLEWARE --> ROUTES
    ROUTES --> AUTH_CTRL
    ROUTES --> PROJECT_CTRL
    ROUTES --> TASK_CTRL
    
    AUTH_CTRL --> OAUTH_MANAGER
    PROJECT_CTRL --> AI_SERVICE
    PROJECT_CTRL --> NOTION_SERVICE
    TASK_CTRL --> JIRA_SERVICE
    TASK_CTRL --> TASK_ASSIGNER
    
    SLACK_CTRL --> AI_SERVICE
    SLACK_CTRL --> NOTION_SERVICE
    SLACK_CTRL --> JIRA_SERVICE
    
    AI_SERVICE --> HTTP_CLIENT_UTIL
    NOTION_SERVICE --> HTTP_CLIENT_UTIL
    JIRA_SERVICE --> HTTP_CLIENT_UTIL
    
    AUTH_CTRL --> CRYPTO_UTIL
    PROJECT_CTRL --> FILE_UTIL
    TASK_CTRL --> VALIDATION
    
    AI_SERVICE --> REPOSITORY
    NOTION_SERVICE --> REPOSITORY
    JIRA_SERVICE --> REPOSITORY
    TASK_ASSIGNER --> REPOSITORY
    
    REPOSITORY --> PRISMA
    REPOSITORY --> CACHE
    
    PRISMA --> POSTGRES_DB
    CACHE --> REDIS_DB
    
    HTTP_CLIENT_UTIL --> AI_SERVER
    HTTP_CLIENT_UTIL --> EXTERNAL_APIS
    
    EXPRESS --> HEALTH_CHECK
    EXPRESS --> ERROR_HANDLER
    EXPRESS --> METRICS
    
    ERROR_HANDLER --> LOGGER
    HEALTH_CHECK --> LOGGER
    METRICS --> LOGGER
    
    WEBHOOK_HANDLER --> SLACK_CTRL
    OAUTH_MANAGER --> EXTERNAL_APIS
    
    %% 스타일링
    classDef apiStyle fill:#e1f5fe,stroke:#0277bd,stroke-width:2px
    classDef controllerStyle fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef serviceStyle fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef utilStyle fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    classDef dataStyle fill:#f1f8e9,stroke:#558b2f,stroke-width:2px
    classDef externalStyle fill:#ffebee,stroke:#d32f2f,stroke-width:2px
    classDef monitorStyle fill:#e0f2f1,stroke:#00796b,stroke-width:2px
    classDef dbStyle fill:#fafafa,stroke:#616161,stroke-width:2px
    
    class EXPRESS,MIDDLEWARE,ROUTES apiStyle
    class AUTH_CTRL,PROJECT_CTRL,TASK_CTRL,SLACK_CTRL controllerStyle
    class AI_SERVICE,NOTION_SERVICE,JIRA_SERVICE,TASK_ASSIGNER serviceStyle
    class CRYPTO_UTIL,FILE_UTIL,VALIDATION,LOGGER utilStyle
    class PRISMA,CACHE,REPOSITORY dataStyle
    class HTTP_CLIENT_UTIL,WEBHOOK_HANDLER,OAUTH_MANAGER externalStyle
    class HEALTH_CHECK,ERROR_HANDLER,METRICS monitorStyle
    class POSTGRES_DB,REDIS_DB,AI_SERVER,EXTERNAL_APIS dbStyle
```

## 컴포넌트 상세 설명

### API 레이어
- **Express 서버**: 중앙 HTTP 서버, 라우팅 및 미들웨어 관리
- **미들웨어**: 횡단 관심사 처리 (인증, 로깅, CORS 등)
- **라우터**: URL 경로별 요청 분배

### 컨트롤러 레이어
- **인증 컨트롤러**: OAuth 플로우 및 토큰 관리
- **프로젝트 컨트롤러**: 프로젝트 생명주기 관리
- **업무 컨트롤러**: 업무 생성, 배정, 상태 관리
- **Slack 컨트롤러**: Slack 이벤트 및 명령 처리

### 서비스 레이어
- **AI 서비스**: 음성/텍스트 처리 파이프라인
- **Notion 서비스**: 문서 생성 및 관리
- **JIRA 서비스**: 이슈 추적 및 프로젝트 관리
- **업무 배정 서비스**: 스마트 알고리즘 기반 최적 배정

### 유틸리티 레이어
- **암호화 유틸**: 토큰 암호화/복호화
- **파일 유틸**: 파일 업로드 및 검증
- **검증 유틸**: 입력 데이터 검증
- **로깅 유틸**: 구조화된 로그 관리

### 데이터 접근 레이어
- **Prisma ORM**: 타입 안전한 데이터베이스 접근
- **캐시 관리**: Redis 연결 및 세션 관리
- **리포지토리**: 데이터 접근 추상화

### 외부 연동 레이어
- **HTTP 클라이언트**: 외부 API 호출 관리
- **웹훅 핸들러**: Slack 이벤트 처리
- **OAuth 관리**: 외부 서비스 인증 관리

### 모니터링 레이어
- **헬스 체크**: 서비스 상태 모니터링
- **에러 핸들러**: 전역 에러 처리
- **메트릭 수집**: 성능 지표 수집

## 주요 설계 원칙

### 1. 관심사 분리 (Separation of Concerns)
- 레이어별 명확한 책임 분리
- 단일 책임 원칙 준수

### 2. 의존성 주입 (Dependency Injection)
- 느슨한 결합 구현
- 테스트 용이성 향상

### 3. 에러 처리 (Error Handling)
- 계층별 에러 처리
- 사용자 친화적 에러 메시지

### 4. 확장성 (Scalability)
- 모듈화된 구조
- 수평 확장 가능

### 5. 보안 (Security)
- 입력 검증
- 암호화 및 인증
- 접근 제어

## 핵심 데이터 흐름
1. **요청 수신**: Express → 미들웨어 → 라우터
2. **컨트롤러**: 비즈니스 로직 호출
3. **서비스**: 외부 API 연동 및 처리
4. **데이터**: 리포지토리 → Prisma → 데이터베이스
5. **응답**: 결과 반환 및 로깅