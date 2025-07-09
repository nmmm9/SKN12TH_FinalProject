#!/bin/bash

# TtalKkak AI Engine - Runpod 배포 스크립트

echo "🚀 TtalKkak AI Engine Runpod 배포 시작..."

# 배포 설정
IMAGE_NAME="ttalkkak-ai-engine"
REGISTRY="your-docker-registry"  # Docker Hub 또는 다른 레지스트리
TAG="latest"

echo "📦 Docker 이미지 빌드 중..."
docker build -t $IMAGE_NAME:$TAG .

if [ $? -eq 0 ]; then
    echo "✅ Docker 이미지 빌드 완료"
else
    echo "❌ Docker 이미지 빌드 실패"
    exit 1
fi

echo "📤 Docker 이미지 푸시 중..."
# docker tag $IMAGE_NAME:$TAG $REGISTRY/$IMAGE_NAME:$TAG
# docker push $REGISTRY/$IMAGE_NAME:$TAG

echo "🔧 Runpod 설정 안내:"
echo "1. Runpod 콘솔에 로그인"
echo "2. Serverless 섹션에서 새 엔드포인트 생성"
echo "3. Docker 이미지: $REGISTRY/$IMAGE_NAME:$TAG"
echo "4. GPU: RTX 4090 또는 A100 권장"
echo "5. 메모리: 최소 16GB"
echo "6. 환경 변수 설정 (필요시)"

echo ""
echo "📋 테스트 페이로드 예시:"
echo '{
  "input": {
    "action": "health"
  }
}'

echo ""
echo "🎉 배포 준비 완료!"
echo "Runpod 콘솔에서 엔드포인트를 설정하고 API 키를 확인하세요."