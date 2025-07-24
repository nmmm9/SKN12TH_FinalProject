#!/bin/bash

# DdalKkak AI Engine 서버 시작 스크립트

set -e  # 오류 발생시 스크립트 중단

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로그 함수
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 함수: 프로세스 확인
check_process() {
    if pgrep -f "python.*main.py" > /dev/null; then
        return 0  # 프로세스 존재
    else
        return 1  # 프로세스 없음
    fi
}

# 함수: 서버 헬스 체크
health_check() {
    local max_retries=30
    local retry=0
    
    log_info "서버 헬스 체크 중..."
    
    while [ $retry -lt $max_retries ]; do
        if curl -s http://localhost:8001/health > /dev/null 2>&1; then
            log_success "서버가 정상적으로 시작되었습니다!"
            return 0
        fi
        
        retry=$((retry + 1))
        echo -n "."
        sleep 2
    done
    
    log_error "서버 시작 확인 실패 (타임아웃)"
    return 1
}

# 함수: GPU 확인
check_gpu() {
    log_info "GPU 환경 확인..."
    
    if command -v nvidia-smi &> /dev/null; then
        local gpu_count=$(nvidia-smi --query-gpu=count --format=csv,noheader,nounits | head -1)
        log_success "GPU 감지됨: $gpu_count개"
        
        # GPU 메모리 확인
        nvidia-smi --query-gpu=memory.total,memory.used,memory.free --format=csv,noheader,nounits | while IFS=', ' read -r total used free; do
            log_info "GPU 메모리: ${free}MB 사용 가능 (전체: ${total}MB)"
        done
        
        return 0
    else
        log_warning "NVIDIA GPU를 찾을 수 없습니다"
        return 1
    fi
}

# 함수: 환경 변수 확인
check_env() {
    log_info "환경 변수 확인..."
    
    if [ ! -f ".env" ]; then
        log_warning ".env 파일이 없습니다. .env.example을 복사합니다."
        if [ -f ".env.example" ]; then
            cp .env.example .env
            log_info ".env 파일이 생성되었습니다. 필요한 값들을 설정하세요."
        else
            log_error ".env.example 파일도 없습니다."
            return 1
        fi
    fi
    
    # 필수 환경 변수 확인
    source .env
    
    if [ -z "$HF_TOKEN" ] || [ "$HF_TOKEN" = "your_huggingface_token_here" ]; then
        log_warning "HF_TOKEN이 설정되지 않았습니다. 화자 분리 기능이 제한될 수 있습니다."
    fi
    
    return 0
}

# 함수: 의존성 확인
check_dependencies() {
    log_info "Python 의존성 확인..."
    
    local required_modules=("torch" "whisperx" "fastapi" "uvicorn")
    local missing_modules=()
    
    for module in "${required_modules[@]}"; do
        if ! python -c "import $module" 2>/dev/null; then
            missing_modules+=("$module")
        fi
    done
    
    if [ ${#missing_modules[@]} -gt 0 ]; then
        log_error "누락된 모듈들: ${missing_modules[*]}"
        log_info "다음 명령어로 설치하세요: pip install ${missing_modules[*]}"
        return 1
    fi
    
    log_success "모든 필수 모듈이 설치되어 있습니다"
    return 0
}

# 함수: 포트 확인
check_port() {
    local port=${PORT:-8001}
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        log_warning "포트 $port가 이미 사용 중입니다"
        
        local pid=$(lsof -Pi :$port -sTCP:LISTEN -t)
        local process=$(ps -p $pid -o comm= 2>/dev/null || echo "알 수 없음")
        
        log_info "사용 중인 프로세스: $process (PID: $pid)"
        
        read -p "기존 프로세스를 종료하고 계속하시겠습니까? (y/N): " -n 1 -r
        echo
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            log_info "기존 프로세스를 종료합니다..."
            kill $pid
            sleep 2
        else
            log_error "서버 시작을 취소합니다"
            return 1
        fi
    fi
    
    return 0
}

# 함수: 서버 시작
start_server() {
    local mode=$1
    
    log_info "AI Engine 서버 시작 중..."
    
    case $mode in
        "foreground"|"fg")
            log_info "포그라운드 모드로 실행합니다"
            python main.py
            ;;
        "background"|"bg")
            log_info "백그라운드 모드로 실행합니다"
            nohup python main.py > server.log 2>&1 &
            local pid=$!
            echo $pid > server.pid
            log_success "서버가 백그라운드에서 시작되었습니다 (PID: $pid)"
            
            # 헬스 체크
            if health_check; then
                log_success "서버 시작 완료!"
                log_info "로그 확인: tail -f server.log"
                log_info "서버 중지: $0 stop"
            else
                log_error "서버 시작에 실패했습니다. 로그를 확인하세요: tail server.log"
                return 1
            fi
            ;;
        "dev")
            log_info "개발 모드로 실행합니다 (자동 재시작)"
            python -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload --log-level info
            ;;
        *)
            log_error "알 수 없는 모드: $mode"
            return 1
            ;;
    esac
}

# 함수: 서버 중지
stop_server() {
    log_info "서버 중지 중..."
    
    if [ -f "server.pid" ]; then
        local pid=$(cat server.pid)
        if kill $pid 2>/dev/null; then
            log_success "서버가 중지되었습니다 (PID: $pid)"
            rm -f server.pid
        else
            log_warning "PID $pid 프로세스를 찾을 수 없습니다"
        fi
    fi
    
    # 모든 관련 프로세스 종료
    if check_process; then
        pkill -f "python.*main.py"
        log_info "관련 프로세스들을 종료했습니다"
    fi
    
    log_success "서버 중지 완료"
}

# 함수: 서버 상태 확인
status_server() {
    log_info "서버 상태 확인..."
    
    if check_process; then
        local pid=$(pgrep -f "python.*main.py")
        log_success "서버가 실행 중입니다 (PID: $pid)"
        
        # 헬스 체크
        if curl -s http://localhost:8001/health > /dev/null 2>&1; then
            log_success "서버가 정상 응답하고 있습니다"
            
            # 상태 정보 출력
            curl -s http://localhost:8001/stt/status | python -m json.tool 2>/dev/null || echo "상태 정보를 가져올 수 없습니다"
        else
            log_warning "서버가 응답하지 않습니다"
        fi
    else
        log_info "서버가 실행되지 않고 있습니다"
    fi
}

# 함수: 로그 출력
show_logs() {
    if [ -f "server.log" ]; then
        log_info "서버 로그 (마지막 50줄):"
        tail -50 server.log
    else
        log_warning "server.log 파일을 찾을 수 없습니다"
    fi
}

# 함수: 사용법 출력
show_usage() {
    echo "사용법: $0 {start|stop|restart|status|logs|test} [옵션]"
    echo ""
    echo "명령어:"
    echo "  start [mode]    서버 시작"
    echo "    - fg/foreground: 포그라운드 실행 (기본값)"
    echo "    - bg/background: 백그라운드 실행"
    echo "    - dev: 개발 모드 (자동 재시작)"
    echo "  stop            서버 중지"
    echo "  restart [mode]  서버 재시작"
    echo "  status          서버 상태 확인"
    echo "  logs            서버 로그 출력"
    echo "  test            설치 테스트"
    echo ""
    echo "예시:"
    echo "  $0 start bg     # 백그라운드로 시작"
    echo "  $0 start dev    # 개발 모드로 시작"
    echo "  $0 restart fg   # 포그라운드로 재시작"
}

# 메인 로직
main() {
    local command=$1
    local mode=${2:-"fg"}
    
    # 기본 디렉토리 확인
    if [ ! -f "main.py" ]; then
        log_error "main.py 파일을 찾을 수 없습니다. ai-engine 디렉토리에서 실행하세요."
        exit 1
    fi
    
    case $command in
        "start")
            check_gpu
            check_env
            check_dependencies || exit 1
            check_port || exit 1
            start_server $mode
            ;;
        "stop")
            stop_server
            ;;
        "restart")
            stop_server
            sleep 2
            check_gpu
            check_env
            check_dependencies || exit 1
            check_port || exit 1
            start_server $mode
            ;;
        "status")
            status_server
            ;;
        "logs")
            show_logs
            ;;
        "test")
            log_info "설치 테스트 실행..."
            python test_stt.py
            ;;
        "")
            show_usage
            ;;
        *)
            log_error "알 수 없는 명령어: $command"
            show_usage
            exit 1
            ;;
    esac
}

# 스크립트 실행
main "$@"