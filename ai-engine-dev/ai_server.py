"""
TtalKkak AI 서버 - Runpod 개발용
WhisperX (STT) + Qwen3-14B 4bit (LLM)
로컬 백엔드와 연동하여 사용
"""

import os
import io
import tempfile
import logging
from typing import Optional, Dict, Any, List
from contextlib import asynccontextmanager

import torch
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 글로벌 모델 변수
whisper_model = None
qwen_model = None
qwen_tokenizer = None

class TranscriptionResponse(BaseModel):
    success: bool
    transcription: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class AnalysisRequest(BaseModel):
    transcript: str

class AnalysisResponse(BaseModel):
    success: bool
    analysis: Optional[Dict[str, Any]] = None
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

@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작/종료 시 모델 로딩/정리"""
    logger.info("🚀 Starting TtalKkak AI Server...")
    
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
    
    logger.info("🛑 Shutting down TtalKkak AI Server...")

# FastAPI 앱 생성
app = FastAPI(
    title="TtalKkak AI Server",
    description="WhisperX + Qwen3-14B AI 엔진",
    version="1.0.0",
    lifespan=lifespan
)

# CORS 설정 (로컬 백엔드 연동)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 개발용, 프로덕션에서는 제한 필요
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/", response_model=Dict[str, str])
async def root():
    """루트 엔드포인트"""
    return {
        "message": "TtalKkak AI Server",
        "version": "1.0.0",
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
    """음성 파일 전사"""
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
    """회의 내용 분석"""
    try:
        logger.info("🧠 Analyzing meeting content...")
        
        # 모델 로딩
        qwen_model, qwen_tokenizer = load_qwen3()
        
        # 프롬프트 구성
        prompt = f"""다음 회의 전사 내용을 분석하여 JSON 형식으로 답변해주세요.

회의 내용:
{request.transcript}

다음 JSON 형식으로만 답변하세요:
{{
  "summary": "회의 핵심 요약 (2-3줄)",
  "action_items": [
    {{"task": "구체적인 업무 내용", "assignee": "담당자명", "deadline": "예상 마감일", "priority": "high/medium/low"}},
    {{"task": "또 다른 업무", "assignee": "담당자명", "deadline": "예상 마감일", "priority": "high/medium/low"}}
  ],
  "decisions": ["중요한 결정사항1", "중요한 결정사항2"],
  "next_steps": ["다음 단계1", "다음 단계2"],
  "key_points": ["핵심 포인트1", "핵심 포인트2"]
}}

반드시 유효한 JSON 형식으로만 답변하세요."""

        # 메시지 구성
        messages = [{"role": "user", "content": prompt}]
        
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
                max_new_tokens=1024,
                temperature=0.3,
                do_sample=True,
                pad_token_id=qwen_tokenizer.eos_token_id,
                repetition_penalty=1.1
            )
        
        # 결과 디코딩
        response = qwen_tokenizer.decode(
            outputs[0][len(inputs["input_ids"][0]):], 
            skip_special_tokens=True
        )
        
        logger.info(f"✅ Analysis completed: {len(response)} characters")
        
        # JSON 파싱 시도
        import json
        try:
            # JSON 부분만 추출
            if "```json" in response:
                json_start = response.find("```json") + 7
                json_end = response.find("```", json_start)
                response = response[json_start:json_end].strip()
            elif "{" in response and "}" in response:
                json_start = response.find("{")
                json_end = response.rfind("}") + 1
                response = response[json_start:json_end]
            
            analysis_json = json.loads(response)
            
            return AnalysisResponse(
                success=True,
                analysis=analysis_json
            )
            
        except json.JSONDecodeError as e:
            logger.warning(f"⚠️ JSON parsing failed: {e}")
            return AnalysisResponse(
                success=True,
                analysis={"raw_text": response}
            )
            
    except Exception as e:
        logger.error(f"❌ Analysis error: {e}")
        return AnalysisResponse(
            success=False,
            error=str(e)
        )

@app.post("/pipeline", response_model=Dict[str, Any])
async def full_pipeline(audio: UploadFile = File(...)):
    """전체 파이프라인: 음성 → 전사 → 분석"""
    try:
        logger.info("🚀 Starting full pipeline...")
        
        # 1단계: 전사
        transcribe_result = await transcribe_audio(audio)
        if not transcribe_result.success:
            return {
                "success": False,
                "step": "transcription",
                "error": transcribe_result.error
            }
        
        # 2단계: 분석
        analysis_request = AnalysisRequest(
            transcript=transcribe_result.transcription["full_text"]
        )
        analysis_result = await analyze_meeting(analysis_request)
        
        return {
            "success": True,
            "transcription": transcribe_result.transcription,
            "analysis": analysis_result.analysis,
            "analysis_success": analysis_result.success
        }
        
    except Exception as e:
        logger.error(f"❌ Pipeline error: {e}")
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == "__main__":
    # 환경 변수 설정
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    workers = int(os.getenv("WORKERS", "1"))
    
    logger.info(f"🚀 Starting server on {host}:{port}")
    
    uvicorn.run(
        "ai_server:app",
        host=host,
        port=port,
        workers=workers,
        reload=False,  # Runpod에서는 reload 비활성화
        log_level="info"
    )