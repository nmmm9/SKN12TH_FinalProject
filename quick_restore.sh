#!/bin/bash

# DdalKkak 완전 복구 스크립트
# 새 RunPod 인스턴스에서 실행

echo "🚀 DdalKkak STT 시스템 완전 복구 시작"
echo "=" * 60

# 1. 시스템 업데이트 및 필수 패키지 설치
echo "🔧 시스템 패키지 업데이트..."
apt-get update
apt-get install -y ffmpeg libsndfile1 portaudio19-dev python3-pyaudio build-essential git curl psmisc

# 2. pip 업그레이드
echo "📈 pip 업그레이드..."
pip install --upgrade pip setuptools wheel

# 3. 디렉토리 생성
echo "📁 디렉토리 생성..."
mkdir -p ~/ddalkkak/ai-engine
cd ~/ddalkkak/ai-engine

# 4. .env 파일 생성
echo "⚙️ 환경변수 설정..."
echo "HF_TOKEN=\${HF_TOKEN:-your_huggingface_token_here}" > .env
echo "CUDA_VISIBLE_DEVICES=0" >> .env
echo "HOST=0.0.0.0" >> .env
echo "PORT=8888" >> .env
echo "DEBUG=True" >> .env
echo "LOG_LEVEL=INFO" >> .env

# 5. PyTorch 먼저 설치 (CUDA 지원)
echo "🔥 PyTorch CUDA 설치..."
pip install torch>=2.5.1 torchaudio>=2.5.1 --index-url https://download.pytorch.org/whl/cu118

# 6. 웹 프레임워크 설치
echo "🌐 FastAPI 설치..."
pip install fastapi uvicorn[standard] python-multipart aiofiles python-dotenv httpx websockets

# 7. WhisperX 및 AI 라이브러리 설치
echo "🎤 WhisperX 및 AI 라이브러리 설치..."
pip install whisperx librosa soundfile transformers accelerate pyannote.audio

# 8. 기타 필수 라이브러리
echo "📚 기타 라이브러리 설치..."
pip install numpy scipy cryptography

# 4. main.py 생성
echo "📝 main.py 생성 중..."
cat > main.py << 'EOF'
import uvicorn
import torch
from fastapi import FastAPI, UploadFile, File, HTTPException
import tempfile
import os

app = FastAPI(title="DdalKkak STT Server")

@app.get("/")
def root():
    return {"message": "DdalKkak STT Server", "status": "running"}

@app.get("/health")
def health():
    return {"status": "ok", "cuda": torch.cuda.is_available()}

@app.post("/stt/test")
async def test_whisperx():
    try:
        import whisperx
        return {"status": "success", "message": "WhisperX available"}
    except ImportError as e:
        return {"status": "error", "message": str(e)}

@app.post("/stt/upload")
async def stt_upload(file: UploadFile = File(...)):
    content = await file.read()
    return {"filename": file.filename, "size": len(content), "status": "success"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8888)
EOF

echo "✅ 복구 완료!"
echo "🎯 서버 시작: python main.py"
echo "🧪 테스트: curl http://localhost:8888/health"