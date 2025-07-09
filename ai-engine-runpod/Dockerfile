# TtalKkak AI Engine - Runpod Serverless
FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04

# 작업 디렉토리 설정
WORKDIR /app

# 시스템 패키지 설치
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Python 의존성 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 애플리케이션 코드 복사
COPY handler.py .

# 환경 변수 설정
ENV PYTHONPATH=/app
ENV TRANSFORMERS_CACHE=/tmp/transformers_cache
ENV HF_HOME=/tmp/huggingface_cache

# 캐시 디렉토리 생성
RUN mkdir -p /tmp/transformers_cache /tmp/huggingface_cache

# 실행 명령
CMD ["python", "handler.py"]