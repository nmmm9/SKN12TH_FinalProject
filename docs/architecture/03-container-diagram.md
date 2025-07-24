# TtalKkak 컨테이너 다이어그램

## 개요
TtalKkak 시스템의 주요 컨테이너(애플리케이션, 서비스, 데이터베이스)와 그들 간의 관계를 보여줍니다.

## Mermaid 다이어그램

```mermaid
graph TB
    %% 사용자 및 외부 시스템
    USERS[👥 사용자<br/>PM, 개발자, 팀원]
    
    %% 클라이언트 애플리케이션
    subgraph "클라이언트 레이어"
        WEB[🌐 웹 대시보드<br/>React + TypeScript<br/>Port: 3000<br/>- 프로젝트 관리<br/>- 대시보드<br/>- 설정 관리]
        
        SLACK_CLIENT[📱 Slack 클라이언트<br/>@slack/bolt<br/>- 명령어 처리<br/>- 파일 업로드<br/>- 실시간 알림]
        
        CHROME[🔗 Chrome 확장<br/>JavaScript<br/>- 웹 페이지 연동<br/>- 빠른 업무 생성]
    end
    
    %% API 게이트웨이
    GATEWAY[🚪 API 게이트웨이<br/>Express.js<br/>Port: 3500<br/>- 라우팅<br/>- 인증/인가<br/>- 레이트 리미팅]
    
    %% 백엔드 서비스
    subgraph "백엔드 서비스"
        BACKEND[🔧 백엔드 API<br/>Node.js + Express<br/>Port: 3500<br/>- 멀티테넌트 지원<br/>- OAuth 인증<br/>- 비즈니스 로직]
        
        SLACK_HANDLER[🤖 Slack 핸들러<br/>@slack/bolt<br/>- 봇 명령 처리<br/>- 이벤트 리스너<br/>- 모달 처리]
        
        AI_CONNECTOR[🧠 AI 커넥터<br/>HTTP Client<br/>- AI 서버 통신<br/>- 2단계 파이프라인<br/>- 에러 처리]
    end
    
    %% 비즈니스 서비스
    subgraph "비즈니스 서비스"
        NOTION_SVC[📝 Notion 서비스<br/>@notionhq/client<br/>- 페이지 생성<br/>- 블록 구조화<br/>- OAuth 관리]
        
        JIRA_SVC[🎫 JIRA 서비스<br/>Atlassian API<br/>- 이슈 생성<br/>- Epic/Task 매핑<br/>- 토큰 관리]
        
        TASK_ASSIGNER[🎯 업무 배정 서비스<br/>스코어링 알고리즘<br/>- 스킬 매칭<br/>- 워크로드 분석<br/>- 최적화]
    end
    
    %% 외부 AI 서비스
    subgraph "AI 엔진"
        AI_SERVER[🤖 AI 서버<br/>FastAPI + Python<br/>Runpod GPU<br/>- WhisperX (음성 전사)<br/>- Qwen3-32B (텍스트 분석)<br/>- 2단계 파이프라인]
    end
    
    %% 데이터 저장소
    subgraph "데이터 레이어"
        POSTGRES[(🗃️ PostgreSQL<br/>Port: 5432<br/>- 멀티테넌트 데이터<br/>- 사용자 정보<br/>- 프로젝트 & 업무<br/>- 연동 설정)]
        
        REDIS[(⚡ Redis<br/>Port: 6379<br/>- 세션 캐시<br/>- 임시 데이터<br/>- 작업 큐)]
        
        FILE_STORAGE[📁 파일 저장소<br/>임시 파일<br/>- 음성 파일<br/>- 전사 결과<br/>- 로그 파일]
    end
    
    %% 외부 서비스
    subgraph "외부 서비스"
        SLACK_API[📱 Slack API<br/>slack.com<br/>- 봇 토큰<br/>- 웹훅<br/>- 파일 업로드]
        
        NOTION_API[📝 Notion API<br/>api.notion.com<br/>- OAuth 2.0<br/>- 페이지 생성<br/>- 블록 조작]
        
        JIRA_API[🎫 JIRA API<br/>atlassian.com<br/>- OAuth 2.0<br/>- 이슈 생성<br/>- 프로젝트 관리]
    end
    
    %% 모니터링 및 로깅
    subgraph "관찰성"
        LOGGING[📊 로깅<br/>Winston<br/>- 구조화된 로그<br/>- 에러 추적<br/>- 성능 모니터링]
        
        METRICS[📈 메트릭<br/>사용자 정의<br/>- API 응답 시간<br/>- 처리량<br/>- 에러율]
    end
    
    %% 연결 관계
    USERS --> WEB
    USERS --> SLACK_CLIENT
    USERS --> CHROME
    
    WEB --> GATEWAY
    CHROME --> GATEWAY
    
    SLACK_CLIENT --> SLACK_API
    SLACK_API --> SLACK_HANDLER
    
    GATEWAY --> BACKEND
    SLACK_HANDLER --> BACKEND
    
    BACKEND --> AI_CONNECTOR
    BACKEND --> NOTION_SVC
    BACKEND --> JIRA_SVC
    BACKEND --> TASK_ASSIGNER
    
    AI_CONNECTOR --> AI_SERVER
    NOTION_SVC --> NOTION_API
    JIRA_SVC --> JIRA_API
    
    BACKEND --> POSTGRES
    BACKEND --> REDIS
    BACKEND --> FILE_STORAGE
    
    BACKEND --> LOGGING
    BACKEND --> METRICS
    
    %% 스타일링
    classDef userStyle fill:#e1f5fe,stroke:#0277bd,stroke-width:2px
    classDef clientStyle fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef backendStyle fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef serviceStyle fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    classDef aiStyle fill:#ffebee,stroke:#d32f2f,stroke-width:2px
    classDef dataStyle fill:#f1f8e9,stroke:#558b2f,stroke-width:2px
    classDef externalStyle fill:#fafafa,stroke:#616161,stroke-width:2px
    classDef monitorStyle fill:#e0f2f1,stroke:#00796b,stroke-width:2px
    
    class USERS userStyle
    class WEB,SLACK_CLIENT,CHROME clientStyle
    class GATEWAY,BACKEND,SLACK_HANDLER,AI_CONNECTOR backendStyle
    class NOTION_SVC,JIRA_SVC,TASK_ASSIGNER serviceStyle
    class AI_SERVER aiStyle
    class POSTGRES,REDIS,FILE_STORAGE dataStyle
    class SLACK_API,NOTION_API,JIRA_API externalStyle
    class LOGGING,METRICS monitorStyle
```

## 컨테이너 상세 설명

### 클라이언트 레이어
- **웹 대시보드**: React 기반 관리자 인터페이스
- **Slack 클라이언트**: 주요 사용자 인터페이스
- **Chrome 확장**: 웹 브라우저 연동

### 백엔드 서비스
- **API 게이트웨이**: 중앙 집중식 라우팅 및 보안
- **백엔드 API**: 핵심 비즈니스 로직
- **Slack 핸들러**: Slack 이벤트 전용 처리

### 비즈니스 서비스
- **Notion 서비스**: 문서 생성 및 관리
- **JIRA 서비스**: 이슈 추적 및 프로젝트 관리
- **업무 배정 서비스**: 스마트 알고리즘 기반 배정

### AI 엔진
- **AI 서버**: GPU 기반 음성/텍스트 처리

### 데이터 레이어
- **PostgreSQL**: 영구 데이터 저장
- **Redis**: 캐시 및 세션 관리
- **파일 저장소**: 임시 파일 관리

## 기술 스택별 포트 정보
- **웹 대시보드**: 3000
- **백엔드 API**: 3500
- **PostgreSQL**: 5432
- **Redis**: 6379
- **AI 서버**: Runpod (외부)

## 통신 프로토콜
- **HTTP/HTTPS**: REST API 통신
- **WebSocket**: 실시간 알림
- **OAuth 2.0**: 외부 서비스 인증
- **JWT**: 내부 인증 토큰

## 확장성 고려사항
- **수평 확장**: 백엔드 API 다중 인스턴스
- **캐시 분산**: Redis 클러스터
- **로드 밸런싱**: API 게이트웨이 레벨
- **마이크로서비스**: 서비스별 독립 배포 가능