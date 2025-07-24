# TtalKkak 컨텍스트 다이어그램

## 개요
TtalKkak 시스템과 외부 사용자 및 시스템 간의 관계를 나타내는 최상위 다이어그램입니다.

## Mermaid 다이어그램

```mermaid
graph TB
    %% 외부 사용자
    PM[프로젝트 매니저<br/>Project Manager]
    DEV[개발자<br/>Developer]
    TEAM[팀 멤버<br/>Team Member]
    
    %% 핵심 시스템
    TTALKKAK[TtalKkak<br/>AI 기반 프로젝트 관리 시스템<br/>🎯 음성 입력을 통한 자동 업무 생성]
    
    %% 외부 시스템
    SLACK[Slack<br/>🤖 Slack Bot & API<br/>- 음성 파일 업로드<br/>- 실시간 알림<br/>- 명령어 처리]
    
    NOTION[Notion<br/>📝 Notion API<br/>- 자동 페이지 생성<br/>- 프로젝트 문서화<br/>- 구조화된 내용]
    
    JIRA[JIRA<br/>🎫 Atlassian API<br/>- 자동 이슈 생성<br/>- Epic/Task 매핑<br/>- 워크플로우 관리]
    
    AI_SERVER[AI 서버<br/>🧠 Runpod AI Engine<br/>- 음성 전사 (WhisperX)<br/>- 텍스트 분석 (Qwen3-32B)<br/>- 2단계 파이프라인]
    
    %% 데이터베이스
    DB[(PostgreSQL<br/>🗃️ 데이터베이스<br/>- 멀티테넌트 데이터<br/>- 사용자 정보<br/>- 프로젝트 & 업무)]
    
    %% 연결 관계
    PM --> TTALKKAK
    DEV --> TTALKKAK
    TEAM --> TTALKKAK
    
    TTALKKAK <--> SLACK
    TTALKKAK <--> NOTION
    TTALKKAK <--> JIRA
    TTALKKAK <--> AI_SERVER
    TTALKKAK <--> DB
    
    %% 사용자와 외부 시스템 간 직접 연결
    PM -.-> SLACK
    DEV -.-> SLACK
    TEAM -.-> SLACK
    
    PM -.-> NOTION
    DEV -.-> NOTION
    TEAM -.-> NOTION
    
    PM -.-> JIRA
    DEV -.-> JIRA
    TEAM -.-> JIRA
    
    %% 스타일링
    classDef userStyle fill:#e1f5fe,stroke:#0277bd,stroke-width:2px
    classDef systemStyle fill:#f3e5f5,stroke:#7b1fa2,stroke-width:3px
    classDef externalStyle fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef dataStyle fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    
    class PM,DEV,TEAM userStyle
    class TTALKKAK systemStyle
    class SLACK,NOTION,JIRA,AI_SERVER externalStyle
    class DB dataStyle
```

## 주요 구성 요소

### 사용자 (Actors)
- **프로젝트 매니저**: 프로젝트 기획 및 관리
- **개발자**: 기술 업무 수행
- **팀 멤버**: 일반 업무 참여자

### 핵심 시스템
- **TtalKkak**: AI 기반 프로젝트 관리 시스템 (중앙 허브)

### 외부 시스템
- **Slack**: 사용자 인터페이스 및 알림
- **Notion**: 문서 관리 및 기획서 생성
- **JIRA**: 업무 추적 및 프로젝트 관리
- **AI 서버**: 음성 처리 및 자동 분석

### 데이터 저장소
- **PostgreSQL**: 멀티테넌트 데이터 관리

## 주요 상호작용
1. 사용자가 Slack을 통해 음성 입력
2. TtalKkak이 AI 서버로 음성 처리 요청
3. 처리된 결과를 Notion 페이지로 자동 생성
4. 관련 업무를 JIRA 이슈로 자동 생성
5. 모든 결과를 Slack으로 실시간 알림