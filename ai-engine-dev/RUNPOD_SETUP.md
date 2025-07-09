# 🚀 Runpod 개발 환경 설정 가이드

TtalKkak AI 엔진을 Runpod에서 실행하는 방법

## 📋 준비사항

- Runpod 계정 및 결제 설정 완료
- RTX 4090 또는 A100 GPU 권장 (최소 16GB VRAM)

## 🎯 1단계: Runpod Pod 생성

### Pod 설정
1. [Runpod 콘솔](https://runpod.io/console) 접속
2. **Pods** → **+ Deploy** 클릭
3. 다음 설정 선택:

```yaml
Template: PyTorch 2.1.0 (권장)
GPU: RTX 4090 (24GB) 또는 A100 (40GB)
Container Disk: 50GB 이상
Volume Disk: 30GB 이상 (모델 저장용)
Expose Ports: 8000 (HTTP), 22 (SSH)
```

### 환경 변수 설정 (선택사항)
```
PRELOAD_MODELS=true
HOST=0.0.0.0
PORT=8000
```

## 🔧 2단계: SSH 연결 및 환경 설정

### SSH 접속
```bash
# Runpod에서 제공하는 SSH 명령어 사용
ssh root@your-pod-ip -p your-ssh-port
```

### 프로젝트 업로드
```bash
# 방법 1: Git 클론 (추천)
git clone https://github.com/yourusername/ttalkkak.git
cd ttalkkak/ai-engine-dev

# 방법 2: 파일 직접 업로드
# 로컬에서: scp -P your-ssh-port ai-engine-dev/* root@your-pod-ip:/workspace/
```

### Python 환경 설정
```bash
# 의존성 설치
pip install -r requirements.txt

# GPU 확인
python -c "import torch; print(f'CUDA available: {torch.cuda.is_available()}')"
python -c "import torch; print(f'GPU count: {torch.cuda.device_count()}')"
```

## 🚀 3단계: AI 서버 실행

### 개발 모드 실행
```bash
# 백그라운드 실행
nohup python ai_server.py > ai_server.log 2>&1 &

# 로그 확인
tail -f ai_server.log

# 프로세스 확인
ps aux | grep ai_server
```

### 서버 상태 확인
```bash
# 헬스 체크
curl http://localhost:8000/health

# API 문서 확인
curl http://localhost:8000/docs
```

## 🔗 4단계: 로컬 백엔드 연결

### 환경 변수 업데이트
```bash
# backend/.env 파일 수정
RUNPOD_AI_URL=http://your-runpod-public-ip:8000
```

### 연결 테스트
```bash
# 로컬에서 실행
cd backend
npm run dev

# 브라우저에서 확인
http://localhost:3500/ai/health
```

## 📡 5단계: API 테스트

### 음성 전사 테스트
```bash
curl -X POST "http://your-runpod-ip:8000/transcribe" \
  -F "audio=@test-audio.wav"
```

### 회의 분석 테스트
```bash
curl -X POST "http://your-runpod-ip:8000/analyze" \
  -H "Content-Type: application/json" \
  -d '{"transcript": "오늘 회의에서는 프로젝트 진행상황을 논의했습니다..."}'
```

### 전체 파이프라인 테스트
```bash
curl -X POST "http://your-runpod-ip:8000/pipeline" \
  -F "audio=@test-audio.wav"
```

## 💰 비용 최적화

### 자동 종료 설정
```bash
# 1시간 후 자동 종료 (미사용 시)
sudo shutdown -h +60

# 또는 cron으로 스케줄링
echo "0 2 * * * /sbin/shutdown -h now" | crontab -
```

### 모델 캐싱
```bash
# Volume 마운트하여 모델 재다운로드 방지
# Pod 설정에서 Volume 연결 필요
```

## 🔍 문제 해결

### GPU 메모리 부족
```bash
# GPU 메모리 확인
nvidia-smi

# 메모리 정리
python -c "import torch; torch.cuda.empty_cache()"
```

### 모델 로딩 실패
```bash
# 캐시 디렉토리 확인
ls -la ~/.cache/huggingface/
ls -la ~/.cache/whisperx/

# 캐시 삭제 후 재시도
rm -rf ~/.cache/huggingface/transformers/
rm -rf ~/.cache/whisperx/
```

### 네트워크 연결 문제
```bash
# 방화벽 확인
ufw status

# 포트 열기
ufw allow 8000/tcp
```

## 📝 개발 워크플로우

### 일반적인 개발 사이클
1. **로컬**: 백엔드 코드 수정
2. **Runpod**: AI 서버 실행 유지
3. **테스트**: 로컬 → Runpod API 호출
4. **AI 수정 필요 시**: SSH로 Runpod 접속하여 수정

### 코드 동기화
```bash
# Runpod에서 최신 코드 받기
git pull origin main

# 서버 재시작
pkill -f ai_server.py
nohup python ai_server.py > ai_server.log 2>&1 &
```

## ⚡ 성능 최적화

### GPU 설정
```python
# ai_server.py에서 설정
torch.backends.cudnn.benchmark = True
torch.backends.cuda.matmul.allow_tf32 = True
```

### 배치 처리
```python
# 여러 요청을 배치로 처리
BATCH_SIZE = 4  # GPU 메모리에 따라 조절
```

## 🎉 완료 체크리스트

- [ ] Runpod Pod 생성 및 SSH 접속
- [ ] AI 서버 코드 업로드 및 의존성 설치
- [ ] GPU 정상 작동 확인
- [ ] AI 서버 실행 및 헬스 체크
- [ ] 로컬 백엔드 연결 설정
- [ ] API 테스트 완료
- [ ] 비용 최적화 설정

성공하면 이제 로컬에서 개발하면서 강력한 GPU로 AI 처리를 할 수 있습니다! 🚀