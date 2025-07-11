"""
TtalKkak 향상된 AI 서버 - Task Master 기능 통합
WhisperX (STT) + Qwen3-14B (LLM) + Task Master 프롬프트 시스템
"""

import os
import io
import json
import tempfile
import logging
from typing import Optional, Dict, Any, List
from contextlib import asynccontextmanager
import time

import torch
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# 로컬 모듈 임포트
from task_schemas import (
    TaskItem, MeetingAnalysisResult, ComplexityAnalysis, 
    TaskExpansionRequest, TaskExpansionResult, PipelineRequest, PipelineResult,
    calculate_task_complexity_advanced, validate_task_dependencies, 
    generate_task_id_sequence, TASK_SCHEMA_EXAMPLE
)
from meeting_analysis_prompts import (
    generate_meeting_analysis_system_prompt,
    generate_meeting_analysis_user_prompt,
    generate_task_expansion_system_prompt,
    generate_complexity_analysis_prompt,
    validate_meeting_analysis
)

import uvicorn

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 글로벌 모델 변수
whisper_model = None
qwen_model = None
qwen_tokenizer = None

# 기본 응답 모델들
class TranscriptionResponse(BaseModel):
    success: bool
    transcription: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class AnalysisRequest(BaseModel):
    transcript: str
    num_tasks: int = 5
    additional_context: Optional[str] = None

class AnalysisResponse(BaseModel):
    success: bool
    analysis: Optional[MeetingAnalysisResult] = None
    error: Optional[str] = None

class HealthResponse(BaseModel):
    status: str
    gpu_available: bool
    gpu_count: int
    models_loaded: Dict[str, bool]
    memory_info: Optional[Dict[str, float]] = None

def load_whisperx():
    """WhisperX 모델 로딩"""
    global whisper_model
    
    if whisper_model is None:
        logger.info("🎤 Loading WhisperX large-v3...")
        try:
            import whisperx
            device = "cuda" if torch.cuda.is_available() else "cpu"
            compute_type = "float16" if device == "cuda" else "int8"
            
            whisper_model = whisperx.load_model(
                "large-v3", 
                device, 
                compute_type=compute_type,
                language="ko"
            )
            logger.info("✅ WhisperX loaded successfully")
            
        except Exception as e:
            logger.error(f"❌ WhisperX loading failed: {e}")
            raise e
    
    return whisper_model

def load_qwen3():
    """Qwen3-14B 4bit 모델 로딩"""
    global qwen_model, qwen_tokenizer
    
    if qwen_model is None or qwen_tokenizer is None:
        logger.info("🧠 Loading Qwen3-14B 4bit...")
        try:
            from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig
            
            # 4비트 양자화 설정
            bnb_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_compute_dtype=torch.float16,
                bnb_4bit_use_double_quant=True,
                bnb_4bit_quant_type="nf4"
            )
            
            model_name = "unsloth/Qwen3-14B-unsloth-bnb-4bit"
            
            qwen_tokenizer = AutoTokenizer.from_pretrained(
                model_name,
                trust_remote_code=True
            )
            
            qwen_model = AutoModelForCausalLM.from_pretrained(
                model_name,
                quantization_config=bnb_config,
                device_map="auto",
                torch_dtype=torch.float16,
                trust_remote_code=True
            )
            
            logger.info("✅ Qwen3-14B loaded successfully")
            
        except Exception as e:
            logger.error(f"❌ Qwen3 loading failed: {e}")
            raise e
    
    return qwen_model, qwen_tokenizer

def generate_structured_response(
    system_prompt: str, 
    user_prompt: str, 
    response_schema: Dict[str, Any],
    temperature: float = 0.3
) -> Dict[str, Any]:
    """구조화된 응답 생성 (Task Master 스타일)"""
    
    # 모델 로딩
    qwen_model, qwen_tokenizer = load_qwen3()
    
    # 스키마 예시 포함 프롬프트
    schema_prompt = f"""
{system_prompt}

**Response Schema:**
You must respond with a JSON object following this exact structure:
```json
{json.dumps(response_schema, indent=2, ensure_ascii=False)}
```

**Important Rules:**
1. Always return valid JSON format
2. Use Korean for all text content unless technical terms require English
3. Follow the exact schema structure
4. Include all required fields
5. Use appropriate data types for each field

{user_prompt}

**Response:**
```json
"""
    
    # 메시지 구성
    messages = [{"role": "user", "content": schema_prompt}]
    
    # 토큰화
    text = qwen_tokenizer.apply_chat_template(
        messages, 
        tokenize=False, 
        add_generation_prompt=True
    )
    
    inputs = qwen_tokenizer([text], return_tensors="pt").to(qwen_model.device)
    
    # 추론 실행
    with torch.no_grad():
        outputs = qwen_model.generate(
            **inputs,
            max_new_tokens=2048,
            temperature=temperature,
            do_sample=True,
            pad_token_id=qwen_tokenizer.eos_token_id,
            repetition_penalty=1.1,
            top_p=0.9
        )
    
    # 결과 디코딩
    response = qwen_tokenizer.decode(
        outputs[0][len(inputs["input_ids"][0]):], 
        skip_special_tokens=True
    )
    
    # JSON 추출 및 파싱
    try:
        # JSON 부분만 추출
        if "```json" in response:
            json_start = response.find("```json") + 7
            json_end = response.find("```", json_start)
            if json_end == -1:
                json_end = len(response)
            json_text = response[json_start:json_end].strip()
        elif "{" in response and "}" in response:
            json_start = response.find("{")
            json_end = response.rfind("}") + 1
            json_text = response[json_start:json_end]
        else:
            json_text = response
        
        # JSON 파싱
        parsed_result = json.loads(json_text)
        return parsed_result
        
    except json.JSONDecodeError as e:
        logger.warning(f"⚠️ JSON parsing failed: {e}")
        logger.warning(f"Raw response: {response}")
        
        # 기본 구조 반환
        return {
            "summary": "AI 응답을 파싱하는 중 오류가 발생했습니다.",
            "action_items": [],
            "decisions": [],
            "next_steps": [],
            "key_points": [],
            "raw_response": response
        }

@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작/종료 시 모델 로딩/정리"""
    logger.info("🚀 Starting TtalKkak Enhanced AI Server...")
    
    # 모델들을 미리 로딩 (선택사항)
    try:
        if os.getenv("PRELOAD_MODELS", "false").lower() == "true":
            logger.info("📦 Preloading models...")
            load_whisperx()
            load_qwen3()
            logger.info("✅ Models preloaded successfully")
    except Exception as e:
        logger.warning(f"⚠️ Model preloading failed: {e}")
    
    yield
    
    logger.info("🛑 Shutting down TtalKkak Enhanced AI Server...")

# FastAPI 앱 생성
app = FastAPI(
    title="TtalKkak Enhanced AI Server",
    description="WhisperX + Qwen3-14B + Task Master Features",
    version="2.0.0",
    lifespan=lifespan
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/", response_model=Dict[str, str])
async def root():
    """루트 엔드포인트"""
    return {
        "message": "TtalKkak Enhanced AI Server",
        "version": "2.0.0",
        "features": [
            "WhisperX Speech-to-Text",
            "Qwen3-14B Meeting Analysis", 
            "Task Master Prompt System",
            "Complex Task Generation",
            "Complexity Analysis"
        ],
        "docs": "/docs"
    }

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """헬스 체크"""
    gpu_available = torch.cuda.is_available()
    gpu_count = torch.cuda.device_count() if gpu_available else 0
    
    memory_info = None
    if gpu_available:
        try:
            memory_info = {
                "allocated_gb": torch.cuda.memory_allocated() / 1024**3,
                "reserved_gb": torch.cuda.memory_reserved() / 1024**3,
                "total_gb": torch.cuda.get_device_properties(0).total_memory / 1024**3
            }
        except:
            pass
    
    return HealthResponse(
        status="healthy",
        gpu_available=gpu_available,
        gpu_count=gpu_count,
        models_loaded={
            "whisperx": whisper_model is not None,
            "qwen3": qwen_model is not None
        },
        memory_info=memory_info
    )

@app.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(audio: UploadFile = File(...)):
    """음성 파일 전사 (WhisperX)"""
    try:
        logger.info(f"🎤 Transcribing audio: {audio.filename}")
        
        # 모델 로딩
        whisper_model = load_whisperx()
        
        # 오디오 파일 임시 저장
        audio_content = await audio.read()
        
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
            temp_file.write(audio_content)
            temp_path = temp_file.name
        
        try:
            # WhisperX 전사 실행
            result = whisper_model.transcribe(temp_path, batch_size=16)
            
            segments = result.get("segments", [])
            full_text = " ".join([seg.get("text", "") for seg in segments])
            
            logger.info(f"✅ Transcription completed: {len(full_text)} characters")
            
            return TranscriptionResponse(
                success=True,
                transcription={
                    "segments": segments,
                    "full_text": full_text,
                    "language": result.get("language", "ko"),
                    "duration": sum([seg.get("end", 0) - seg.get("start", 0) for seg in segments])
                }
            )
            
        finally:
            # 임시 파일 정리
            try:
                os.unlink(temp_path)
            except:
                pass
                
    except Exception as e:
        logger.error(f"❌ Transcription error: {e}")
        return TranscriptionResponse(
            success=False,
            error=str(e)
        )

@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_meeting(request: AnalysisRequest):
    """회의 내용 분석 (Task Master 스타일)"""
    try:
        logger.info(f"🧠 Analyzing meeting content... (generating {request.num_tasks} tasks)")
        
        start_time = time.time()
        
        # 시스템 및 사용자 프롬프트 생성
        system_prompt = generate_meeting_analysis_system_prompt(request.num_tasks)
        user_prompt = generate_meeting_analysis_user_prompt(
            request.transcript, 
            request.additional_context or ""
        )
        
        # 구조화된 응답 생성
        result = generate_structured_response(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            response_schema=TASK_SCHEMA_EXAMPLE,
            temperature=0.3
        )
        
        # 결과 후처리 및 검증
        validated_result = validate_meeting_analysis(result)
        
        # TaskItem 객체로 변환
        task_items = []
        for i, item in enumerate(validated_result.get("action_items", [])):
            task_item = TaskItem(
                id=i + 1,
                title=item.get("task", f"Task {i+1}"),
                description=item.get("task", ""),
                priority=item.get("priority", "medium"),
                assignee=item.get("assignee", "미지정"),
                deadline=item.get("deadline", "미정"),
                complexity=calculate_task_complexity_advanced(
                    TaskItem(
                        id=i + 1,
                        title=item.get("task", ""),
                        description=item.get("task", ""),
                        priority=item.get("priority", "medium")
                    )
                ),
                status="pending"
            )
            task_items.append(task_item)
        
        # 의존성 검증
        task_items = validate_task_dependencies(task_items)
        
        # 최종 결과 구성
        meeting_analysis = MeetingAnalysisResult(
            summary=validated_result.get("summary", ""),
            action_items=task_items,
            decisions=validated_result.get("decisions", []),
            next_steps=validated_result.get("next_steps", []),
            key_points=validated_result.get("key_points", []),
            participants=validated_result.get("participants", []),
            follow_up=validated_result.get("follow_up", {}),
            metadata={
                "processing_time": time.time() - start_time,
                "total_tasks": len(task_items),
                "complexity_distribution": {
                    "high": len([t for t in task_items if t.complexity >= 7]),
                    "medium": len([t for t in task_items if 4 <= t.complexity < 7]),
                    "low": len([t for t in task_items if t.complexity < 4])
                }
            }
        )
        
        logger.info(f"✅ Analysis completed in {time.time() - start_time:.2f}s")
        
        return AnalysisResponse(
            success=True,
            analysis=meeting_analysis
        )
        
    except Exception as e:
        logger.error(f"❌ Analysis error: {e}")
        return AnalysisResponse(
            success=False,
            error=str(e)
        )

@app.post("/expand-task", response_model=TaskExpansionResult)
async def expand_task(request: TaskExpansionRequest):
    """태스크 확장 (서브태스크 생성)"""
    try:
        logger.info(f"🔍 Expanding task {request.task_id} into {request.num_subtasks} subtasks")
        
        # 태스크 정보 (실제로는 DB에서 조회)
        task_description = f"Task ID {request.task_id}: {request.additional_context or 'Sample task'}"
        
        # 프롬프트 생성
        system_prompt = generate_task_expansion_system_prompt(request.num_subtasks)
        user_prompt = f"""
        Expand the following task into {request.num_subtasks} detailed subtasks:
        
        **Task:** {task_description}
        **Focus Areas:** {', '.join(request.focus_areas) if request.focus_areas else 'General implementation'}
        **Additional Context:** {request.additional_context or 'None'}
        
        Generate {request.num_subtasks} specific, actionable subtasks that together accomplish the main task.
        """
        
        # 서브태스크 스키마
        subtask_schema = {
            "subtasks": [
                {
                    "id": 1,
                    "title": "서브태스크 제목",
                    "description": "서브태스크 상세 설명",
                    "priority": "high/medium/low",
                    "estimated_hours": 4
                }
            ],
            "expansion_reasoning": "태스크를 이렇게 분해한 이유와 근거"
        }
        
        # 구조화된 응답 생성
        result = generate_structured_response(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            response_schema=subtask_schema,
            temperature=0.4
        )
        
        # 결과 반환 (실제로는 DB 업데이트 포함)
        return TaskExpansionResult(
            original_task=TaskItem(
                id=request.task_id,
                title="Sample Task",
                description=task_description,
                priority="medium"
            ),
            expanded_subtasks=result.get("subtasks", []),
            expansion_reasoning=result.get("expansion_reasoning", ""),
            estimated_total_hours=sum([s.get("estimated_hours", 0) for s in result.get("subtasks", [])])
        )
        
    except Exception as e:
        logger.error(f"❌ Task expansion error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/pipeline", response_model=PipelineResult)
async def full_pipeline(audio: UploadFile = File(...)):
    """전체 파이프라인: 음성 → 전사 → 분석 → 태스크 생성"""
    try:
        logger.info("🚀 Starting enhanced full pipeline...")
        
        start_time = time.time()
        
        # 1단계: 전사
        logger.info("📝 Step 1: Transcribing audio...")
        transcribe_result = await transcribe_audio(audio)
        if not transcribe_result.success:
            return PipelineResult(
                success=False,
                step="transcription",
                error=transcribe_result.error
            )
        
        # 2단계: 분석
        logger.info("🧠 Step 2: Analyzing meeting content...")
        analysis_request = AnalysisRequest(
            transcript=transcribe_result.transcription["full_text"],
            num_tasks=5
        )
        analysis_result = await analyze_meeting(analysis_request)
        
        total_time = time.time() - start_time
        
        return PipelineResult(
            success=True,
            step="completed",
            transcription=transcribe_result.transcription,
            analysis=analysis_result.analysis,
            processing_time=total_time,
            model_info={
                "whisperx": "large-v3",
                "qwen3": "unsloth/Qwen3-14B-unsloth-bnb-4bit",
                "task_master": "integrated"
            }
        )
        
    except Exception as e:
        logger.error(f"❌ Pipeline error: {e}")
        return PipelineResult(
            success=False,
            step="pipeline",
            error=str(e)
        )

if __name__ == "__main__":
    # 환경 변수 설정
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    workers = int(os.getenv("WORKERS", "1"))
    
    logger.info(f"🚀 Starting enhanced server on {host}:{port}")
    
    uvicorn.run(
        "ai_server_enhanced:app",
        host=host,
        port=port,
        workers=workers,
        reload=False,
        log_level="info"
    )