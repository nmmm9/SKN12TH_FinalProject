# TtalKkak - AI 기반 프로젝트 관리 시스템

## 📋 프로젝트 개요

TtalKkak은 음성 인식과 AI를 활용해 회의록을 자동 생성하고, 팀원별 업무를 지능적으로 배정하는 혁신적인 프로젝트 관리 솔루션입니다.

### 🎯 주요 기능

- **음성 인식 회의록**: 실시간 음성을 텍스트로 변환하여 자동으로 회의록 생성
- **AI 기반 업무 배정**: 회의 내용을 분석하여 적절한 팀원에게 자동으로 업무 배정
- **팀 협업 최적화**: Slack, Notion, JIRA와 연동하여 원활한 팀 협업 지원
- **실시간 대시보드**: 프로젝트 진행 상황을 한눈에 파악할 수 있는 직관적인 인터페이스

## 🏗️ 프로젝트 구조

```
├── frontend/
│   └── web-dashboard/          # React + TypeScript 웹 대시보드
│       ├── src/
│       │   ├── pages/
│       │   │   ├── Landing.tsx     # 메인 랜딩 페이지
│       │   │   ├── Dashboard.tsx   # 대시보드 페이지
│       │   │   ├── MeetingAnalysis.tsx
│       │   │   ├── TaskManagement.tsx
│       │   │   └── Settings.tsx
│       │   ├── components/
│       │   │   ├── Layout.tsx
│       │   │   ├── Sidebar.tsx
│       │   │   ├── MainContent.tsx
│       │   │   └── KanbanBoard.tsx
│       │   └── services/
│       │       └── api.ts
│       ├── chrome-extension/   # Chrome 확장 프로그램
│       └── slack-app/         # Slack 앱
├── backend/                   # FastAPI 백엔드 서버
├── ai-engine-dev/            # AI 엔진 개발
├── Bert모델/                 # BERT 모델 관련
└── docker-compose.yml        # 컨테이너 설정
```

## 🚀 시작하기

### 사전 요구사항

- Node.js 18.x 이상
- Python 3.9 이상
- Docker (선택사항)

### 개발 환경 설정

1. **프로젝트 클론**
   ```bash
   git clone <repository-url>
   cd ttalkkak
   ```

2. **프론트엔드 설정**
   ```bash
   cd frontend/web-dashboard
   npm install
   npm run dev
   ```
   
   개발 서버가 `http://localhost:3001`에서 실행됩니다.

3. **백엔드 설정**
   ```bash
   cd backend
   pip install -r requirements.txt
   python main.py
   ```

4. **Docker를 사용한 전체 환경 실행**
   ```bash
   docker-compose up
   ```

## 🎨 디자인 시스템

### 색상 팔레트

- **Primary (Brand)**: `#8BC34A` (Light Green)
- **Secondary Colors**: 
  - Blue: `#3B82F6`
  - Green: `#10B981`
  - Amber: `#F59E0B`
  - Red: `#EF4444`
  - Purple: `#8B5CF6`

### 컴포넌트 스타일

- **카드**: 둥근 모서리, 부드러운 그림자
- **버튼**: 호버 시 스케일 효과
- **애니메이션**: Framer Motion을 사용한 부드러운 전환
- **반응형**: Mobile-first 접근 방식

## 🛠️ 기술 스택

### Frontend
- **React 18** + **TypeScript**
- **Tailwind CSS** - 유틸리티 퍼스트 CSS 프레임워크
- **Framer Motion** - 애니메이션 라이브러리
- **React Router** - 클라이언트 사이드 라우팅
- **React Query** - 서버 상태 관리
- **Lucide React** - 아이콘 라이브러리

### Backend
- **FastAPI** - 현대적인 Python 웹 프레임워크
- **Socket.IO** - 실시간 통신
- **PostgreSQL** - 데이터베이스

### AI & ML
- **BERT** - 자연어 처리
- **Speech-to-Text** - 음성 인식
- **TensorFlow/PyTorch** - 머신러닝 프레임워크

## 📱 주요 페이지

### 1. 랜딩 페이지 (`/`)
- 제품 소개 및 주요 기능 설명
- 고객 후기 및 요금제 정보
- 반응형 디자인으로 모든 기기에서 최적화

### 2. 대시보드 (`/dashboard`)
- 실시간 프로젝트 현황
- 통계 및 분석 정보
- 빠른 액션 버튼들

### 3. 회의 분석 (`/dashboard/meeting`)
- 음성 파일 업로드 및 분석
- 회의록 자동 생성
- AI 기반 인사이트 제공

### 4. 업무 관리 (`/dashboard/task`)
- 칸반 보드 스타일 태스크 관리
- 팀원별 업무 배정
- 진행 상황 추적

## 🔧 개발 가이드

### 코드 스타일

```typescript
// 컴포넌트 예시
const ExampleComponent = () => {
  const [state, setState] = useState<Type>(initialValue);
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="card hover-lift"
    >
      {/* 컴포넌트 내용 */}
    </motion.div>
  );
};
```

### CSS 클래스 규칙

- **유틸리티 우선**: Tailwind CSS 클래스 사용
- **커스텀 클래스**: `@layer components`에서 정의
- **애니메이션**: Framer Motion 활용
- **반응형**: `sm:`, `md:`, `lg:` 접두사 사용

### 컴포넌트 구조

```
src/components/
├── Layout.tsx          # 전체 레이아웃
├── Sidebar.tsx         # 사이드바 네비게이션
├── MainContent.tsx     # 메인 콘텐츠 영역
└── ui/                 # 재사용 가능한 UI 컴포넌트
    ├── Button.tsx
    ├── Card.tsx
    └── Modal.tsx
```

## 🚀 배포

### 프로덕션 빌드

```bash
cd frontend/web-dashboard
npm run build
```

### Docker 배포

```bash
docker-compose -f docker-compose.prod.yml up -d
```

## 🤝 기여 가이드

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

## 📞 연락처

- **프로젝트 관리자**: TtalKkak Team
- **이메일**: contact@ttalkkak.com
- **웹사이트**: https://ttalkkak.com

---

⭐ 이 프로젝트가 도움이 되었다면 스타를 눌러주세요!