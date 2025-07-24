# TtalKkak 데이터 플로우 다이어그램

## 개요
TtalKkak 시스템의 핵심 워크플로우인 "음성 입력 → AI 처리 → 자동 업무 생성" 과정의 데이터 흐름을 보여줍니다.

## Mermaid 다이어그램

```mermaid
flowchart TD
    %% 시작점
    USER[👤 사용자]
    
    %% 1단계: 음성 입력
    A1[📱 Slack '/tk start' 명령]
    A2[🎙️ 음성 파일 업로드<br/>최대 100MB]
    A3[📝 회의록 텍스트 입력]
    
    %% 2단계: 전처리
    B1[🔍 파일 검증<br/>- 타입 확인<br/>- 크기 제한]
    B2[💾 임시 저장<br/>transcript-input.txt]
    
    %% 3단계: AI 처리 (2단계 파이프라인)
    C1[🧠 AI 서버 호출<br/>Runpod AI Engine]
    
    %% Stage 1: 음성 → 기획안
    D1[🎯 Stage 1 처리]
    D2[🎤 WhisperX 음성 전사<br/>large-v3 모델]
    D3[📊 회의록 구조화<br/>Qwen3-32B-AWQ]
    D4[📋 Notion 기획안 생성<br/>- 프로젝트 개요<br/>- 섹션별 내용]
    
    %% Stage 2: 기획안 → 업무
    E1[🎯 Stage 2 처리]
    E2[📝 PRD 생성<br/>Product Requirements Document]
    E3[⚡ Task Master 변환<br/>- Epic 생성<br/>- Task 분해<br/>- 우선순위 설정]
    E4[📊 업무 메타데이터<br/>- 예상 시간<br/>- 필요 스킬<br/>- 복잡도]
    
    %% 4단계: 스마트 업무 배정
    F1[🎭 스마트 업무 배정<br/>Smart Task Assigner]
    F2[📊 사용자 프로필 분석<br/>- 스킬 매칭 40%<br/>- 워크로드 30%<br/>- 경험 수준 20%<br/>- 우선순위 10%]
    F3[🎯 최적 배정 계산<br/>스코어링 알고리즘]
    
    %% 5단계: 외부 시스템 연동
    G1[📝 Notion 페이지 생성]
    G2[🎫 JIRA 이슈 생성<br/>- Epic 생성<br/>- Task 생성<br/>- 계층 구조 매핑]
    G3[💾 데이터베이스 저장<br/>PostgreSQL]
    
    %% 6단계: 알림 및 결과
    H1[📢 Slack 알림<br/>- 진행 상황<br/>- 생성된 링크<br/>- 배정 결과]
    H2[🔗 결과 링크 제공<br/>- Notion 페이지 URL<br/>- JIRA 프로젝트 URL]
    
    %% 데이터 저장소
    DB1[(🗃️ PostgreSQL<br/>- 프로젝트 정보<br/>- 업무 데이터<br/>- 사용자 프로필)]
    DB2[(🔄 Redis Cache<br/>- 세션 정보<br/>- 임시 데이터)]
    
    %% 연결 관계
    USER --> A1
    A1 --> A2
    A1 --> A3
    A2 --> B1
    A3 --> B1
    B1 --> B2
    B2 --> C1
    
    %% AI 처리 파이프라인
    C1 --> D1
    D1 --> D2
    D2 --> D3
    D3 --> D4
    D4 --> E1
    E1 --> E2
    E2 --> E3
    E3 --> E4
    
    %% 스마트 배정
    E4 --> F1
    F1 --> F2
    F2 --> F3
    
    %% 외부 연동
    F3 --> G1
    F3 --> G2
    F3 --> G3
    G3 --> DB1
    
    %% 결과 전달
    G1 --> H1
    G2 --> H1
    H1 --> H2
    H2 --> USER
    
    %% 데이터 참조
    F2 -.-> DB1
    G3 -.-> DB2
    
    %% 스타일링
    classDef userStyle fill:#e1f5fe,stroke:#0277bd,stroke-width:2px
    classDef inputStyle fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef processStyle fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef aiStyle fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    classDef outputStyle fill:#fce4ec,stroke:#c2185b,stroke-width:2px
    classDef dataStyle fill:#f1f8e9,stroke:#558b2f,stroke-width:2px
    
    class USER userStyle
    class A1,A2,A3 inputStyle
    class B1,B2,F1,F2,F3 processStyle
    class C1,D1,D2,D3,D4,E1,E2,E3,E4 aiStyle
    class G1,G2,G3,H1,H2 outputStyle
    class DB1,DB2 dataStyle
```

## 상세 데이터 흐름 설명

### 1. 입력 단계
- **음성 파일**: WAV, MP3 등 (최대 100MB)
- **텍스트 입력**: 직접 회의록 입력 가능
- **파일 검증**: 타입, 크기, 보안 검사

### 2. AI 처리 파이프라인
#### Stage 1: 음성 → 기획안
```json
{
  "transcript": "전사된 텍스트",
  "notion_project": {
    "title": "프로젝트명",
    "overview": "개요",
    "sections": [
      {
        "title": "섹션명",
        "content": "상세 내용"
      }
    ]
  }
}
```

#### Stage 2: 기획안 → 업무
```json
{
  "task_master_prd": {
    "title": "시스템 개발",
    "tasks": [
      {
        "title": "업무명",
        "description": "업무 설명",
        "priority": "HIGH|MEDIUM|LOW",
        "estimated_hours": 40,
        "complexity": "HIGH|MEDIUM|LOW",
        "subtasks": [...]
      }
    ]
  }
}
```

### 3. 스마트 배정 알고리즘
```typescript
// 스코어링 공식
totalScore = (skillScore * 0.4) + 
            (workloadScore * 0.3) + 
            (experienceScore * 0.2) + 
            (priorityScore * 0.1)
```

### 4. 외부 연동 데이터
- **Notion API**: 페이지 생성, 블록 구조화
- **JIRA API**: 이슈 생성, Epic-Task 매핑
- **Slack API**: 실시간 알림, 버튼 인터렉션

### 5. 에러 처리
- AI 서버 장애 시 더미 데이터 사용
- 토큰 만료 시 자동 갱신
- 파일 업로드 실패 시 재시도 로직

## 성능 최적화
- **비동기 처리**: 모든 외부 API 호출
- **병렬 처리**: Notion/JIRA 동시 생성
- **캐시 활용**: 사용자 프로필, 설정 정보
- **스트리밍**: 대용량 파일 처리