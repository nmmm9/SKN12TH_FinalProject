"""
RunPod GPU 환경 설정 스크립트
WhisperX + FastAPI 서버 자동 설정
"""

import os
import subprocess
import sys
import time
import requests
from pathlib import Path

def run_command(command, description=""):
    """명령어 실행"""
    print(f"🔧 {description if description else command}")
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        if result.stdout:
            print(f"✅ {result.stdout.strip()}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ 실패: {e}")
        if e.stderr:
            print(f"오류: {e.stderr.strip()}")
        return False

def check_gpu():
    """GPU 확인"""
    print("🔍 GPU 환경 확인...")
    
    # NVIDIA GPU 확인
    if run_command("nvidia-smi", "NVIDIA GPU 확인"):
        print("✅ NVIDIA GPU 감지됨")
    else:
        print("⚠️ NVIDIA GPU를 찾을 수 없습니다.")
        return False
    
    # CUDA 확인
    if run_command("nvcc --version", "CUDA 버전 확인"):
        print("✅ CUDA 설치 확인됨")
    else:
        print("⚠️ CUDA를 찾을 수 없습니다.")
    
    return True

def install_system_dependencies():
    """시스템 의존성 설치"""
    print("📦 시스템 의존성 설치...")
    
    # 시스템 업데이트
    run_command("apt-get update", "패키지 목록 업데이트")
    
    # 오디오 처리 라이브러리
    dependencies = [
        "ffmpeg",
        "libsndfile1",
        "portaudio19-dev",
        "python3-pyaudio",
        "build-essential",
        "git"
    ]
    
    for dep in dependencies:
        run_command(f"apt-get install -y {dep}", f"{dep} 설치")

def install_python_dependencies():
    """Python 의존성 설치"""
    print("🐍 Python 의존성 설치...")
    
    # pip 업그레이드
    run_command("pip install --upgrade pip", "pip 업그레이드")
    
    # PyTorch 설치 (CUDA 지원)
    torch_command = "pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118"
    run_command(torch_command, "PyTorch (CUDA) 설치")
    
    # WhisperX 설치
    run_command("pip install whisperx", "WhisperX 설치")
    
    # requirements.txt가 있으면 설치
    if os.path.exists("requirements.txt"):
        run_command("pip install -r requirements.txt", "requirements.txt 의존성 설치")
    else:
        # 기본 의존성들 설치
        basic_deps = [
            "fastapi[all]",
            "uvicorn[standard]",
            "python-multipart",
            "aiofiles",
            "librosa",
            "soundfile",
            "numpy",
            "scipy",
            "python-dotenv",
            "httpx",
            "websockets",
            "transformers",
            "accelerate"
        ]
        
        for dep in basic_deps:
            run_command(f"pip install {dep}", f"{dep} 설치")

def download_models():
    """AI 모델 다운로드"""
    print("🤖 AI 모델 다운로드...")
    
    # WhisperX 모델 사전 다운로드
    try:
        import whisperx
        
        # Large-v3 모델 다운로드
        print("📥 Whisper Large-v3 모델 다운로드 중...")
        model = whisperx.load_model("large-v3", device="cuda", compute_type="float16")
        print("✅ Whisper 모델 다운로드 완료")
        del model  # 메모리 해제
        
        # 한국어 alignment 모델 시도
        try:
            align_model, metadata = whisperx.load_align_model(language_code="ko", device="cuda")
            print("✅ 한국어 alignment 모델 다운로드 완료")
            del align_model
        except Exception as e:
            print(f"⚠️ 한국어 alignment 모델 다운로드 실패: {e}")
        
        # Diarization 모델 (HuggingFace 토큰 필요)
        hf_token = os.getenv("HF_TOKEN")
        if hf_token:
            try:
                diarize_model = whisperx.DiarizationPipeline(use_auth_token=hf_token, device="cuda")
                print("✅ 화자 분리 모델 다운로드 완료")
                del diarize_model
            except Exception as e:
                print(f"⚠️ 화자 분리 모델 다운로드 실패: {e}")
        else:
            print("⚠️ HF_TOKEN이 설정되지 않아 화자 분리 모델을 건너뜁니다.")
            
    except Exception as e:
        print(f"❌ 모델 다운로드 실패: {e}")

def create_env_file():
    """환경 변수 파일 생성"""
    print("⚙️ 환경 변수 파일 생성...")
    
    env_content = """# DdalKkak AI Engine 환경 변수
# HuggingFace 토큰 (화자 분리용)
HF_TOKEN=your_huggingface_token_here

# GPU 설정
CUDA_VISIBLE_DEVICES=0

# 로그 레벨
LOG_LEVEL=INFO

# 서버 설정
HOST=0.0.0.0
PORT=8001

# 개발 모드
DEBUG=True
"""
    
    with open(".env", "w") as f:
        f.write(env_content)
    
    print("✅ .env 파일 생성 완료")
    print("⚠️ HF_TOKEN을 실제 토큰으로 교체하세요!")

def setup_service():
    """서비스 설정"""
    print("🚀 서비스 설정...")
    
    # 포트 확인
    try:
        response = requests.get("http://localhost:8001/health", timeout=5)
        print("⚠️ 서버가 이미 실행 중입니다.")
    except requests.exceptions.RequestException:
        print("✅ 포트 8001이 사용 가능합니다.")
    
    # 방화벽 설정 (필요한 경우)
    run_command("ufw allow 8001", "방화벽 포트 8001 열기")

def test_installation():
    """설치 테스트"""
    print("🧪 설치 테스트...")
    
    # Python 모듈 가져오기 테스트
    test_imports = [
        "torch",
        "whisperx", 
        "fastapi",
        "uvicorn",
        "librosa",
        "soundfile",
        "numpy"
    ]
    
    failed_imports = []
    
    for module in test_imports:
        try:
            __import__(module)
            print(f"✅ {module}: OK")
        except ImportError as e:
            print(f"❌ {module}: 실패 - {e}")
            failed_imports.append(module)
    
    if failed_imports:
        print(f"⚠️ 실패한 모듈들: {', '.join(failed_imports)}")
        return False
    
    # GPU 테스트
    try:
        import torch
        if torch.cuda.is_available():
            print(f"✅ CUDA 사용 가능: {torch.cuda.get_device_name(0)}")
            print(f"✅ GPU 메모리: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f}GB")
        else:
            print("⚠️ CUDA를 사용할 수 없습니다.")
            return False
    except Exception as e:
        print(f"❌ GPU 테스트 실패: {e}")
        return False
    
    return True

def start_server():
    """서버 시작"""
    print("🚀 AI Engine 서버 시작...")
    
    if not os.path.exists("main.py"):
        print("❌ main.py 파일을 찾을 수 없습니다.")
        return False
    
    print("서버를 시작하려면 다음 명령어를 실행하세요:")
    print("python main.py")
    print()
    print("또는 백그라운드에서 실행:")
    print("nohup python main.py > server.log 2>&1 &")
    
    return True

def main():
    """메인 설정 함수"""
    print("🚀 DdalKkak AI Engine RunPod 설정 시작")
    print("=" * 60)
    
    steps = [
        ("GPU 환경 확인", check_gpu),
        ("시스템 의존성 설치", install_system_dependencies),
        ("Python 의존성 설치", install_python_dependencies),
        ("AI 모델 다운로드", download_models),
        ("환경 변수 파일 생성", create_env_file),
        ("서비스 설정", setup_service),
        ("설치 테스트", test_installation),
        ("서버 시작 안내", start_server)
    ]
    
    failed_steps = []
    
    for step_name, step_func in steps:
        print(f"\n{'='*20} {step_name} {'='*20}")
        try:
            success = step_func()
            if success:
                print(f"✅ {step_name}: 완료")
            else:
                print(f"❌ {step_name}: 실패")
                failed_steps.append(step_name)
        except Exception as e:
            print(f"❌ {step_name}: 예외 발생 - {str(e)}")
            failed_steps.append(step_name)
    
    # 결과 요약
    print("\n" + "="*60)
    print("📊 설정 결과")
    print("="*60)
    
    if failed_steps:
        print("❌ 실패한 단계들:")
        for step in failed_steps:
            print(f"  - {step}")
        print("\n⚠️ 일부 설정이 실패했습니다. 로그를 확인하고 수동으로 해결하세요.")
    else:
        print("🎉 모든 설정이 완료되었습니다!")
        print("\n📝 다음 단계:")
        print("1. .env 파일에서 HF_TOKEN 설정")
        print("2. python main.py로 서버 시작")
        print("3. python test_stt.py로 테스트 실행")

if __name__ == "__main__":
    if os.geteuid() != 0:
        print("⚠️ 이 스크립트는 root 권한이 필요합니다.")
        print("sudo python runpod_setup.py 로 실행하세요.")
        sys.exit(1)
    
    main()