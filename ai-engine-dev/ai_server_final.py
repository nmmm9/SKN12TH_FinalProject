"""
TtalKkak 최종 AI 서버 - 2단계 프로세스 구현
회의록 → 기획안 → Task Master PRD → 업무생성
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
    temperature: float = 0.3
) -> Dict[str, Any]:
    """구조화된 응답 생성"""
    
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
            "error": "AI 응답을 파싱하는 중 오류가 발생했습니다.",
            "raw_response": response
        }

@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작/종료 시 모델 로딩/정리"""
    logger.info("🚀 Starting TtalKkak Final AI Server...")
    
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
    
    logger.info("🛑 Shutting down TtalKkak Final AI Server...")

# FastAPI 앱 생성
app = FastAPI(
    title="TtalKkak Final AI Server",
    description="WhisperX + Qwen3-14B + 2-Stage PRD Process",
    version="3.0.0",
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
        "message": "TtalKkak Final AI Server",
        "version": "3.0.0",
        "features": [
            "WhisperX Speech-to-Text",
            "2-Stage PRD Process",
            "Notion Project Generation", 
            "Task Master PRD Format",
            "Advanced Task Generation"
        ],
        "workflow": "회의록 → 기획안 → Task Master PRD → 업무생성",
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
            temperature=0.4
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

@app.post("/pipeline-final", response_model=Dict[str, Any])
async def final_pipeline(
    audio: UploadFile = File(...),
    generate_notion: bool = True,
    generate_tasks: bool = True,
    num_tasks: int = 5
):
    """최종 전체 파이프라인: 음성 → 전사 → 2단계 분석"""
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
                "qwen3": "unsloth/Qwen3-14B-unsloth-bnb-4bit",
                "process": "2-stage-task-master"
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
    
    logger.info(f"🚀 Starting final server on {host}:{port}")
    
    uvicorn.run(
        "ai_server_final:app",
        host=host,
        port=port,
        workers=workers,
        reload=False,
        log_level="info"
    )