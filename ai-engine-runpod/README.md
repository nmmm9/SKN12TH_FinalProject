# TtalKkak AI Engine - Runpod Serverless

WhisperX (STT) + Qwen3-14B 4bit (LLM) 통합 AI 엔진

## 🎯 기능

- **음성 전사**: WhisperX large-v3 모델로 한국어 최적화
- **회의 분석**: Qwen3-14B 4bit 양자화 모델로 업무 추출
- **통합 파이프라인**: 음성 → 전사 → 분석 원스톱 처리

## 📦 파일 구조

```
ai-engine-runpod/
├── handler.py          # 메인 Runpod 핸들러
├── requirements.txt    # Python 의존성
├── Dockerfile         # Docker 이미지 빌드
├── test_local.py      # 로컬 테스트
├── deploy.sh          # 배포 스크립트
└── README.md          # 이 파일
```

## 🚀 배포 방법

### 1. Docker 이미지 빌드
```bash
./deploy.sh
```

### 2. Runpod 설정
1. [Runpod 콘솔](https://runpod.io/console) 로그인
2. Serverless → New Endpoint
3. Docker 이미지 설정
4. GPU: RTX 4090 권장 (16GB+ VRAM)
5. Worker 설정: Min 0, Max 3

### 3. 환경 변수 (선택사항)
```
TRANSFORMERS_CACHE=/tmp/transformers_cache
HF_HOME=/tmp/huggingface_cache
```

## 📡 API 사용법

### 헬스 체크
```json
{
  "input": {
    "action": "health"
  }
}
```

### 음성 전사
```json
{
  "input": {
    "action": "transcribe",
    "audio_base64": "base64_encoded_audio_data"
  }
}
```

### 텍스트 분석
```json
{
  "input": {
    "action": "analyze",
    "transcript": "회의 전사 텍스트..."
  }
}
```

### 전체 파이프라인
```json
{
  "input": {
    "action": "pipeline",
    "audio_base64": "base64_encoded_audio_data"
  }
}
```

## 🔧 로컬 테스트

```bash
# 가상환경 생성 (선택사항)
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt

# 테스트 실행
python test_local.py
```

## 💰 예상 비용

- **RTX 4090**: ~$0.5/시간
- **A100 40GB**: ~$1.2/시간
- **Serverless**: 실제 사용 시간만 과금

## 🎯 성능

- **WhisperX**: 1분 오디오 → ~10초 처리
- **Qwen3-14B**: 500토큰 → ~15초 처리
- **Cold Start**: 첫 실행 시 ~30-60초

## 🔍 트러블슈팅

### GPU 메모리 부족
- RTX 3090 이상 사용
- batch_size 줄이기
- 모델 양자화 확인

### 모델 로딩 실패
- 인터넷 연결 확인
- HuggingFace 토큰 설정
- 캐시 디렉토리 권한 확인