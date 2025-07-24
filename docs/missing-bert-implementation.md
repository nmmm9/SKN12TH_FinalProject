# TtalKkac에 누락된 BERT 분류 구현 방안

## 🔍 **현재 상황 분석**

제공받은 3개 파일(`whisperX_parser.py`, `create_triplets.py`, `triplet_preprocessor.py`)은 **BERT 파이프라인의 전후 처리**만 담당하고, **핵심인 BERT 분류 단계가 완전히 누락**되어 있습니다.

### **현재 코드의 문제점**
```python
# create_triplets.py에서
result.append({
    # ... 다른 필드들 ...
    "label": None  # ❌ 라벨이 None으로 설정됨
})

# triplet_preprocessor.py에서
for triplet in triplets_with_labels:  # ❌ 라벨이 어디서 왔는지 불분명
    if triplet["label"] == 0:
        # 중요 발화 처리
```

## 🛠️ **누락된 BERT 분류 단계 구현**

### **4. bert_classifier.py** (새로 필요한 파일)

```python
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from typing import List, Dict
import logging

logger = logging.getLogger(__name__)

class MeetingContentClassifier:
    """
    BERT 기반 회의 내용 중요도 분류기
    Triplet 구조의 발화를 받아서 중요도(0: 중요, 1: 불필요)를 분류
    """
    
    def __init__(self, model_path: str = "klue/bert-base"):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.tokenizer = AutoTokenizer.from_pretrained(model_path)
        self.model = AutoModelForSequenceClassification.from_pretrained(
            model_path,
            num_labels=2  # 0: 중요, 1: 불필요
        ).to(self.device)
        
        logger.info(f"✅ BERT 분류기 로드 완료: {model_path} on {self.device}")
    
    def classify_single_triplet(self, triplet: Dict) -> int:
        """단일 triplet 분류"""
        # Triplet 텍스트 구성: [이전맥락] + [현재발화] + [다음맥락]
        input_text = f"{triplet['prev']} {triplet['target']} {triplet['next']}"
        
        # 토큰화
        inputs = self.tokenizer(
            input_text,
            max_length=512,
            padding=True,
            truncation=True,
            return_tensors="pt"
        ).to(self.device)
        
        # 추론
        with torch.no_grad():
            outputs = self.model(**inputs)
            predictions = torch.nn.functional.softmax(outputs.logits, dim=-1)
            predicted_label = torch.argmax(predictions, dim=-1).item()
        
        return predicted_label
    
    def classify_triplets(self, triplets: List[Dict]) -> List[Dict]:
        """Triplet 리스트 일괄 분류"""
        logger.info(f"🧠 BERT 분류 시작: {len(triplets)}개 triplet")
        
        for i, triplet in enumerate(triplets):
            label = self.classify_single_triplet(triplet)
            triplet['label'] = label
            
            if (i + 1) % 10 == 0:
                logger.info(f"📊 진행률: {i+1}/{len(triplets)} ({(i+1)/len(triplets)*100:.1f}%)")
        
        # 통계 계산
        important_count = sum(1 for t in triplets if t['label'] == 0)
        total_count = len(triplets)
        
        logger.info(f"✅ BERT 분류 완료: {important_count}/{total_count} ({important_count/total_count*100:.1f}%) 중요 발화")
        
        return triplets
```

### **5. complete_pipeline.py** (통합 파이프라인)

```python
from whisperX_parser import parse_whisperx_json
from create_triplets import create_structured_triplets
from bert_classifier import MeetingContentClassifier
from triplet_preprocessor import preprocess_triplets
from typing import List, Dict
import logging

logger = logging.getLogger(__name__)

class CompleteMeetingPipeline:
    """
    완전한 회의 분석 파이프라인
    WhisperX → Triplet 생성 → BERT 분류 → 중요 발화 필터링
    """
    
    def __init__(self, bert_model_path: str = "klue/bert-base"):
        self.bert_classifier = MeetingContentClassifier(bert_model_path)
        logger.info("🚀 완전한 회의 파이프라인 초기화 완료")
    
    def process_meeting(self, whisper_json_path: str, log_file_path: str = None) -> Dict:
        """전체 파이프라인 실행"""
        logger.info(f"📝 회의 분석 시작: {whisper_json_path}")
        
        # 1단계: WhisperX 결과 파싱
        logger.info("1️⃣ WhisperX 결과 파싱 중...")
        structured_data = parse_whisperx_json(whisper_json_path)
        
        # 2단계: Triplet 생성
        logger.info("2️⃣ Triplet 구조 생성 중...")
        triplets = create_structured_triplets(structured_data)
        
        # 3단계: BERT 분류 ✨ 핵심 단계!
        logger.info("3️⃣ BERT 중요도 분류 중...")
        classified_triplets = self.bert_classifier.classify_triplets(triplets)
        
        # 4단계: 중요 발화 필터링
        logger.info("4️⃣ 중요 발화 필터링 중...")
        important_speeches = preprocess_triplets(classified_triplets, log_file_path)
        
        # 결과 통계
        total_triplets = len(triplets)
        important_triplets = len(important_speeches)
        filtering_ratio = important_triplets / total_triplets if total_triplets > 0 else 0
        
        result = {
            "total_speeches": total_triplets,
            "important_speeches": important_triplets,
            "filtering_ratio": filtering_ratio,
            "filtered_content": important_speeches,
            "processing_stats": {
                "total_segments": len(structured_data),
                "total_triplets": total_triplets,
                "important_triplets": important_triplets,
                "noise_reduction": 1 - filtering_ratio
            }
        }
        
        logger.info(f"✅ 회의 분석 완료: {important_triplets}/{total_triplets} ({filtering_ratio*100:.1f}%) 중요 발화 추출")
        
        return result

# 사용 예시
if __name__ == "__main__":
    pipeline = CompleteMeetingPipeline("klue/bert-base")
    
    result = pipeline.process_meeting(
        whisper_json_path="meeting_transcription.json",
        log_file_path="filtered_out_speeches.jsonl"
    )
    
    print(f"📊 처리 결과:")
    print(f"- 전체 발화: {result['total_speeches']}개")
    print(f"- 중요 발화: {result['important_speeches']}개")
    print(f"- 필터링 비율: {result['filtering_ratio']*100:.1f}%")
```

## 🚀 **TtalKkac AI Engine 통합 방안**

### **ai-engine/processors/bert/meeting_classifier.py**

```python
"""
TtalKkac BERT 기반 회의 내용 분류기
ai-engine에 통합하여 사용
"""

import os
import logging
from typing import List, Dict, Any
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification

logger = logging.getLogger(__name__)

class TtalKkacMeetingClassifier:
    """TtalKkac 전용 BERT 분류기"""
    
    def __init__(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model_path = os.getenv("BERT_MODEL_PATH", "klue/bert-base")
        self.tokenizer = None
        self.model = None
        
    async def initialize(self):
        """비동기 모델 초기화"""
        logger.info(f"🧠 BERT 분류기 초기화: {self.model_path}")
        
        self.tokenizer = AutoTokenizer.from_pretrained(self.model_path)
        self.model = AutoModelForSequenceClassification.from_pretrained(
            self.model_path,
            num_labels=2
        ).to(self.device)
        
        logger.info(f"✅ BERT 분류기 로드 완료 on {self.device}")
    
    async def classify_meeting_content(self, whisper_segments: List[Dict]) -> Dict[str, Any]:
        """회의 내용 분류 메인 함수"""
        
        # 1. WhisperX 세그먼트를 구조화된 데이터로 변환
        from whisperX_parser import parse_whisperx_json  # 기존 파일 활용
        from create_triplets import create_structured_triplets
        from triplet_preprocessor import preprocess_triplets
        
        # 임시 JSON 파일로 저장 후 파싱 (실제로는 메모리에서 직접 처리 가능)
        structured_data = self._convert_segments_to_structured_data(whisper_segments)
        
        # 2. Triplet 생성
        triplets = create_structured_triplets(structured_data)
        
        # 3. BERT 분류
        classified_triplets = await self._classify_triplets_async(triplets)
        
        # 4. 중요 발화 필터링
        important_speeches = preprocess_triplets(classified_triplets)
        
        return {
            "success": True,
            "total_speeches": len(triplets),
            "important_speeches": len(important_speeches),
            "filtering_ratio": len(important_speeches) / len(triplets),
            "filtered_content": important_speeches,
            "noise_reduction_stats": {
                "total_segments": len(whisper_segments),
                "total_triplets": len(triplets),
                "important_triplets": len(important_speeches),
                "filtered_out": len(triplets) - len(important_speeches)
            }
        }
    
    def _convert_segments_to_structured_data(self, segments: List[Dict]) -> List[Dict]:
        """WhisperX 세그먼트를 구조화된 데이터로 변환"""
        structured_data = []
        for i, seg in enumerate(segments):
            structured_data.append({
                "timestamp": self._seconds_to_timestamp(seg.get("start", 0)),
                "timestamp_order": f"{i+1}-1",
                "speaker": seg.get("speaker", "UNKNOWN"),
                "text": seg.get("text", "").strip()
            })
        return structured_data
    
    def _seconds_to_timestamp(self, seconds: float) -> str:
        """초를 HH:MM:SS 형태로 변환"""
        from datetime import timedelta
        td = timedelta(seconds=seconds)
        return str(td).split('.')[0].zfill(8)
    
    async def _classify_triplets_async(self, triplets: List[Dict]) -> List[Dict]:
        """비동기 triplet 분류"""
        import asyncio
        
        # CPU 집약적 작업을 별도 스레드에서 실행
        loop = asyncio.get_event_loop()
        
        def classify_sync():
            for triplet in triplets:
                input_text = f"{triplet['prev']} {triplet['target']} {triplet['next']}"
                
                inputs = self.tokenizer(
                    input_text,
                    max_length=512,
                    padding=True,
                    truncation=True,
                    return_tensors="pt"
                ).to(self.device)
                
                with torch.no_grad():
                    outputs = self.model(**inputs)
                    predicted_label = torch.argmax(outputs.logits, dim=-1).item()
                
                triplet['label'] = predicted_label
            
            return triplets
        
        # 별도 스레드에서 실행하여 비동기 처리
        classified_triplets = await loop.run_in_executor(None, classify_sync)
        
        return classified_triplets

# 글로벌 인스턴스
meeting_classifier = TtalKkacMeetingClassifier()
```

### **ai-engine/main.py 업데이트**

```python
# 기존 코드에 추가

from processors.bert.meeting_classifier import meeting_classifier

@asynccontextmanager
async def lifespan(app: FastAPI):
    """애플리케이션 생명주기 관리"""
    logger.info("🚀 AI Engine 시작 중...")
    
    # 기존 모델 로드
    await load_ai_models()
    
    # BERT 분류기 초기화 ✨ NEW
    await meeting_classifier.initialize()
    
    yield
    
    logger.info("🛑 AI Engine 종료 중...")
    await cleanup_models()

@app.post("/stt/process-with-filtering")
async def process_audio_with_bert_filtering(
    request: AudioProcessRequest,
    background_tasks: BackgroundTasks
):
    """
    BERT 필터링을 포함한 STT 처리
    """
    try:
        logger.info(f"🎧 BERT 필터링 STT 처리 시작: {request.meeting_id}")
        
        # 1. 기본 WhisperX STT 처리
        stt_result = await whisper_processor.process_audio_file(
            audio_url=request.audio_url,
            meeting_id=request.meeting_id,
            language=request.language
        )
        
        # 2. BERT 기반 중요 발화 필터링 ✨ NEW
        bert_result = await meeting_classifier.classify_meeting_content(
            stt_result["segments"]
        )
        
        # 3. 통합 결과 반환
        result = {
            "meeting_id": request.meeting_id,
            "tenant_id": request.tenant_id,
            
            # 기존 STT 결과
            "transcript": stt_result["transcript"],
            "segments": stt_result["segments"],
            "speakers": stt_result["speakers"],
            
            # BERT 필터링 결과 ✨ NEW
            "filtered_transcript": " ".join([
                speech["text"] for speech in bert_result["filtered_content"]
            ]),
            "important_speeches": bert_result["filtered_content"],
            "filtering_stats": {
                "total_speeches": bert_result["total_speeches"],
                "important_speeches": bert_result["important_speeches"],
                "filtering_ratio": bert_result["filtering_ratio"],
                "noise_reduction": 1 - bert_result["filtering_ratio"]
            },
            
            # 기존 메타데이터
            "processing_time": stt_result["processing_time"],
            "language": stt_result["language"]
        }
        
        logger.info(f"✅ BERT 필터링 STT 처리 완료: {request.meeting_id}")
        return result
        
    except Exception as e:
        logger.error(f"❌ BERT 필터링 STT 처리 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
```

## 🎯 **예상 효과**

### **1. 처리 품질 향상**
- **노이즈 제거**: 잡담, 인사말, 반복 발언 등 자동 필터링
- **핵심 집중**: 업무 관련 중요 내용만 LLM에 전달
- **정확도 향상**: 불필요한 정보로 인한 LLM 혼란 방지

### **2. 비용 효율성**
- **토큰 절약**: 30-50% LLM 입력 토큰 감소
- **처리 시간**: 20-30% 단축
- **GPU 비용**: BERT는 CPU로도 충분히 빠름

### **3. 확장 가능성**
- **다국어 지원**: 언어별 BERT 모델 자동 선택
- **도메인 특화**: 업종별 파인튜닝 가능
- **실시간 학습**: 사용자 피드백 기반 모델 개선

## 📋 **구현 우선순위**

### **Phase 1: 기본 BERT 통합** (1주)
1. `bert_classifier.py` 구현
2. 기존 triplet 파일들과 연동
3. 로컬 테스트 및 검증

### **Phase 2: AI Engine 통합** (1주)  
1. `ai-engine`에 BERT 프로세서 추가
2. 새로운 API 엔드포인트 구현
3. Backend 연동 테스트

### **Phase 3: 프로덕션 배포** (1주)
1. RunPod 환경에 BERT 모델 배포
2. 성능 최적화 및 모니터링
3. A/B 테스트로 효과 검증

이제 **완전한 BERT 파이프라인**을 구현하면 TtalKkac의 AI 처리 품질이 크게 향상될 것입니다! 🚀 