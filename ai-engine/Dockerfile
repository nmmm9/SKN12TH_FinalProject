# Python AI 엔진 Dockerfile
FROM nvidia/cuda:11.8-devel-ubuntu22.04 AS base

# 환경 변수 설정
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PIP_NO_CACHE_DIR=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1

# 시스템 업데이트 및 필수 패키지 설치
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3.11-dev \
    python3-pip \
    python3.11-venv \
    git \
    wget \
    curl \
    build-essential \
    cmake \
    pkg-config \
    libsndfile1 \
    ffmpeg \
    portaudio19-dev \
    libportaudio2 \
    libasound-dev \
    && rm -rf /var/lib/apt/lists/*

# Python 심볼릭 링크 생성
RUN ln -s /usr/bin/python3.11 /usr/bin/python

# 작업 디렉토리 설정
WORKDIR /app

# Python 요구사항 파일 복사 및 설치
COPY requirements.txt .

# Python 패키지 설치
RUN pip install --no-cache-dir --upgrade pip setuptools wheel
RUN pip install --no-cache-dir -r requirements.txt

# PyTorch CUDA 지원 설치
RUN pip install --no-cache-dir torch torchaudio --index-url https://download.pytorch.org/whl/cu118

# 애플리케이션 코드 복사
COPY . .

# 비특권 사용자 생성
RUN useradd --create-home --shell /bin/bash ddalkkak
USER ddalkkak

# 모델 디렉토리 생성
RUN mkdir -p /app/models

# 포트 노출
EXPOSE 8001

# 헬스체크
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# 애플리케이션 실행
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]