@echo off
setlocal enabledelayedexpansion

REM DdalKkak 프로젝트 초기 설정 스크립트 (Windows)

echo.
echo ========================================
echo  🚀 DdalKkak 프로젝트 초기 설정
echo ========================================
echo.

REM 1. 필수 도구 확인
echo [1/5] 필수 도구 확인 중...
echo.

REM Node.js 확인
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js가 설치되어 있지 않습니다.
    echo    Node.js 18 이상을 설치해주세요: https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✅ Node.js 버전: %NODE_VERSION%

REM Python 확인
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python이 설치되어 있지 않습니다.
    echo    Python 3.11 이상을 설치해주세요: https://python.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('python --version') do set PYTHON_VERSION=%%i
echo ✅ Python 버전: %PYTHON_VERSION%

REM Docker 확인
where docker >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  Docker가 설치되어 있지 않습니다.
    echo    Docker Desktop을 설치하면 더 편리하게 개발할 수 있습니다.
) else (
    for /f "tokens=*" %%i in ('docker --version') do set DOCKER_VERSION=%%i
    echo ✅ Docker 버전: !DOCKER_VERSION!
)

echo.

REM 2. 환경 변수 파일 설정
echo [2/5] 환경 변수 파일 설정 중...

if not exist ".env" (
    copy ".env.example" ".env" >nul
    echo ✅ 환경 변수 파일 생성 완료 (.env)
    echo ⚠️  .env 파일을 편집하여 필요한 설정을 완료해주세요.
) else (
    echo ⚠️  환경 변수 파일이 이미 존재합니다.
)

echo.

REM 3. 의존성 설치
echo [3/5] 의존성 설치 중...
echo.

echo    📦 루트 프로젝트 의존성 설치...
call npm install
if %errorlevel% neq 0 (
    echo ❌ 루트 의존성 설치 실패
    pause
    exit /b 1
)
echo ✅ 루트 의존성 설치 완료

echo    📦 백엔드 의존성 설치...
cd backend
call npm install
if %errorlevel% neq 0 (
    echo ❌ 백엔드 의존성 설치 실패
    cd ..
    pause
    exit /b 1
)
cd ..
echo ✅ 백엔드 의존성 설치 완료

echo    📦 AI 엔진 의존성 설치...
cd ai-engine
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ❌ AI 엔진 의존성 설치 실패
    cd ..
    pause
    exit /b 1
)
cd ..
echo ✅ AI 엔진 의존성 설치 완료

echo    📦 프론트엔드 의존성 설치...
if exist "frontend\slack-app" (
    cd frontend\slack-app
    call npm install
    cd ..\..
    echo ✅ Slack App 의존성 설치 완료
)

if exist "frontend\web-dashboard" (
    cd frontend\web-dashboard
    call npm install
    cd ..\..
    echo ✅ Web Dashboard 의존성 설치 완료
)

if exist "frontend\chrome-extension" (
    cd frontend\chrome-extension
    call npm install
    cd ..\..
    echo ✅ Chrome Extension 의존성 설치 완료
)

echo.

REM 4. Docker 환경 설정 (선택사항)
where docker >nul 2>&1
if %errorlevel% equ 0 (
    echo [4/5] Docker 환경 설정
    echo.
    
    set /p DOCKER_START="Docker 컨테이너를 시작하시겠습니까? (y/n): "
    if /i "!DOCKER_START!"=="y" (
        echo    🐳 Docker 이미지 빌드 중...
        docker-compose build
        
        echo    🚀 Docker 컨테이너 시작 중...
        docker-compose up -d
        
        echo    ⏳ 서비스 시작 대기 중...
        timeout /t 15 /nobreak >nul
        
        echo ✅ Docker 환경 설정 완료
        
        echo    🗄️ 데이터베이스 마이그레이션 실행 중...
        cd backend
        call npm run db:migrate
        cd ..
        echo ✅ 데이터베이스 마이그레이션 완료
    ) else (
        echo ⚠️  Docker 환경 설정을 건너뛰었습니다.
    )
) else (
    echo [4/5] Docker가 설치되어 있지 않아 건너뛰었습니다.
)

echo.

REM 5. 개발 환경 확인
echo [5/5] 개발 환경 확인
echo.

echo 🌐 서비스 포트 확인:
echo    - 백엔드 API: http://localhost:3000
echo    - AI 엔진: http://localhost:8001
echo    - Web Dashboard: http://localhost:3001
echo    - PostgreSQL: localhost:5432
echo    - Redis: localhost:6379
echo    - MinIO: http://localhost:9000

echo.

REM 6. 설정 완료
echo ========================================
echo  🎉 DdalKkak 프로젝트 초기 설정 완료!
echo ========================================
echo.
echo 📋 다음 단계:
echo    1. 📝 .env 파일을 편집하여 필요한 API 키와 설정을 완료하세요
echo    2. 🔑 Slack App 설정 및 OAuth 토큰 설정
echo    3. 🧠 AI 모델 다운로드 및 설정
echo    4. 🚀 개발 서버 시작: npm run dev
echo.
echo 🔧 유용한 명령어:
echo    - npm run dev           # 개발 서버 시작
echo    - docker-compose up -d  # Docker 컨테이너 시작
echo    - docker-compose down   # Docker 컨테이너 종료
echo.
echo 📚 문서: https://github.com/your-org/ddalkkak/wiki
echo 🐛 이슈 리포트: https://github.com/your-org/ddalkkak/issues
echo.
echo ✨ Happy coding! 🚀
echo.

pause