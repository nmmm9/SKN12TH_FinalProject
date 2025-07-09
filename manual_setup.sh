#\!/bin/bash

# DdalKkak AI Engine 수동 설정 스크립트 (Python 3.12 호환)
# RunPod GPU 환경에서 실행

set -e  # 오류 발생시 스크립트 중단

echo "🚀 DdalKkak AI Engine 수동 설정 시작"
echo "Python 3.12 호환성 문제 해결"
echo "============================================================"

# 1. 시스템 의존성 설치
echo "📦 시스템 의존성 설치..."
apt-get update
apt-get install -y ffmpeg libsndfile1 portaudio19-dev python3-pyaudio build-essential git curl

# 2. pip 업그레이드
echo "🔧 pip 업그레이드..."
pip install --upgrade pip setuptools wheel

# 3. Python 3.12 호환 cryptography 먼저 설치
echo "🔐 cryptography 라이브러리 설치..."
pip install "cryptography>=42.0.0"

# 4. PyTorch 설치 (CUDA 지원)
echo "🔥 PyTorch CUDA 설치..."
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118

# 5. 핵심 의존성 설치
echo "🎯 핵심 의존성 설치..."
pip install fastapi[all] uvicorn[standard] python-multipart aiofiles

# 6. WhisperX 설치
echo "🎤 WhisperX 설치..."
pip install whisperx

# 7. 오디오 처리 라이브러리
echo "🎵 오디오 처리 라이브러리 설치..."
pip install librosa soundfile numpy scipy

# 8. 기타 필수 라이브러리
echo "📚 기타 필수 라이브러리 설치..."
pip install python-dotenv httpx websockets transformers accelerate

# 9. 화자 분리용 pyannote
echo "👥 화자 분리 라이브러리 설치..."
pip install pyannote.audio

# 10. GPU 확인
echo "🔍 GPU 확인..."
python -c "import torch; print(f'CUDA 사용 가능: {torch.cuda.is_available()}'); print(f'GPU 개수: {torch.cuda.device_count()}') if torch.cuda.is_available() else None"

# 11. .env 파일 생성
echo "⚙️ 환경 변수 파일 생성..."
if [ \! -f ".env" ]; then
    cp .env.example .env
    echo "✅ .env 파일이 생성되었습니다."
    echo "⚠️ HF_TOKEN을 설정해야 합니다\!"
fi

# 12. 설치 확인
echo "🧪 설치 확인..."
python -c "
import torch
import whisperx
import fastapi
import uvicorn
import librosa
import soundfile
print('✅ 모든 핵심 모듈이 성공적으로 설치되었습니다\!')
print(f'PyTorch: {torch.__version__}')
print(f'CUDA 사용 가능: {torch.cuda.is_available()}')
if torch.cuda.is_available():
    print(f'GPU: {torch.cuda.get_device_name(0)}')
"

echo ""
echo "🎉 수동 설정 완료\!"
echo ""
echo "📝 다음 단계:"
echo "1. .env 파일에서 HF_TOKEN 설정"
echo "2. python main.py로 서버 시작"
echo "3. python test_stt.py로 테스트 실행"
echo ""
echo "💡 서버 시작 명령어:"
echo "   포그라운드: python main.py"
echo "   백그라운드: nohup python main.py > server.log 2>&1 &"
EOF < /dev/null
