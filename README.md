# 🚀 DdalKkak - 지능형 AI Agent Slack App

## 📖 프로젝트 개요

**DdalKkak**는 IT 기획 및 개발 업무를 위한 지능형 AI Agent Slack App으로, 회의 내용을 자동으로 분석하여 체계적인 업무 분해와 팀원 배정을 수행하는 혁신적인 워크플로우 시스템입니다.

### 🎯 핵심 기능

- **3가지 음성 입력 방식**: 파일 업로드 + 실시간 STT + 온라인 회의 연동
- **AI 기반 업무 분해**: Qwen3 모델 기반 지능형 업무 분석 및 분해
- **스마트 팀원 배정**: 하이브리드 알고리즘을 통한 최적 배정
- **멀티플랫폼 통합**: Slack/Notion/Jira 완전 자동 연동
- **실시간 처리**: WebSocket 기반 실시간 STT 및 협업

## 🏗️ 아키텍처

```
┌─────────────────────────────────────────┐
│              Frontend Layer              │
├─────────────────────────────────────────┤
│ Slack App │ Web Dashboard │ Chrome Ext. │
├─────────────────────────────────────────┤
│              API Gateway                │
├─────────────────────────────────────────┤
│          Application Layer              │
├─────────────────────────────────────────┤
│ Node.js   │ Python    │ Whisper │ Qwen3 │
│ Backend   │ AI Engine │ STT     │ LLM   │
├─────────────────────────────────────────┤
│              Data Layer                 │
├─────────────────────────────────────────┤
│ PostgreSQL │ Redis │ Vector DB │ Files │
└─────────────────────────────────────────┘
```

## 🛠️ 기술 스택

### Backend
- **Node.js 18+** with Express.js
- **Python 3.11+** with FastAPI
- **PostgreSQL 15** (주 데이터베이스)
- **Redis 7** (캐싱 및 실시간 처리)

### AI/ML
- **Qwen3-14B** (파인튜닝 모델)
- **Whisper Large-v3** (오픈소스 STT)
- **BGE M3-Embedding** (벡터 임베딩)

### Frontend
- **React 18** with TypeScript
- **Tailwind CSS** + **Shadcn/ui**
- **Slack Block Kit** (Slack App UI)
- **Chrome Extension** (온라인 회의 연동)

### Infrastructure
- **Docker** + **Docker Compose**
- **GitHub Actions** (CI/CD)
- **Prometheus** + **Grafana** (모니터링)

## 🚀 빠른 시작

### 1. 환경 요구사항
- Node.js 18 이상
- Python 3.11 이상
- Docker & Docker Compose
- PostgreSQL 15
- Redis 7

### 2. 클론 및 설치
```bash
git clone https://github.com/your-org/ddalkkak.git
cd ddalkkak

# 의존성 설치
npm run install:all

# 환경 변수 설정
cp .env.example .env
# .env 파일 편집 필요

# Docker 컨테이너 시작
docker-compose up -d

# 데이터베이스 마이그레이션
npm run db:migrate

# 개발 서버 시작
npm run dev
```

### 3. 개발 환경 설정
```bash
# 백엔드 개발 서버
cd backend && npm run dev

# AI 엔진 개발 서버
cd ai-engine && python -m uvicorn main:app --reload

# 프론트엔드 개발 서버
cd frontend/web-dashboard && npm run dev
```

## 📁 프로젝트 구조

```
ddalkkak/
├── backend/                 # Node.js 백엔드 서버
│   ├── src/
│   │   ├── routes/         # API 라우트
│   │   ├── controllers/    # 비즈니스 로직
│   │   ├── models/         # 데이터 모델
│   │   ├── services/       # 외부 서비스 연동
│   │   ├── middleware/     # 미들웨어
│   │   └── utils/          # 유틸리티
│   └── package.json
├── ai-engine/              # Python AI 처리 엔진
│   ├── src/
│   ├── models/             # AI 모델 저장소
│   ├── processors/         # STT, 기획안 변환 등
│   └── requirements.txt
├── frontend/
│   ├── slack-app/          # Slack App UI
│   ├── web-dashboard/      # 웹 대시보드
│   └── chrome-extension/   # 크롬 확장 프로그램
├── database/
│   ├── migrations/         # DB 마이그레이션
│   └── seeds/             # 초기 데이터
├── docker/                 # Docker 설정
├── docs/                   # 문서
└── scripts/               # 배포/유틸리티 스크립트
```

## 🔧 개발 가이드

### API 개발
- RESTful API 설계 원칙 준수
- OpenAPI 3.0 명세 작성
- 인증/인가: JWT + Slack OAuth
- 에러 핸들링: 표준 HTTP 상태 코드 사용

### AI 모델 개발
- Qwen3 파인튜닝 가이드라인 준수
- 데이터 품질 관리 (65,000개 훈련 데이터)
- 모델 성능 지표 추적
- A/B 테스트를 통한 최적화

### 프론트엔드 개발
- React 18 + TypeScript 사용
- Atomic Design 패턴 적용
- 접근성 준수 (WCAG 2.1 AA)
- 반응형 디자인 구현

## 📊 성능 목표

- **실시간 STT 지연**: 2초 이내
- **전체 처리 시간**: 회의 종료 후 3분 이내
- **시스템 가용성**: 99.9%
- **AI 정확도**: 85% 이상
- **동시 사용자**: 1,000명 지원

## 🔒 보안

- **데이터 암호화**: AES-256 암호화
- **토큰 관리**: JWT + 리프레시 토큰
- **API 보안**: Rate Limiting + API Key
- **개인정보 보호**: GDPR 준수

## 🚀 배포

### 개발 환경
```bash
npm run deploy:dev
```

### 스테이징 환경
```bash
npm run deploy:staging
```

### 프로덕션 환경
```bash
npm run deploy:prod
```

## 📈 모니터링

- **애플리케이션 모니터링**: Prometheus + Grafana
- **로그 관리**: ELK Stack
- **에러 추적**: Sentry
- **성능 분석**: New Relic

## 🤝 기여 가이드

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 라이선스

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 팀

- **프로젝트 매니저**: [이름]
- **백엔드 개발자**: [이름]
- **AI 엔지니어**: [이름]
- **프론트엔드 개발자**: [이름]
- **DevOps 엔지니어**: [이름]

## 📞 연락처

- **이메일**: contact@ddalkkak.com
- **Slack**: #ddalkkak-dev
- **문서**: https://docs.ddalkkak.com

---

**DdalKkak** - 회의에서 실행까지, 한 번에 해결하는 AI 업무 자동화 플랫폼 🚀