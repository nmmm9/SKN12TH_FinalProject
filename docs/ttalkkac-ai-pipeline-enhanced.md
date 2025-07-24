# TtalKkac AI 처리 파이프라인 개선안 (BERT 필터링 적용)

## 🎯 **기존 vs 개선된 파이프라인**

### **기존 파이프라인:**
```
음성 입력 → WhisperX STT → Qwen3 LLM → 업무 생성
```

### **개선된 파이프라인 (BERT 필터링 추가):**
```
음성 입력 → WhisperX STT → Triplet 생성 → BERT 필터링 → Qwen3 LLM → 업무 생성
```

---

## 🔍 **단계별 상세 처리 과정**

### **1단계: WhisperX 음성-텍스트 변환**
```python
# 기존과 동일
whisper_result = whisperx.transcribe(audio_file, language="ko")
segments = whisper_result["segments"]
```

### **2단계: 발화 데이터 구조화** ✨ **NEW**
```python
# whisperX_parser.py 활용
structured_data = parse_whisperx_json(whisper_json_path)
# 결과: [{"timestamp", "speaker", "text", "timestamp_order"}]
```

### **3단계: Triplet 생성** ✨ **NEW**
```python
# create_triplets.py 활용
triplets = create_structured_triplets(structured_data)
# 결과: [{"prev", "target", "next", "speaker", "timestamp"}]
```

### **4단계: BERT 기반 중요도 분류** ✨ **NEW**
```python
# BERT 모델 추론 (klue/bert-base 등 한국어 모델)
for triplet in triplets:
    input_text = f"{triplet['prev']} {triplet['target']} {triplet['next']}"
    label = bert_classifier.predict(input_text)  # 0: 중요, 1: 불필요
    triplet['label'] = label
```

### **5단계: 중요 발화 필터링** ✨ **NEW**
```python
# triplet_preprocessor.py 활용
important_speeches = preprocess_triplets(triplets_with_labels)
# 결과: label=0인 중요 발화만 추출
```

### **6단계: Qwen3 LLM 업무 생성**
```python
# 필터링된 중요 발화만 LLM에 입력
filtered_text = "\n".join([speech["text"] for speech in important_speeches])
tasks = qwen3_model.generate_tasks(filtered_text)
```

---

## 📊 **예상 효과 및 장점**

### **1. 처리 효율성 향상**
- **기존**: 전체 회의 내용을 LLM에 입력 (토큰 낭비)
- **개선**: 중요 발화만 선별하여 입력 (30-50% 토큰 절약)

### **2. 업무 생성 품질 향상**
- **노이즈 제거**: 잡담, 인사말, 반복 발언 등 제외
- **핵심 집중**: 프로젝트 관련 핵심 내용만 분석
- **정확도 향상**: 불필요한 정보로 인한 혼란 방지

### **3. 비용 최적화**
- **LLM 호출 비용**: 30-50% 절감 (입력 토큰 감소)
- **처리 시간**: 20-30% 단축 (불필요한 텍스트 제거)
- **GPU 사용량**: BERT 추론은 CPU로도 충분히 빠름

---

## 🛠️ **구현 방안**

### **A. BERT 모델 선택**
```python
# 한국어 특화 BERT 모델 후보
models = [
    "klue/bert-base",           # KLUE 한국어 BERT
    "beomi/kcbert-base",        # 한국어 커뮤니티 BERT  
    "monologg/kobert",          # SKT KoBERT
]
```

### **B. 학습 데이터 구성**
```python
# 회의 발화 분류 데이터셋
training_data = [
    # Label 0: 업무 관련 중요 발화
    {"text": "이번 주까지 로그인 기능 개발 완료해야 합니다", "label": 0},
    {"text": "데이터베이스 스키마 설계 먼저 진행하겠습니다", "label": 0},
    
    # Label 1: 불필요한 발화
    {"text": "안녕하세요 모두들 잘 지내셨나요", "label": 1},
    {"text": "오늘 날씨가 정말 좋네요", "label": 1},
]
```

### **C. 모델 파인튜닝**
```python
# Hugging Face Transformers 활용
from transformers import AutoTokenizer, AutoModelForSequenceClassification

tokenizer = AutoTokenizer.from_pretrained("klue/bert-base")
model = AutoModelForSequenceClassification.from_pretrained(
    "klue/bert-base", 
    num_labels=2  # 0: 중요, 1: 불필요
)

# 회의 데이터로 파인튜닝
trainer.train(training_data)
```

---

## 🔧 **TtalKkac 통합 구현**

### **1. AI Engine 구조 변경**
```python
# ai-engine/processors/bert/
class MeetingContentClassifier:
    def __init__(self):
        self.tokenizer = AutoTokenizer.from_pretrained("klue/bert-base")
        self.model = AutoModelForSequenceClassification.from_pretrained(
            "./models/meeting-classifier"  # 파인튜닝된 모델
        )
    
    def classify_triplets(self, triplets):
        # Triplet별 중요도 분류
        for triplet in triplets:
            input_text = f"{triplet['prev']} {triplet['target']} {triplet['next']}"
            prediction = self.predict(input_text)
            triplet['label'] = prediction
        return triplets
```

### **2. Handler 업데이트**
```python
# ai-engine-runpod/handler.py 수정
def process_meeting(audio_file):
    # 1. WhisperX 음성인식
    whisper_result = whisperx_processor.transcribe(audio_file)
    
    # 2. 구조화된 데이터 생성 ✨ NEW
    structured_data = parse_whisperx_json(whisper_result)
    
    # 3. Triplet 생성 ✨ NEW
    triplets = create_structured_triplets(structured_data)
    
    # 4. BERT 분류 ✨ NEW
    classified_triplets = bert_classifier.classify_triplets(triplets)
    
    # 5. 중요 발화 필터링 ✨ NEW
    important_speeches = preprocess_triplets(classified_triplets)
    
    # 6. Qwen3 업무 생성 (기존)
    filtered_text = format_important_speeches(important_speeches)
    tasks = qwen3_model.generate_tasks(filtered_text)
    
    return {
        "transcription": whisper_result,
        "important_speeches": important_speeches,
        "generated_tasks": tasks,
        "processing_stats": {
            "total_speeches": len(triplets),
            "important_speeches": len(important_speeches),
            "filtering_ratio": len(important_speeches) / len(triplets)
        }
    }
```

### **3. Backend API 연동**
```typescript
// backend/src/services/ai-service.ts 업데이트
interface ProcessedMeeting {
  transcription: WhisperResult;
  importantSpeeches: ImportantSpeech[];  // ✨ NEW
  generatedTasks: Task[];
  processingStats: {                     // ✨ NEW
    totalSpeeches: number;
    importantSpeeches: number;
    filteringRatio: number;
  };
}

async function processMeetingWithBERT(audioFile: File): Promise<ProcessedMeeting> {
  // RunPod GPU Cloud 호출 (BERT 필터링 포함)
  const response = await runpodClient.post('/process-meeting-enhanced', {
    audio: audioFile
  });
  
  return response.data;
}
```

---

## 📈 **성능 지표 및 모니터링**

### **추가 메트릭**
```typescript
interface AIProcessingMetrics {
  // 기존 메트릭
  whisperProcessingTime: number;
  qwenProcessingTime: number;
  totalTokensUsed: number;
  
  // 새로운 BERT 관련 메트릭 ✨ NEW
  bertProcessingTime: number;
  totalSpeeches: number;
  importantSpeeches: number;
  filteringRatio: number;        // 중요 발화 비율
  tokenSavingRatio: number;      // 토큰 절약 비율
  bertAccuracy: number;          // BERT 분류 정확도 (검증 시)
}
```

---

## 🎯 **단계적 도입 계획**

### **Phase 1: BERT 모델 준비** (2주)
1. 한국어 BERT 모델 선택 및 환경 구성
2. 회의 발화 분류 데이터셋 구축 (1000개 샘플)
3. 모델 파인튜닝 및 성능 검증

### **Phase 2: 파이프라인 통합** (2주)
1. WhisperX → BERT → Qwen3 파이프라인 구현
2. RunPod 환경에서 통합 테스트
3. 성능 벤치마크 및 최적화

### **Phase 3: 프로덕션 배포** (1주)
1. Backend API 연동 및 프론트엔드 업데이트
2. 모니터링 대시보드에 새로운 메트릭 추가
3. A/B 테스트를 통한 효과 검증

---

## 💡 **추가 개선 아이디어**

### **1. 다단계 필터링**
```python
# 화자별 중요도 가중치 적용
speaker_weights = {
    "팀장": 1.2,      # 팀장 발언은 중요도 높게
    "PM": 1.1,        # PM 발언도 중요
    "개발자": 1.0,    # 기본 가중치
}
```

### **2. 실시간 학습**
```python
# 사용자 피드백 기반 모델 개선
def update_model_with_feedback(user_feedback):
    # 사용자가 "이건 중요한 발화였는데 놓쳤네요" 피드백 시
    # 모델 재학습 데이터로 활용
    pass
```

### **3. 다국어 지원**
```python
# 언어별 BERT 모델 자동 선택
language_models = {
    "ko": "klue/bert-base",
    "en": "bert-base-uncased", 
    "ja": "cl-tohoku/bert-base-japanese"
}
```

이러한 BERT 기반 필터링 시스템을 도입하면 **TtalKkac의 AI 처리 품질과 효율성이 크게 향상**될 것으로 예상됩니다! 🚀 