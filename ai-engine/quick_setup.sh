#!/bin/bash

echo "🚀 DdalKkak AI Engine 빠른 설치 시작"

# 시스템 업데이트
apt-get update
apt-get install -y ffmpeg libsndfile1 portaudio19-dev python3-pyaudio build-essential git curl

# pip 업그레이드
pip install --upgrade pip setuptools wheel

# cryptography 설치
pip install "cryptography>=42.0.0"

# PyTorch 호환 버전 설치
pip uninstall torch torchvision torchaudio -y
pip install torch==2.5.1 torchvision==0.20.1 torchaudio==2.5.1 --index-url https://download.pytorch.org/whl/cu118

# FastAPI 설치
pip install fastapi[all] uvicorn[standard] python-multipart aiofiles

# WhisperX 및 오디오 라이브러리
pip install whisperx librosa soundfile scipy transformers accelerate pyannote.audio

# 기타 필수 라이브러리
pip install python-dotenv httpx websockets

# .env 파일 생성
echo "HF_TOKEN=\${HF_TOKEN:-your_huggingface_token_here}" > .env
echo "CUDA_VISIBLE_DEVICES=0" >> .env
echo "HOST=0.0.0.0" >> .env
echo "PORT=8001" >> .env
echo "DEBUG=True" >> .env
echo "LOG_LEVEL=INFO" >> .env

echo "✅ 설치 완료! python main.py로 서버 시작하세요."