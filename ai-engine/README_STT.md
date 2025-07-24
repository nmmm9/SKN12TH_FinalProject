# 🎤 DdalKkak WhisperX STT Engine

RunPod GPU 환경에서 실행되는 WhisperX 기반 음성-텍스트 변환 시스템

## ✨ 주요 기능

- **🎯 WhisperX Large-v3**: 최신 고성능 STT 모델
- **👥 화자 분리**: Pyannote 기반 다화자 구분
- **📁 파일 업로드**: 다양한 오디오 형식 지원
- **🔄 실시간 STT**: WebSocket 기반 실시간 처리
- **🌍 다국어 지원**: 한국어 최적화 + 다국어
- **🏢 멀티테넌트**: 테넌트별 격리 처리

## 🚀 빠른 시작 (RunPod)

### 1. 환경 설정

```bash
# RunPod GPU 인스턴스에서 실행
sudo python runpod_setup.py
```

### 2. 환경 변수 설정

```bash
# .env 파일 복사 및 편집
cp .env.example .env
nano .env

# HF_TOKEN 설정 (필수)
HF_TOKEN=your_huggingface_token_here
```

### 3. 서버 시작

```bash
# 포그라운드 실행
python main.py

# 백그라운드 실행
nohup python main.py > server.log 2>&1 &
```

### 4. 테스트 실행

```bash
# 전체 테스트 스위트
python test_stt.py

# 개별 API 테스트
curl http://localhost:8001/health
```

## 📡 API 엔드포인트

### 🏥 헬스 체크
```http
GET /health
```

### 📊 STT 상태 확인
```http
GET /stt/status
```

### 📁 파일 업로드 STT
```http
POST /stt/upload
Content-Type: multipart/form-data

file: audio_file.wav
meeting_id: meeting_123
tenant_id: tenant_abc
user_id: user_xyz
language: ko
```

### 🌐 URL 기반 STT
```http
POST /stt/process
Content-Type: application/json

{
  "audio_url": "/path/to/audio.wav",
  "meeting_id": "meeting_123",
  "tenant_id": "tenant_abc",
  "user_id": "user_xyz",
  "language": "ko"
}
```

### 🔌 실시간 STT (WebSocket)
```javascript
// WebSocket 연결
const ws = new WebSocket('ws://localhost:8001/stt/realtime');

// 세션 시작
ws.send(JSON.stringify({
  type: 'start_session',
  session_id: 'session_123',
  tenant_id: 'tenant_abc',
  meeting_id: 'meeting_456',
  language: 'ko'
}));

// 오디오 청크 전송
ws.send(JSON.stringify({
  type: 'audio_chunk',
  audio_data: base64EncodedAudio
}));
```

## 📋 응답 형식

### STT 처리 결과
```json
{
  "meeting_id": "meeting_123",
  "tenant_id": "tenant_abc",
  "transcript": "전체 변환된 텍스트",
  "segments": [
    {
      "start": 0.0,
      "end": 3.5,
      "text": "안녕하세요",
      "speaker": "SPEAKER_00",
      "confidence": 0.95
    }
  ],
  "speakers": {
    "SPEAKER_00": {
      "total_duration": 10.5,
      "segments_count": 5,
      "text_parts": ["안녕하세요", "..."]
    }
  },
  "confidence": 0.92,
  "processing_time": 2.3,
  "language": "ko",
  "total_segments": 8,
  "total_speakers": 2,
  "has_diarization": true
}
```

## 🔧 설정

### GPU 요구사항
- **최소**: RTX 3070 (8GB VRAM)
- **권장**: RTX 4090 (24GB VRAM) 또는 A100 (40GB)
- **CUDA**: 11.8 이상

### 지원 오디오 형식
- WAV, MP3, M4A, FLAC, OGG, WebM, MP4
- 최대 파일 크기: 100MB
- 최대 길이: 1시간

### 지원 언어
- **최적화**: 한국어 (ko)
- **지원**: 영어 (en), 일본어 (ja), 중국어 (zh)
- **기타**: WhisperX 지원 언어 전체

## 🔍 모니터링

### 로그 확인
```bash
# 실시간 로그
tail -f server.log

# 에러 로그만
grep "ERROR" server.log
```

### GPU 사용량
```bash
# GPU 상태 확인
nvidia-smi

# 지속적 모니터링
watch -n 1 nvidia-smi
```

### 메모리 사용량
```bash
# 프로세스 메모리 확인
ps aux | grep python

# 시스템 메모리
free -h
```

## 🐛 문제 해결

### 일반적인 문제

#### 1. CUDA 메모리 부족
```bash
# GPU 메모리 정리
python -c "import torch; torch.cuda.empty_cache()"

# 배치 크기 줄이기
export WHISPER_BATCH_SIZE=8
```

#### 2. 모델 로딩 실패
```bash
# 모델 캐시 삭제
rm -rf ~/.cache/whisperx
rm -rf ~/.cache/huggingface

# 다시 다운로드
python -c "import whisperx; whisperx.load_model('large-v3')"
```

#### 3. 화자 분리 오류
```bash
# HF 토큰 확인
echo $HF_TOKEN

# pyannote 설치 확인
pip install pyannote.audio
```

### 성능 최적화

#### GPU 메모리 최적화
```python
# .env 파일에 추가
PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512
```

#### 배치 크기 조정
```python
# GPU 메모리에 따른 권장 설정
# RTX 3070 (8GB): batch_size=8
# RTX 4090 (24GB): batch_size=16
# A100 (40GB): batch_size=32
```

## 📊 성능 벤치마크

| GPU 모델 | VRAM | 배치 크기 | 처리 속도 | 권장 사용 |
|---------|------|-----------|-----------|-----------|
| RTX 3070 | 8GB | 8 | 1.5x | 개발/테스트 |
| RTX 4090 | 24GB | 16 | 3.0x | 프로덕션 |
| A100 | 40GB | 32 | 5.0x | 대용량 처리 |

*처리 속도는 실시간 대비 배수

## 🔒 보안 고려사항

- **API 키**: 프로덕션 환경에서 API 키 인증 구현 필요
- **파일 업로드**: 악성 파일 검증 로직 추가
- **Rate Limiting**: 요청 속도 제한 구현
- **로그 마스킹**: 민감한 정보 로그 출력 방지

## 📝 개발 노트

### 다음 구현 예정
- [ ] 실시간 STT 스트리밍 최적화
- [ ] 한국어 특화 후처리 로직
- [ ] 배치 처리 큐 시스템
- [ ] 자동 스케일링 연동
- [ ] 성능 메트릭 수집

### 알려진 제한사항
- 한국어 alignment 모델 부족 (타임스탬프 정확도 제한)
- 실시간 처리시 지연 시간 최적화 필요
- 매우 긴 오디오(1시간+) 처리시 메모리 사용량 증가

## 🤝 기여하기

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일 참조