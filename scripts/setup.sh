#!/bin/bash

# DdalKkak 프로젝트 초기 설정 스크립트

echo "🚀 DdalKkak 프로젝트 초기 설정을 시작합니다..."
echo ""

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 함수 정의
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 1. 필수 도구 확인
print_status "1. 필수 도구 확인 중..."

# Node.js 확인
if ! command -v node &> /dev/null; then
    print_error "Node.js가 설치되어 있지 않습니다. Node.js 18 이상을 설치해주세요."
    exit 1
fi

NODE_VERSION=$(node --version)
print_success "Node.js 버전: $NODE_VERSION"

# Python 확인
if ! command -v python3 &> /dev/null; then
    print_error "Python3가 설치되어 있지 않습니다. Python 3.11 이상을 설치해주세요."
    exit 1
fi

PYTHON_VERSION=$(python3 --version)
print_success "Python 버전: $PYTHON_VERSION"

# Docker 확인
if ! command -v docker &> /dev/null; then
    print_warning "Docker가 설치되어 있지 않습니다. Docker를 설치하면 더 편리하게 개발할 수 있습니다."
else
    DOCKER_VERSION=$(docker --version)
    print_success "Docker 버전: $DOCKER_VERSION"
fi

echo ""

# 2. 환경 변수 파일 설정
print_status "2. 환경 변수 파일 설정 중..."

if [ ! -f ".env" ]; then
    cp .env.example .env
    print_success "환경 변수 파일 생성 완료 (.env)"
    print_warning "⚠️  .env 파일을 편집하여 필요한 설정을 완료해주세요."
else
    print_warning "환경 변수 파일이 이미 존재합니다."
fi

echo ""

# 3. 의존성 설치
print_status "3. 의존성 설치 중..."

# 루트 의존성 설치
print_status "루트 프로젝트 의존성 설치..."
npm install
print_success "루트 의존성 설치 완료"

# 백엔드 의존성 설치
print_status "백엔드 의존성 설치..."
cd backend && npm install && cd ..
print_success "백엔드 의존성 설치 완료"

# AI 엔진 의존성 설치
print_status "AI 엔진 의존성 설치..."
cd ai-engine && pip install -r requirements.txt && cd ..
print_success "AI 엔진 의존성 설치 완료"

# 프론트엔드 의존성 설치
print_status "프론트엔드 의존성 설치..."

if [ -d "frontend/slack-app" ]; then
    cd frontend/slack-app && npm install && cd ../..
    print_success "Slack App 의존성 설치 완료"
fi

if [ -d "frontend/web-dashboard" ]; then
    cd frontend/web-dashboard && npm install && cd ../..
    print_success "Web Dashboard 의존성 설치 완료"
fi

if [ -d "frontend/chrome-extension" ]; then
    cd frontend/chrome-extension && npm install && cd ../..
    print_success "Chrome Extension 의존성 설치 완료"
fi

echo ""

# 4. Docker 환경 설정 (선택사항)
if command -v docker &> /dev/null; then
    print_status "4. Docker 환경 설정 중..."
    
    read -p "Docker 컨테이너를 시작하시겠습니까? (y/n): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Docker 이미지 빌드 중..."
        docker-compose build
        
        print_status "Docker 컨테이너 시작 중..."
        docker-compose up -d
        
        print_status "서비스 시작 대기 중..."
        sleep 15
        
        print_success "Docker 환경 설정 완료"
        
        # 데이터베이스 마이그레이션
        print_status "데이터베이스 마이그레이션 실행 중..."
        cd backend && npm run db:migrate && cd ..
        print_success "데이터베이스 마이그레이션 완료"
    else
        print_warning "Docker 환경 설정을 건너뛰었습니다."
    fi
else
    print_warning "4. Docker가 설치되어 있지 않아 건너뛰었습니다."
fi

echo ""

# 5. 개발 환경 확인
print_status "5. 개발 환경 확인 중..."

# 서비스 포트 확인
print_status "서비스 포트 확인:"
echo "  - 백엔드 API: http://localhost:3000"
echo "  - AI 엔진: http://localhost:8001"
echo "  - Web Dashboard: http://localhost:3001"
echo "  - PostgreSQL: localhost:5432"
echo "  - Redis: localhost:6379"
echo "  - MinIO: http://localhost:9000"

echo ""

# 6. 설정 완료
print_success "🎉 DdalKkak 프로젝트 초기 설정이 완료되었습니다!"
echo ""
echo "다음 단계:"
echo "1. 📝 .env 파일을 편집하여 필요한 API 키와 설정을 완료하세요"
echo "2. 🔑 Slack App 설정 및 OAuth 토큰 설정"
echo "3. 🧠 AI 모델 다운로드 및 설정"
echo "4. 🚀 개발 서버 시작: npm run dev 또는 make dev"
echo ""
echo "🔧 유용한 명령어:"
echo "  - make dev          # 개발 서버 시작"
echo "  - make docker-up    # Docker 컨테이너 시작"
echo "  - make docker-down  # Docker 컨테이너 종료"
echo "  - make db-migrate   # 데이터베이스 마이그레이션"
echo "  - make help         # 모든 명령어 확인"
echo ""
echo "📚 문서: https://github.com/your-org/ddalkkak/wiki"
echo "🐛 이슈 리포트: https://github.com/your-org/ddalkkak/issues"
echo ""
print_success "Happy coding! 🚀"