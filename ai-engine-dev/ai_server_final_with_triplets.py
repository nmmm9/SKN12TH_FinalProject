"""
TtalKkac 최종 AI 서버 - Triplet + BERT 통합
회의록 → Triplet 필터링 → 기획안 → Task Master PRD → 업무생성
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
from prd_generation_prompts import (
    generate_notion_project_prompt,
    generate_task_master_prd_prompt,
    format_notion_project,
    format_task_master_prd,
    validate_notion_project,
    validate_task_master_prd,
    NOTION_PROJECT_SCHEMA,
    TASK_MASTER_PRD_SCHEMA
)

# Triplet + BERT 모듈 임포트
try:
    from triplet_processor import get_triplet_processor
    from bert_classifier import get_bert_classifier
    TRIPLET_AVAILABLE = True
    logger.info("✅ Triplet + BERT 모듈 로드 성공")
except ImportError as e:
    logger.warning(f"⚠️ Triplet + BERT 모듈 로드 실패: {e}")
    TRIPLET_AVAILABLE = False

import uvicorn

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 글로벌 모델 변수
whisper_model = None
qwen_model = None
qwen_tokenizer = None

# 새로운 응답 모델들
class NotionProjectResponse(BaseModel):
    success: bool
    notion_project: Optional[Dict[str, Any]] = None
    formatted_notion: Optional[str] = None
    error: Optional[str] = None

class TaskMasterPRDResponse(BaseModel):
    success: bool
    prd_data: Optional[Dict[str, Any]] = None
    formatted_prd: Optional[str] = None
    error: Optional[str] = None

class TwoStageAnalysisRequest(BaseModel):
    transcript: str
    generate_notion: bool = True
    generate_tasks: bool = True
    num_tasks: int = 5
    additional_context: Optional[str] = None

class TwoStageAnalysisResponse(BaseModel):
    success: bool
    stage1_notion: Optional[Dict[str, Any]] = None
    stage2_prd: Optional[Dict[str, Any]] = None
    stage3_tasks: Optional[MeetingAnalysisResult] = None
    formatted_notion: Optional[str] = None
    formatted_prd: Optional[str] = None
    processing_time: Optional[float] = None
    error: Optional[str] = None

# Triplet 관련 새로운 응답 모델들
class EnhancedTranscriptionResponse(BaseModel):
    success: bool
    transcription: Optional[Dict[str, Any]] = None
    triplet_data: Optional[Dict[str, Any]] = None
    filtered_transcript: Optional[str] = None
    processing_stats: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class EnhancedTwoStageResult(BaseModel):
    success: bool
    triplet_stats: Optional[Dict[str, Any]] = None
    classification_stats: Optional[Dict[str, Any]] = None
    stage1_notion: Optional[Dict[str, Any]] = None
    stage2_prd: Optional[Dict[str, Any]] = None
    stage3_tasks: Optional[MeetingAnalysisResult] = None
    formatted_notion: Optional[str] = None
    formatted_prd: Optional[str] = None
    original_transcript_length: Optional[int] = None
    filtered_transcript_length: Optional[int] = None
    noise_reduction_ratio: Optional[float] = None
    processing_time: Optional[float] = None
    error: Optional[str] = None

# 기존 모델들
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
    """Qwen3-32B-AWQ 모델 로딩"""
    global qwen_model, qwen_tokenizer
    
    if qwen_model is None or qwen_tokenizer is None:
        logger.info("🧠 Loading Qwen3-32B-AWQ...")
        try:
            from transformers import AutoTokenizer, AutoModelForCausalLM
            
            model_name = "Qwen/Qwen3-32B-AWQ"
            
            qwen_tokenizer = AutoTokenizer.from_pretrained(
                model_name,
                trust_remote_code=True
            )
            
            qwen_model = AutoModelForCausalLM.from_pretrained(
                model_name,
                device_map="auto",
                torch_dtype=torch.float16,
                trust_remote_code=True
            )
            
            logger.info("✅ Qwen3-32B-AWQ loaded successfully")
            
        except Exception as e:
            logger.error(f"❌ Qwen3-32B-AWQ loading failed: {e}")
            raise e
    
    return qwen_model, qwen_tokenizer

def generate_structured_response(
    system_prompt: str, 
    user_prompt: str, 
    response_schema: Dict[str, Any],
    temperature: float = 0.3,
    max_input_tokens: int = 28000,  # Qwen3-32B AWQ 안전 마진 적용
    enable_chunking: bool = True
) -> Dict[str, Any]:
    """구조화된 응답 생성 (청킹 지원)"""
    
    # 청킹 필요 여부 확인
    if enable_chunking:
        try:
            from chunking_processor import get_chunking_processor
            chunking_processor = get_chunking_processor(max_context_tokens=32768)
            
            # 전체 프롬프트 토큰 수 추정
            total_prompt = f"{system_prompt}\n{user_prompt}"
            estimated_tokens = chunking_processor.estimate_tokens(total_prompt)
            
            if estimated_tokens > max_input_tokens:
                logger.info(f"🔄 청킹 필요 감지 (토큰: {estimated_tokens} > {max_input_tokens})")
                return generate_chunked_response(
                    system_prompt, user_prompt, response_schema, 
                    temperature, chunking_processor
                )
            else:
                logger.info(f"📝 단일 처리 (토큰: {estimated_tokens})")
        except ImportError:
            logger.warning("⚠️ 청킹 프로세서를 불러올 수 없습니다. 기본 처리로 진행합니다.")
    
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
                json_content = response[json_start:].strip()
            else:
                json_content = response[json_start:json_end].strip()
        else:
            # JSON 마커가 없으면 전체 응답에서 JSON 찾기
            json_content = response.strip()
        
        # JSON 파싱
        parsed_result = json.loads(json_content)
        return parsed_result
        
    except json.JSONDecodeError as e:
        logger.error(f"❌ JSON 파싱 실패: {e}")
        logger.error(f"Raw response: {response[:500]}...")
        return {
            "error": f"JSON parsing failed: {str(e)}",
            "raw_response": response[:1000]
        }
    except Exception as e:
        logger.error(f"❌ 응답 처리 실패: {e}")
        return {
            "error": f"Response processing failed: {str(e)}",
            "raw_response": response[:1000] if 'response' in locals() else "No response"
        }

def generate_chunked_response(
    system_prompt: str,
    user_prompt: str, 
    response_schema: Dict[str, Any],
    temperature: float,
    chunking_processor
) -> Dict[str, Any]:
    """청킹된 프롬프트 처리"""
    try:
        logger.info("🚀 청킹 기반 처리 시작...")
        start_time = time.time()
        
        # 1. user_prompt를 청킹
        chunks = chunking_processor.create_chunks_with_overlap(user_prompt)
        logger.info(f"📊 총 {len(chunks)}개 청크 생성")
        
        # 2. 각 청크별로 처리
        chunk_results = []
        for i, chunk in enumerate(chunks):
            logger.info(f"🔄 청크 {i+1}/{len(chunks)} 처리 중... (토큰: {chunk['estimated_tokens']})")
            
            # 청크별 시스템 프롬프트 수정
            chunk_system_prompt = f"""{system_prompt}

**청킹 처리 정보:**
- 현재 청크: {i+1}/{len(chunks)}
- 이 청크는 전체 회의의 일부입니다
- 이 청크에서 발견되는 내용만 분석하세요
- 다른 청크의 내용은 나중에 통합됩니다"""

            chunk_user_prompt = f"""다음은 전체 회의록의 일부입니다:

{chunk['text']}

위 내용을 분석하여 이 부분에서 발견되는 액션 아이템, 결정사항, 핵심 포인트를 추출하세요."""
            
            # 단일 청크 처리
            chunk_result = generate_structured_response(
                system_prompt=chunk_system_prompt,
                user_prompt=chunk_user_prompt,
                response_schema=response_schema,
                temperature=temperature,
                enable_chunking=False  # 재귀 방지
            )
            
            chunk_results.append(chunk_result)
            logger.info(f"✅ 청크 {i+1} 처리 완료")
        
        # 3. 결과 통합
        logger.info("🔄 청크 결과 통합 중...")
        merged_result = chunking_processor.merge_chunk_results(chunk_results)
        
        processing_time = time.time() - start_time
        logger.info(f"✅ 청킹 처리 완료 (소요시간: {processing_time:.2f}초)")
        
        # 메타데이터 추가
        merged_result["metadata"] = merged_result.get("metadata", {})
        merged_result["metadata"].update({
            "chunking_applied": True,
            "total_chunks": len(chunks),
            "processing_time": processing_time,
            "original_tokens": chunking_processor.estimate_tokens(user_prompt),
            "chunks_info": [
                {
                    "chunk_id": chunk["chunk_id"],
                    "tokens": chunk["estimated_tokens"],
                    "has_overlap": chunk["has_overlap"]
                }
                for chunk in chunks
            ]
        })
        
        return merged_result
        
    except Exception as e:
        logger.error(f"❌ 청킹 처리 실패: {e}")
        return {
            "error": f"Chunking processing failed: {str(e)}",
            "fallback_message": "청킹 처리에 실패했습니다. 기본 처리를 시도하세요."
        }

@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작/종료 시 모델 로딩/정리"""
    logger.info("🚀 Starting TtalKkac Final AI Server with Triplets...")
    
    # 모델들을 미리 로딩 (선택사항)
    try:
        if os.getenv("PRELOAD_MODELS", "false").lower() == "true":
            logger.info("📦 Preloading models...")
            load_whisperx()
            load_qwen3()
            if TRIPLET_AVAILABLE:
                get_bert_classifier()
            logger.info("✅ Models preloaded successfully")
    except Exception as e:
        logger.warning(f"⚠️ Model preloading failed: {e}")
    
    yield
    
    logger.info("🛑 Shutting down TtalKkac Final AI Server...")

# FastAPI 앱 생성
app = FastAPI(
    title="TtalKkac Final AI Server with Triplets",
    description="WhisperX + Triplet + BERT + Qwen3-32B + 2-Stage PRD Process",
    version="3.1.0",
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

@app.get("/")
async def root():
    """루트 엔드포인트"""
    return {
        "message": "TtalKkac Final AI Server with Triplets",
        "version": "3.1.0",
        "features": [
            "WhisperX Speech-to-Text",
            "Triplet Context Analysis", 
            "BERT Noise Filtering",
            "2-Stage PRD Process",
            "Notion Project Generation", 
            "Task Master PRD Format",
            "Advanced Task Generation"
        ],
        "workflow": "회의록 → Triplet 필터링 → 기획안 → Task Master PRD → 업무생성",
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
            "qwen3": qwen_model is not None,
            "triplet_bert": TRIPLET_AVAILABLE
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

@app.post("/transcribe-enhanced", response_model=EnhancedTranscriptionResponse)
async def transcribe_audio_enhanced(
    audio: UploadFile = File(...),
    enable_bert_filtering: bool = True,
    save_noise_log: bool = True
):
    """향상된 음성 파일 전사 (Triplet + BERT 필터링)"""
    try:
        logger.info(f"🎤 Enhanced transcribing: {audio.filename}")
        
        # 1. 기본 WhisperX 전사
        basic_result = await transcribe_audio(audio)
        if not basic_result.success:
            return EnhancedTranscriptionResponse(
                success=False,
                error=basic_result.error
            )
        
        # 2. Triplet 프로세서로 처리 (사용 가능한 경우)
        if TRIPLET_AVAILABLE and enable_bert_filtering:
            try:
                triplet_processor = get_triplet_processor()
                
                enhanced_result = triplet_processor.process_whisperx_result(
                    whisperx_result=basic_result.transcription,
                    enable_bert_filtering=enable_bert_filtering,
                    save_noise_log=save_noise_log
                )
                
                if enhanced_result["success"]:
                    logger.info("✅ Enhanced transcription with Triplets completed")
                    
                    return EnhancedTranscriptionResponse(
                        success=True,
                        transcription=basic_result.transcription,
                        triplet_data=enhanced_result.get("triplet_data"),
                        filtered_transcript=enhanced_result.get("filtered_transcript"),
                        processing_stats=enhanced_result.get("processing_stats")
                    )
                else:
                    logger.warning("⚠️ Triplet processing failed, using basic transcription")
            except Exception as e:
                logger.warning(f"⚠️ Triplet processing error: {e}")
        
        # 3. Triplet 사용 불가능 시 기본 결과 반환
        return EnhancedTranscriptionResponse(
            success=True,
            transcription=basic_result.transcription,
            filtered_transcript=basic_result.transcription["full_text"],
            processing_stats={"triplet_available": TRIPLET_AVAILABLE}
        )
        
    except Exception as e:
        logger.error(f"❌ Enhanced transcription error: {e}")
        return EnhancedTranscriptionResponse(
            success=False,
            error=str(e)
        )

@app.post("/generate-notion-project", response_model=NotionProjectResponse)
async def generate_notion_project(request: AnalysisRequest):
    """1단계: 회의록 → 노션 기획안 생성"""
    try:
        logger.info("📝 Stage 1: Generating Notion project document...")
        
        # 프롬프트 생성
        system_prompt = "당신은 회의록을 분석하여 체계적인 프로젝트 기획안을 작성하는 전문가입니다."
        user_prompt = generate_notion_project_prompt(request.transcript)
        
        # 구조화된 응답 생성
        result = generate_structured_response(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            response_schema=NOTION_PROJECT_SCHEMA,
            temperature=0.3
        )
        
        if "error" in result:
            return NotionProjectResponse(
                success=False,
                error=result["error"]
            )
        
        # 데이터 검증
        validated_result = validate_notion_project(result)
        
        # 노션 형식으로 포맷팅
        formatted_notion = format_notion_project(validated_result)
        
        logger.info("✅ Stage 1 completed: Notion project generated")
        
        return NotionProjectResponse(
            success=True,
            notion_project=validated_result,
            formatted_notion=formatted_notion
        )
        
    except Exception as e:
        logger.error(f"❌ Notion project generation error: {e}")
        return NotionProjectResponse(
            success=False,
            error=str(e)
        )

@app.post("/generate-task-master-prd", response_model=TaskMasterPRDResponse)
async def generate_task_master_prd(notion_project: Dict[str, Any]):
    """2단계: 노션 기획안 → Task Master PRD 변환"""
    try:
        logger.info("🔄 Stage 2: Converting to Task Master PRD format...")
        
        # 프롬프트 생성
        system_prompt = "당신은 기획안을 Task Master PRD 형식으로 변환하는 전문가입니다."
        user_prompt = generate_task_master_prd_prompt(notion_project)
        
        # 구조화된 응답 생성
        result = generate_structured_response(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            response_schema=TASK_MASTER_PRD_SCHEMA,
            temperature=0.3
        )
        
        if "error" in result:
            return TaskMasterPRDResponse(
                success=False,
                error=result["error"]
            )
        
        # 데이터 검증
        validated_result = validate_task_master_prd(result)
        
        # Task Master PRD 형식으로 포맷팅
        formatted_prd = format_task_master_prd(validated_result)
        
        logger.info("✅ Stage 2 completed: Task Master PRD generated")
        
        return TaskMasterPRDResponse(
            success=True,
            prd_data=validated_result,
            formatted_prd=formatted_prd
        )
        
    except Exception as e:
        logger.error(f"❌ Task Master PRD generation error: {e}")
        return TaskMasterPRDResponse(
            success=False,
            error=str(e)
        )

@app.post("/two-stage-analysis", response_model=TwoStageAnalysisResponse)
async def two_stage_analysis(request: TwoStageAnalysisRequest):
    """2단계 프로세스 통합 분석"""
    try:
        logger.info("🚀 Starting 2-stage analysis process...")
        
        start_time = time.time()
        
        # 1단계: 노션 기획안 생성
        stage1_result = None
        if request.generate_notion:
            logger.info("📝 Stage 1: Generating Notion project...")
            notion_request = AnalysisRequest(
                transcript=request.transcript,
                additional_context=request.additional_context
            )
            stage1_response = await generate_notion_project(notion_request)
            
            if not stage1_response.success:
                return TwoStageAnalysisResponse(
                    success=False,
                    error=f"Stage 1 failed: {stage1_response.error}"
                )
            
            stage1_result = stage1_response.notion_project
        
        # 2단계: Task Master PRD 변환
        stage2_result = None
        if request.generate_tasks and stage1_result:
            logger.info("🔄 Stage 2: Converting to Task Master PRD...")
            stage2_response = await generate_task_master_prd(stage1_result)
            
            if not stage2_response.success:
                return TwoStageAnalysisResponse(
                    success=False,
                    error=f"Stage 2 failed: {stage2_response.error}"
                )
            
            stage2_result = stage2_response.prd_data
        
        # 3단계: 태스크 생성 (Task Master 방식)
        stage3_result = None
        if request.generate_tasks and stage2_result:
            logger.info("🎯 Stage 3: Generating tasks using Task Master approach...")
            
            # Task Master PRD를 사용한 태스크 생성
            prd_content = format_task_master_prd(stage2_result)
            system_prompt = generate_meeting_analysis_system_prompt(request.num_tasks)
            user_prompt = f"""
            다음 PRD 문서를 분석하여 {request.num_tasks}개의 구체적인 개발 태스크를 생성하세요:
            
            {prd_content}
            
            Task Master의 프롬프트 엔지니어링을 적용하여 체계적이고 실행 가능한 태스크를 생성하세요.
            """
            
            result = generate_structured_response(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                response_schema=TASK_SCHEMA_EXAMPLE,
                temperature=0.3
            )
            
            # 결과 후처리
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
            stage3_result = MeetingAnalysisResult(
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
                    "process_type": "2-stage-task-master"
                }
            )
        
        total_time = time.time() - start_time
        
        return TwoStageAnalysisResponse(
            success=True,
            stage1_notion=stage1_result,
            stage2_prd=stage2_result,
            stage3_tasks=stage3_result,
            formatted_notion=format_notion_project(stage1_result) if stage1_result else None,
            formatted_prd=format_task_master_prd(stage2_result) if stage2_result else None,
            processing_time=total_time
        )
        
    except Exception as e:
        logger.error(f"❌ 2-stage analysis error: {e}")
        return TwoStageAnalysisResponse(
            success=False,
            error=str(e)
        )

@app.post("/two-stage-pipeline", response_model=EnhancedTwoStageResult)
async def enhanced_two_stage_pipeline(
    audio: UploadFile = File(...),
    enable_bert_filtering: bool = True,
    save_noise_log: bool = True,
    generate_notion: bool = True,
    generate_tasks: bool = True,
    num_tasks: int = 5
):
    """최종 전체 파이프라인: 음성 → Triplet 필터링 → 2단계 분석"""
    try:
        logger.info("🚀 Starting enhanced 2-stage pipeline with Triplets...")
        
        start_time = time.time()
        
        # 1단계: 향상된 전사 (Triplet + BERT)
        logger.info("📝 Step 1: Enhanced transcription...")
        enhanced_transcribe_result = await transcribe_audio_enhanced(
            audio=audio,
            enable_bert_filtering=enable_bert_filtering,
            save_noise_log=save_noise_log
        )
        
        if not enhanced_transcribe_result.success:
            return EnhancedTwoStageResult(
                success=False,
                error=enhanced_transcribe_result.error
            )
        
        # 2단계: 필터링된 텍스트로 2단계 분석
        logger.info("🧠 Step 2: Running 2-stage analysis on filtered content...")
        filtered_text = enhanced_transcribe_result.filtered_transcript or \
                       enhanced_transcribe_result.transcription["full_text"]
        
        # 🔥 청킹 필요성 체크 및 처리
        try:
            from chunking_processor import get_chunking_processor
            chunking_processor = get_chunking_processor(max_context_tokens=32768)
            
            # 필터링된 텍스트 토큰 수 확인
            estimated_tokens = chunking_processor.estimate_tokens(filtered_text)
            logger.info(f"📊 필터링된 텍스트 토큰 수: {estimated_tokens}")
            
            # 노이즈 제거 효과 로그
            original_tokens = chunking_processor.estimate_tokens(
                enhanced_transcribe_result.transcription["full_text"]
            )
            token_reduction = ((original_tokens - estimated_tokens) / original_tokens * 100) if original_tokens > 0 else 0
            logger.info(f"🎯 토큰 감소 효과: {original_tokens} → {estimated_tokens} ({token_reduction:.1f}% 감소)")
            
        except ImportError:
            logger.warning("⚠️ 청킹 프로세서를 불러올 수 없습니다.")
            estimated_tokens = len(filtered_text) * 1.5  # 대략적 추정
        
        analysis_request = TwoStageAnalysisRequest(
            transcript=filtered_text,
            generate_notion=generate_notion,
            generate_tasks=generate_tasks,
            num_tasks=num_tasks
        )
        analysis_result = await two_stage_analysis(analysis_request)
        
        total_time = time.time() - start_time
        
        # 결과 통계 계산
        original_length = len(enhanced_transcribe_result.transcription["full_text"])
        filtered_length = len(filtered_text)
        noise_reduction = 1.0 - (filtered_length / original_length) if original_length > 0 else 0.0
        
        return EnhancedTwoStageResult(
            success=True,
            triplet_stats=enhanced_transcribe_result.triplet_data,
            classification_stats=enhanced_transcribe_result.processing_stats,
            stage1_notion=analysis_result.stage1_notion if analysis_result.success else None,
            stage2_prd=analysis_result.stage2_prd if analysis_result.success else None,
            stage3_tasks=analysis_result.stage3_tasks if analysis_result.success else None,
            formatted_notion=analysis_result.formatted_notion if analysis_result.success else None,
            formatted_prd=analysis_result.formatted_prd if analysis_result.success else None,
            original_transcript_length=original_length,
            filtered_transcript_length=filtered_length,
            noise_reduction_ratio=noise_reduction,
            processing_time=total_time
        )
        
    except Exception as e:
        logger.error(f"❌ Enhanced 2-stage pipeline error: {e}")
        return EnhancedTwoStageResult(
            success=False,
            error=str(e)
        )

@app.post("/pipeline-final", response_model=Dict[str, Any])
async def final_pipeline(
    audio: UploadFile = File(...),
    generate_notion: bool = True,
    generate_tasks: bool = True,
    num_tasks: int = 5
):
    """최종 전체 파이프라인: 음성 → 전사 → 2단계 분석 (기존 호환성 유지)"""
    try:
        logger.info("🚀 Starting final pipeline with 2-stage process...")
        
        start_time = time.time()
        
        # 1단계: 전사
        logger.info("📝 Step 1: Transcribing audio...")
        transcribe_result = await transcribe_audio(audio)
        if not transcribe_result.success:
            return {
                "success": False,
                "step": "transcription",
                "error": transcribe_result.error
            }
        
        # 2단계: 2단계 분석
        logger.info("🧠 Step 2: Running 2-stage analysis...")
        analysis_request = TwoStageAnalysisRequest(
            transcript=transcribe_result.transcription["full_text"],
            generate_notion=generate_notion,
            generate_tasks=generate_tasks,
            num_tasks=num_tasks
        )
        analysis_result = await two_stage_analysis(analysis_request)
        
        total_time = time.time() - start_time
        
        return {
            "success": True,
            "step": "completed",
            "transcription": transcribe_result.transcription,
            "analysis": {
                "notion_project": analysis_result.stage1_notion,
                "task_master_prd": analysis_result.stage2_prd,
                "generated_tasks": analysis_result.stage3_tasks,
                "formatted_notion": analysis_result.formatted_notion,
                "formatted_prd": analysis_result.formatted_prd
            },
            "processing_time": total_time,
            "model_info": {
                "whisperx": "large-v3",
                "qwen3": "Qwen3-32B-AWQ",
                "process": "2-stage-task-master",
                "triplet_available": TRIPLET_AVAILABLE
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Final pipeline error: {e}")
        return {
            "success": False,
            "step": "pipeline",
            "error": str(e)
        }

if __name__ == "__main__":
    # 환경 변수 설정
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    workers = int(os.getenv("WORKERS", "1"))
    
    logger.info(f"🚀 Starting final server with Triplets on {host}:{port}")
    
    uvicorn.run(
        "ai_server_final_with_triplets:app",
        host=host,
        port=port,
        workers=workers,
        reload=False,
        log_level="info"
    )