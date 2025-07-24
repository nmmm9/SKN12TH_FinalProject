# TtalKkak 프로젝트 데이터베이스 분할 설계서

## 1. 개요

### 1.1 목적
- 기존 단일 데이터베이스(`ddalkkak_new`)를 도메인별로 분할하여 시스템 확장성과 유지보수성 향상
- 각 도메인별 독립적인 관리 및 성능 최적화 달성

### 1.2 분할 전략
- **도메인 기반 분할(Domain-Driven Database Partition)** 적용
- 비즈니스 로직과 데이터 접근 패턴을 고려한 3개 데이터베이스로 구성

## 2. 데이터베이스 분할 구조

### 2.1 전체 구조 개요

```
기존: ddalkkak_new (단일 DB)
      ↓
분할: User_Auth_DB + Project_Task_DB + Analytics_Log_DB
```

### 2.2 각 데이터베이스별 상세 구성

#### 2.2.1 사용자 관리 데이터베이스 (User_Auth_DB)

**목적**: 사용자 인증, 권한 관리, 외부 서비스 연동

| 테이블 | 주요 필드 | 설명 |
|--------|-----------|------|
| `tenants` | id, name, slug, created_at | 조직/테넌트 정보 관리 |
| `users` | id, tenant_id, email, name, role, slack_user_id, jira_user_id, available_hours, experience_level, skills | 사용자 계정 및 프로필 정보 |
| `integrations` | id, tenant_id, user_id, service_type, access_token, refresh_token, config, is_active | 외부 서비스 OAuth 연동 설정 |

**특징**:
- 높은 보안 수준 요구
- 읽기 중심의 트래픽 패턴
- 상대적으로 낮은 데이터 변경 빈도

#### 2.2.2 프로젝트 관리 데이터베이스 (Project_Task_DB)

**목적**: 핵심 비즈니스 로직, 프로젝트 및 태스크 관리

| 테이블 | 주요 필드 | 설명 |
|--------|-----------|------|
| `slack_inputs` | id, tenant_id, slack_channel_id, slack_user_id, input_type, content, status | 슬랙 입력 처리 이력 |
| `projects` | id, tenant_id, slack_input_id, title, overview, content, notion_page_url, notion_status | 프로젝트 정보 |
| `tasks` | id, tenant_id, project_id, title, description, status, assignee_id, parent_id, priority, complexity, due_date | 태스크 정보 |
| `task_metadata` | id, task_id, estimated_hours, actual_hours, required_skills, task_type, jira_issue_key, jira_status | 태스크 상세 메타데이터 |

**특징**:
- 높은 트랜잭션 처리량
- CRUD 연산 중심
- 실시간 데이터 동기화 필요

#### 2.2.3 분석 및 로깅 데이터베이스 (Analytics_Log_DB)

**목적**: AI 분석 결과, 시스템 로그, 성능 모니터링

| 테이블 | 주요 필드 | 설명 |
|--------|-----------|------|
| `task_assignment_logs` | id, task_id, user_id, assigned_at, assignment_score, score_breakdown, reason, alternatives, algorithm_version | AI 태스크 배정 알고리즘 실행 로그 |

**특징**:
- 대용량 로그 데이터 처리
- 분석 쿼리 중심
- 시계열 데이터 특성

## 3. 데이터베이스 간 관계

### 3.1 키 관계도

```
User_Auth_DB.tenants.id ──┐
                          ├─ tenant_id (모든 DB의 공통 키)
                          └─ Project_Task_DB, Analytics_Log_DB

User_Auth_DB.users.id ────── user_id (사용자 관련 데이터 연결)

Project_Task_DB.tasks.id ─── task_id (태스크 관련 메타데이터 연결)
```

### 3.2 참조 무결성

- **tenant_id**: 모든 데이터베이스를 관통하는 조직 식별자
- **Cross-DB 조인**: 애플리케이션 레벨에서 처리
- **데이터 일관성**: 분산 트랜잭션 또는 Saga 패턴 적용

## 4. 분할의 장점

### 4.1 성능 향상
- 각 도메인별 최적화된 인덱싱 전략 적용
- 쿼리 성능 개선 (테이블 크기 감소)
- 병렬 처리를 통한 응답 시간 단축

### 4.2 확장성
- 도메인별 독립적인 스케일링
- 서로 다른 하드웨어 사양 적용 가능
- 마이크로서비스 아키텍처 지원

### 4.3 유지보수성
- 도메인별 책임 분리
- 개발팀 간 독립적인 작업 환경
- 장애 격리 효과

### 4.4 보안
- 민감한 사용자 데이터 격리
- 세밀한 접근 권한 제어
- 감사 추적 개선

## 5. 구현 고려사항

### 5.1 마이그레이션 전략
1. **Phase 1**: 읽기 전용 복제본 생성
2. **Phase 2**: 애플리케이션 레이어 수정
3. **Phase 3**: 점진적 데이터 마이그레이션
4. **Phase 4**: 기존 DB 정리

### 5.2 애플리케이션 수정사항
- 다중 데이터소스 설정
- Cross-DB 조인 로직 구현
- 분산 트랜잭션 처리
- 에러 핸들링 강화

### 5.3 모니터링
- 각 DB별 성능 지표 수집
- Cross-DB 쿼리 성능 모니터링
- 데이터 일관성 검증

## 6. 결론

기존 `ddalkkak_new` 데이터베이스를 도메인별로 3개로 분할함으로써:
- **User_Auth_DB**: 사용자 및 인증 관리의 보안성 강화
- **Project_Task_DB**: 핵심 비즈니스 로직의 성능 최적화  
- **Analytics_Log_DB**: 분석 데이터의 효율적 처리

이를 통해 시스템의 확장성, 성능, 유지보수성을 크게 향상시킬 수 있을 것으로 예상됩니다.

---

*생성일: 2025-07-21*  
*작성자: TtalKkak 개발팀*  
*버전: 1.0*