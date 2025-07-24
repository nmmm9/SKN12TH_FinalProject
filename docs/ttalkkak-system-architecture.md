# TtalKkak AI 기반 프로젝트 관리 시스템 아키텍처

## 전체 시스템 아키텍처

```mermaid
graph TD
    %% 스타일 정의
    classDef clientLayer fill:#f3e5ff,stroke:#8b5cf6,stroke-width:3px,color:#5b21b6
    classDef apiLayer fill:#fff7ed,stroke:#f97316,stroke-width:3px,color:#c2410c
    classDef aiLayer fill:#fef2f2,stroke:#ef4444,stroke-width:3px,color:#dc2626
    classDef serviceLayer fill:#f0fdf4,stroke:#22c55e,stroke-width:3px,color:#16a34a
    classDef dataLayer fill:#eff6ff,stroke:#3b82f6,stroke-width:3px,color:#2563eb
    classDef external fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,color:#92400e
    
    %% 최상단 - 사용자 인터페이스
    subgraph " "
        SlackBot["🤖 Slack Bot<br/>━━━━━━━━━━━<br/>/tk start, /tk help<br/>음성/텍스트 입력<br/>포트: Slack API"]
        WebDash["🖥️ 웹 대시보드<br/>━━━━━━━━━━━<br/>React + TypeScript<br/>칸반 보드, 실시간 통계<br/>포트: 3001"]
    end
    
    %% 중앙 허브 - Express 서버
    Express["🚀 Express 서버<br/>━━━━━━━━━━━━━━━━━<br/>Node.js + TypeScript<br/>멀티테넌트 아키텍처<br/>API Gateway 역할<br/>포트: 3500"]
    
    %% 좌측 - AI 처리 엔진
    subgraph AI_Engine[" "]
        direction TB
        FastAPI["🔥 FastAPI<br/>━━━━━━━━━<br/>Python 비동기<br/>포트: 8000"]
        
        WhisperX["🎤 WhisperX<br/>━━━━━━━━━<br/>음성→텍스트<br/>large-v3 모델"]
        
        Qwen3["🧠 Qwen3-32B<br/>━━━━━━━━━<br/>2단계 파이프라인<br/>회의록→업무분해"]
        
        RunPod["⚡ RunPod GPU<br/>━━━━━━━━━<br/>NVIDIA A100<br/>클라우드 GPU"]
        
        FastAPI --> WhisperX
        WhisperX --> Qwen3
        RunPod -.-> FastAPI
    end
    
    %% 우측 - 외부 서비스 연동
    subgraph External_Services[" "]
        direction TB
        NotionService["📝 Notion 연동<br/>━━━━━━━━━━━<br/>페이지 자동 생성<br/>@notionhq/client"]
        
        JiraService["🎯 JIRA 연동<br/>━━━━━━━━━━━<br/>Epic/Task 매핑<br/>Atlassian API"]
        
        SmartAssigner["🎯 스마트 배정<br/>━━━━━━━━━━━<br/>스킬매칭 40%<br/>워크로드 30%"]
        
        TaskMaster["📋 Task Master<br/>━━━━━━━━━━━<br/>PRD 생성<br/>업무 계층화"]
    end
    
    %% 하단 - 데이터 저장소
    subgraph Data_Storage[" "]
        direction LR
        PostgreSQL["🐘 PostgreSQL<br/>━━━━━━━━━━━<br/>멀티테넌트 DB<br/>포트: 5432"]
        
        Redis["⚡ Redis<br/>━━━━━━━━━<br/>캐시 & 세션<br/>포트: 6379"]
        
        MinIO["💾 MinIO<br/>━━━━━━━━━<br/>S3 호환 스토리지<br/>파일 저장소"]
    end
    
    %% 외부 API (우측 상단)
    SlackAPI["📱 Slack API"]
    NotionAPI["📄 Notion API"] 
    JiraAPI["🔧 JIRA API"]
    
    %% 실시간 통신 (좌측 상단)
    SocketIO["🔄 Socket.IO<br/>━━━━━━━━━<br/>실시간 통신<br/>포트: 8080"]
    
    %% 주요 데이터 플로우 (굵은 화살표)
    SlackBot ====> Express
    WebDash ====> Express
    Express ====> FastAPI
    Express ====> NotionService
    Express ====> JiraService
    Express ====> PostgreSQL
    
    %% 보조 연결 (얇은 화살표)
    Express --> SmartAssigner
    Express --> TaskMaster
    Express --> Redis
    Express --> MinIO
    Express --> SocketIO
    
    %% 외부 API 연결 (점선)
    SlackBot -.- SlackAPI
    NotionService -.- NotionAPI
    JiraService -.- JiraAPI
    
    %% 실시간 통신 (양방향)
    SocketIO <--> WebDash
    
    %% 스타일 적용
    class SlackBot,WebDash clientLayer
    class Express apiLayer
    class FastAPI,WhisperX,Qwen3,RunPod aiLayer
    class NotionService,JiraService,SmartAssigner,TaskMaster serviceLayer
    class PostgreSQL,Redis,MinIO dataLayer
    class SlackAPI,NotionAPI,JiraAPI,SocketIO external
```

## 데이터 플로우 다이어그램

```mermaid
sequenceDiagram
    participant U as 사용자
    participant S as Slack Bot
    participant E as Express 서버
    participant A as AI 엔진
    participant D as 데이터베이스
    participant N as Notion
    participant J as JIRA
    participant W as 웹 대시보드
    
    Note over U,W: 전체 워크플로우 (15-30초 소요)
    
    U->>S: 1. 음성/텍스트 입력
    S->>E: 2. Slack 이벤트 수신
    
    Note over E: 멀티테넌트 인증 확인
    
    E->>A: 3. AI 파이프라인 요청
    A->>A: 4a. WhisperX STT (음성→텍스트)
    A->>A: 4b. Qwen3 Stage 1 (회의록→기획안)
    A->>A: 4c. Qwen3 Stage 2 (기획안→업무분해)
    A->>E: 5. AI 처리 결과 반환
    
    E->>D: 6. 프로젝트/업무 저장
    E->>E: 7. 스마트 배정 알고리즘 실행
    
    par 외부 서비스 연동
        E->>N: 8a. Notion 페이지 생성
        N-->>E: Notion URL 반환
    and
        E->>J: 8b. JIRA Epic/Task 생성
        J-->>E: JIRA 이슈 키 반환
    end
    
    E->>W: 9. Socket.IO 실시간 업데이트
    E->>S: 10. Slack 결과 알림
    S->>U: 11. 완료 메시지 + 링크
    
    Note over U,W: 처리 완료 - 대시보드에서 확인 가능
```

## 핵심 컴포넌트 관계도

```mermaid
flowchart LR
    %% 중앙 허브
    Express["🚀 Express<br/>중앙 허브"]
    
    %% 입력 채널
    Slack["🤖 Slack Bot<br/>━━━━━━━━━<br/>음성/텍스트 입력"]
    Web["🖥️ 웹 대시보드<br/>━━━━━━━━━<br/>프로젝트 관리"]
    
    %% AI 처리
    AI["🧠 AI 엔진<br/>━━━━━━━━━<br/>Qwen3 + WhisperX<br/>2단계 파이프라인"]
    
    %% 비즈니스 로직
    Smart["🎯 스마트 배정<br/>━━━━━━━━━<br/>알고리즘 기반<br/>자동 업무 분배"]
    
    %% 외부 연동
    Notion["📝 Notion<br/>━━━━━━━━━<br/>문서 자동 생성"]
    Jira["🔧 JIRA<br/>━━━━━━━━━<br/>이슈 트래킹"]
    
    %% 데이터 저장
    DB["🐘 PostgreSQL<br/>━━━━━━━━━<br/>멀티테넌트<br/>메인 데이터"]
    Cache["⚡ Redis<br/>━━━━━━━━━<br/>빠른 캐시<br/>세션 관리"]
    
    %% 주요 플로우 (굵은 화살표)
    Slack ====> Express
    Web ====> Express
    Express ====> AI
    AI ====> Smart
    Smart ====> Notion
    Smart ====> Jira
    Express ====> DB
    
    %% 보조 연결 (얇은 화살표)
    Express --> Cache
    Web <--> DB
    Web <--> Cache
    
    %% 실시간 통신
    Express <-.-> Web
    
    %% 색상 그룹
    classDef input fill:#f3e5ff,stroke:#8b5cf6,stroke-width:3px
    classDef core fill:#fff7ed,stroke:#f97316,stroke-width:3px
    classDef ai fill:#fef2f2,stroke:#ef4444,stroke-width:3px
    classDef business fill:#fef3c7,stroke:#f59e0b,stroke-width:3px
    classDef external fill:#f0fdf4,stroke:#22c55e,stroke-width:3px
    classDef data fill:#eff6ff,stroke:#3b82f6,stroke-width:3px
    
    class Slack,Web input
    class Express core
    class AI ai
    class Smart business
    class Notion,Jira external
    class DB,Cache data
```

## AI 파이프라인 상세도

```mermaid
flowchart TD
    %% 입력 단계
    Input["📥 사용자 입력<br/>━━━━━━━━━<br/>Slack Bot을 통한<br/>음성 또는 텍스트"]
    
    %% 전처리 단계
    Check{"🔍 입력 타입<br/>━━━━━━━━━<br/>음성 vs 텍스트"}
    
    %% 음성 처리
    STT["🎤 WhisperX STT<br/>━━━━━━━━━━━━━<br/>음성 → 텍스트 변환<br/>large-v3 모델<br/>타임스탬프 포함"]
    
    %% 텍스트 전처리
    Filter["📝 텍스트 전처리<br/>━━━━━━━━━━━━━<br/>KcBERT 한국어 처리<br/>노이즈 제거 & 정규화"]
    
    %% AI 1단계
    Stage1["🧠 AI Stage 1<br/>━━━━━━━━━━━━━<br/>Qwen3-32B-AWQ<br/>회의록 → 프로젝트 기획안<br/>비즈니스 로직 생성"]
    
    %% AI 2단계  
    Stage2["🎯 AI Stage 2<br/>━━━━━━━━━━━━━<br/>Qwen3-32B-AWQ<br/>기획안 → Task Master PRD<br/>업무 분해 & 계층화"]
    
    %% 후처리
    Smart["⚙️ 스마트 배정<br/>━━━━━━━━━━━━━<br/>스킬매칭 알고리즘<br/>워크로드 분석<br/>최적 담당자 배정"]
    
    %% 결과
    Output["📤 처리 완료<br/>━━━━━━━━━<br/>Notion + JIRA 연동<br/>실시간 대시보드 업데이트"]
    
    %% GPU 리소스
    GPU["⚡ RunPod GPU<br/>━━━━━━━━━━━━━<br/>NVIDIA A100 클러스터<br/>고성능 병렬 처리<br/>자동 스케일링"]
    
    %% 플로우 연결
    Input --> Check
    Check -->|"🎤 음성"| STT
    Check -->|"📝 텍스트"| Filter
    STT --> Filter
    Filter --> Stage1
    Stage1 --> Stage2
    Stage2 --> Smart
    Smart --> Output
    
    %% GPU 연결 (점선)
    GPU -.-> STT
    GPU -.-> Stage1
    GPU -.-> Stage2
    
    %% 성능 정보
    Performance["📊 성능 지표<br/>━━━━━━━━━━━━━<br/>• 평균 처리시간: 15-30초<br/>• AI 정확도: 95%+<br/>• 동시 처리: 100+ 요청<br/>• GPU 활용률: 80%+"]
    
    %% 스타일 적용
    classDef inputStyle fill:#f3e5ff,stroke:#8b5cf6,stroke-width:3px
    classDef processStyle fill:#fef2f2,stroke:#ef4444,stroke-width:3px
    classDef aiStyle fill:#fee2e2,stroke:#dc2626,stroke-width:3px
    classDef smartStyle fill:#fef3c7,stroke:#f59e0b,stroke-width:3px
    classDef outputStyle fill:#f0fdf4,stroke:#22c55e,stroke-width:3px
    classDef resourceStyle fill:#eff6ff,stroke:#3b82f6,stroke-width:3px
    classDef infoStyle fill:#f9fafb,stroke:#6b7280,stroke-width:2px
    
    class Input,Check inputStyle
    class STT,Filter processStyle
    class Stage1,Stage2 aiStyle
    class Smart smartStyle
    class Output outputStyle
    class GPU resourceStyle
    class Performance infoStyle
```

## 데이터베이스 ERD

```mermaid
erDiagram
    TENANT {
        string id PK
        string name
        string slug UK
        datetime createdAt
        datetime updatedAt
    }
    
    USER {
        string id PK
        string tenantId FK
        string slackUserId UK
        string email
        string name
        json skills
        enum experienceLevel
        datetime createdAt
    }
    
    PROJECT {
        string id PK
        string tenantId FK
        string createdByUserId FK
        string title
        text description
        json aiAnalysis
        string notionPageId
        string jiraProjectKey
        enum status
        datetime createdAt
    }
    
    TASK {
        string id PK
        string tenantId FK
        string projectId FK
        string parentTaskId FK
        string assignedToUserId FK
        string title
        text description
        enum type
        enum priority
        enum status
        datetime startDate
        datetime dueDate
        json metadata
        datetime createdAt
    }
    
    SLACK_INPUT {
        string id PK
        string tenantId FK
        string userId FK
        string projectId FK
        text originalText
        string audioFileUrl
        json transcription
        enum inputType
        datetime createdAt
    }
    
    INTEGRATION {
        string id PK
        string tenantId FK
        string userId FK
        enum serviceType
        json credentials
        boolean isActive
        datetime lastSync
        datetime createdAt
    }
    
    TASK_ASSIGNMENT_LOG {
        string id PK
        string taskId FK
        string fromUserId FK
        string toUserId FK
        text reason
        float assignmentScore
        datetime createdAt
    }
    
    %% 관계 정의
    TENANT ||--o{ USER : "belongs_to"
    TENANT ||--o{ PROJECT : "belongs_to"
    TENANT ||--o{ TASK : "belongs_to"
    TENANT ||--o{ SLACK_INPUT : "belongs_to"
    TENANT ||--o{ INTEGRATION : "belongs_to"
    
    USER ||--o{ PROJECT : "creates"
    USER ||--o{ TASK : "assigned_to"
    USER ||--o{ SLACK_INPUT : "submits"
    USER ||--o{ INTEGRATION : "owns"
    USER ||--o{ TASK_ASSIGNMENT_LOG : "from_user"
    USER ||--o{ TASK_ASSIGNMENT_LOG : "to_user"
    
    PROJECT ||--o{ TASK : "contains"
    PROJECT ||--o{ SLACK_INPUT : "generates"
    
    TASK ||--o{ TASK : "parent_child"
    TASK ||--o{ TASK_ASSIGNMENT_LOG : "tracks"
```

## 시스템 메트릭스 & 성능

```mermaid
graph LR
    subgraph Metrics["📊 시스템 메트릭스"]
        subgraph Performance["⚡ 성능 지표"]
            P1[처리 시간<br/>평균 15-30초]
            P2[AI 정확도<br/>95%+]
            P3[동시 사용자<br/>100+]
            P4[가용성<br/>99.9%]
        end
        
        subgraph Scale["📈 확장성"]
            S1[멀티테넌트<br/>데이터 격리]
            S2[수평 확장<br/>Docker 기반]
            S3[GPU 스케일링<br/>RunPod 연동]
            S4[CDN 지원<br/>글로벌 배포]
        end
        
        subgraph Security["🔒 보안"]
            SE1[OAuth 2.0<br/>인증]
            SE2[HTTPS/TLS<br/>암호화]
            SE3[토큰 관리<br/>자동 갱신]
            SE4[감사 로깅<br/>추적 가능]
        end
    end
    
    classDef performanceStyle fill:#fef3c7,stroke:#f59e0b
    classDef scaleStyle fill:#f0fdf4,stroke:#22c55e
    classDef securityStyle fill:#fef2f2,stroke:#ef4444
    
    class P1,P2,P3,P4 performanceStyle
    class S1,S2,S3,S4 scaleStyle
    class SE1,SE2,SE3,SE4 securityStyle
```

## 기술 스택 다이어그램

```mermaid
graph TB
    %% 프론트엔드 스택
    subgraph Frontend["🖥️ 프론트엔드 스택"]
        direction TB
        React["⚛️ React 18.2<br/>━━━━━━━━━<br/>컴포넌트 기반<br/>현대적 UI"]
        
        TS1["📘 TypeScript 5.0<br/>━━━━━━━━━<br/>타입 안전성<br/>개발 생산성"]
        
        Vite["⚡ Vite 4.4<br/>━━━━━━━━━<br/>빠른 빌드<br/>HMR 지원"]
        
        Tailwind["🎨 TailwindCSS<br/>━━━━━━━━━<br/>유틸리티 우선<br/>반응형 디자인"]
        
        Query["🔄 React Query<br/>━━━━━━━━━<br/>서버 상태 관리<br/>캐싱 & 동기화"]
    end
    
    %% 백엔드 스택
    subgraph Backend["🚀 백엔드 스택"]
        direction TB
        Node["🟢 Node.js 18<br/>━━━━━━━━━<br/>JavaScript 런타임<br/>비동기 처리"]
        
        Express["🌐 Express.js<br/>━━━━━━━━━<br/>웹 프레임워크<br/>미들웨어 기반"]
        
        TS2["📘 TypeScript<br/>━━━━━━━━━<br/>서버사이드<br/>타입 안전성"]
        
        Socket["🔌 Socket.IO<br/>━━━━━━━━━<br/>실시간 통신<br/>양방향 이벤트"]
        
        Prisma["🔧 Prisma ORM<br/>━━━━━━━━━<br/>타입 안전 DB<br/>마이그레이션"]
    end
    
    %% AI 스택
    subgraph AI["🤖 AI 스택"]
        direction TB
        Python["🐍 Python 3.11<br/>━━━━━━━━━<br/>AI/ML 플랫폼<br/>풍부한 생태계"]
        
        FastAPI2["🔥 FastAPI<br/>━━━━━━━━━<br/>고성능 API<br/>비동기 지원"]
        
        Whisper["🎤 WhisperX<br/>━━━━━━━━━<br/>음성 인식<br/>large-v3 모델"]
        
        Qwen["🧠 Qwen3-32B<br/>━━━━━━━━━<br/>대화형 AI<br/>다국어 지원"]
        
        GPU2["⚡ NVIDIA A100<br/>━━━━━━━━━<br/>GPU 가속<br/>병렬 처리"]
    end
    
    %% 데이터 스택
    subgraph Data["💾 데이터 스택"]
        direction TB
        Postgres["🐘 PostgreSQL<br/>━━━━━━━━━<br/>관계형 DB<br/>ACID 보장"]
        
        Redis2["⚡ Redis<br/>━━━━━━━━━<br/>인메모리 캐시<br/>세션 저장"]
        
        MinIO2["💾 MinIO<br/>━━━━━━━━━<br/>오브젝트 스토리지<br/>S3 호환"]
        
        Docker2["🐳 Docker<br/>━━━━━━━━━<br/>컨테이너화<br/>일관된 환경"]
    end
    
    %% 외부 연동
    subgraph External["🔗 외부 연동"]
        direction TB
        SlackAPI2["📱 Slack API<br/>━━━━━━━━━<br/>봇 인터페이스<br/>이벤트 처리"]
        
        NotionAPI2["📝 Notion API<br/>━━━━━━━━━<br/>문서 자동화<br/>워크스페이스 연동"]
        
        JiraAPI2["🎯 JIRA API<br/>━━━━━━━━━<br/>이슈 트래킹<br/>프로젝트 관리"]
        
        OAuth["🔐 OAuth 2.0<br/>━━━━━━━━━<br/>보안 인증<br/>토큰 관리"]
    end
    
    %% 연결 관계
    React --> Query
    Node --> Express
    Express --> Socket
    Express --> Prisma
    Python --> FastAPI2
    FastAPI2 --> Whisper
    FastAPI2 --> Qwen
    Postgres --> Prisma
    
    %% 스타일 적용
    classDef frontendStyle fill:#f3e5ff,stroke:#8b5cf6,stroke-width:2px
    classDef backendStyle fill:#fff7ed,stroke:#f97316,stroke-width:2px
    classDef aiStyle fill:#fef2f2,stroke:#ef4444,stroke-width:2px
    classDef dataStyle fill:#eff6ff,stroke:#3b82f6,stroke-width:2px
    classDef externalStyle fill:#f0fdf4,stroke:#22c55e,stroke-width:2px
    
    class React,TS1,Vite,Tailwind,Query frontendStyle
    class Node,Express,TS2,Socket,Prisma backendStyle
    class Python,FastAPI2,Whisper,Qwen,GPU2 aiStyle
    class Postgres,Redis2,MinIO2,Docker2 dataStyle
    class SlackAPI2,NotionAPI2,JiraAPI2,OAuth externalStyle
```

---

## 📋 시스템 정보 요약

### 포트 구성
- **백엔드**: 3500 (Express API)
- **프론트엔드**: 3001 (Vite 개발서버)  
- **AI 엔진**: 8000 (개발), 8001 (Docker)
- **PostgreSQL**: 5432
- **Redis**: 6379
- **Socket.IO**: 8080

### 주요 워크플로우
1. **Slack**에서 음성/텍스트 입력
2. **AI 엔진**이 2단계 파이프라인 처리
3. **스마트 알고리즘**으로 업무 배정
4. **Notion/JIRA**에 자동 연동
5. **실시간 대시보드** 업데이트

### 시스템 특징
- **멀티테넌트 아키텍처**: 완전한 데이터 격리
- **AI 기반 자동화**: 95%+ 정확도
- **실시간 협업**: Socket.IO 양방향 통신
- **확장 가능**: Docker + 클라우드 네이티브
- **보안**: OAuth 2.0 + HTTPS/TLS