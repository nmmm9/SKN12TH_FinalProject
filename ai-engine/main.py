"""
DdalKkak AI Engine
Python FastAPI 서버 - AI 모델 처리 전담
"""

import os
import asyncio
import tempfile
import aiofiles
import json
import base64
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, BackgroundTasks, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
from pydantic import BaseModel
from typing import Optional, Dict, Any
import logging
from datetime import datetime

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# AI 모델 초기화 (전역 변수로 관리)
whisper_model = None
qwen_model = None
embedding_model = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    애플리케이션 생명주기 관리
    시작 시 AI 모델 로드, 종료 시 정리
    """
    logger.info("🚀 AI Engine 시작 중...")
    
    # AI 모델 로드
    await load_ai_models()
    
    yield
    
    # 정리 작업
    logger.info("🛑 AI Engine 종료 중...")
    await cleanup_models()

async def load_ai_models():
    """AI 모델들 로드"""
    global whisper_processor, qwen_model, embedding_model
    
    try:
        # WhisperX STT 프로세서 로드
        logger.info("📺 WhisperX STT 프로세서 로드 중...")
        whisper_processor = await get_whisper_processor()
        
        # Qwen3 LLM 모델 로드
        logger.info("🧠 Qwen3 LLM 모델 로드 중...")
        # qwen_model = await load_qwen_model()
        
        # 임베딩 모델 로드
        logger.info("🔤 임베딩 모델 로드 중...")
        # embedding_model = await load_embedding_model()
        
        logger.info("✅ 모든 AI 모델 로드 완료!")
        
    except Exception as e:
        logger.error(f"❌ AI 모델 로드 실패: {str(e)}")
        raise

async def cleanup_models():
    """AI 모델 정리"""
    global whisper_processor, qwen_model, embedding_model
    
    # WhisperX 프로세서 정리
    if whisper_processor:
        await cleanup_whisper_processor()
    
    # 모델 메모리 정리
    whisper_processor = None
    qwen_model = None
    embedding_model = None
    
    logger.info("🧹 AI 모델 정리 완료")

# FastAPI 앱 생성
app = FastAPI(
    title="DdalKkak AI Engine",
    description="AI 기반 회의 분석 및 업무 자동화 엔진",
    version="1.0.0",
    lifespan=lifespan
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:8080"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 데이터 모델 정의 (Multi-tenant 지원)
class AudioProcessRequest(BaseModel):
    audio_url: str
    meeting_id: str
    tenant_id: str  # 테넌트 ID 추가
    user_id: str    # 사용자 ID 추가
    language: str = "ko"
    
class TextProcessRequest(BaseModel):
    text: str
    meeting_id: str
    tenant_id: str  # 테넌트 ID 추가
    user_id: str    # 사용자 ID 추가
    process_type: str  # "structure", "task_breakdown", "assignment"

class HealthResponse(BaseModel):
    status: str
    timestamp: str
    models_loaded: Dict[str, bool]
    version: str

# === API 엔드포인트 ===

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """헬스 체크"""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now().isoformat(),
        models_loaded={
            "whisper": whisper_processor is not None,
            "qwen": qwen_model is not None,
            "embedding": embedding_model is not None
        },
        version="1.0.0"
    )

@app.get("/")
async def root():
    """루트 엔드포인트"""
    return {
        "message": "DdalKkak AI Engine",
        "version": "1.0.0",
        "status": "running"
    }

@app.post("/stt/process")
async def process_audio_stt(
    request: AudioProcessRequest,
    background_tasks: BackgroundTasks
):
    """
    오디오 파일 STT 처리 (Multi-tenant)
    """
    try:
        logger.info(f"🎧 STT 처리 시작: {request.meeting_id} (tenant: {request.tenant_id})")
        
        # 테넌트별 리소스 사용량 확인
        await check_tenant_usage_limits(request.tenant_id, "stt_processing")
        
        # WhisperX 프로세서 확인
        if not whisper_processor:
            raise HTTPException(
                status_code=503, 
                detail="WhisperX 모델이 로드되지 않았습니다. 잠시 후 다시 시도해주세요."
            )
        
        # 실제 WhisperX STT 처리
        stt_result = await whisper_processor.process_audio_file(
            audio_url=request.audio_url,
            meeting_id=request.meeting_id,
            language=request.language
        )
        
        # 응답 데이터 구성
        result = {
            "meeting_id": request.meeting_id,
            "tenant_id": request.tenant_id,
            "transcript": stt_result["transcript"],
            "segments": stt_result["segments"],
            "speakers": stt_result["speakers"],
            "confidence": stt_result["confidence"],
            "processing_time": stt_result["processing_time"],
            "language": stt_result["language"],
            "total_segments": stt_result["total_segments"],
            "total_speakers": stt_result["total_speakers"],
            "has_diarization": stt_result["has_diarization"]
        }
        
        # 사용량 기록
        await record_tenant_usage(request.tenant_id, "stt_processing", 1)
        
        logger.info(f"✅ STT 처리 완료: {request.meeting_id} (tenant: {request.tenant_id})")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ STT 처리 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/stt/upload")
async def upload_audio_stt(
    file: UploadFile = File(...),
    meeting_id: str = Form(...),
    tenant_id: str = Form(...),
    user_id: str = Form(...),
    language: str = Form("ko"),
    background_tasks: BackgroundTasks = None
):
    """
    오디오 파일 업로드 및 STT 처리
    """
    temp_file_path = None
    
    try:
        logger.info(f"📁 오디오 파일 업로드 시작: {meeting_id} (tenant: {tenant_id})")
        
        # 파일 형식 검증
        allowed_formats = {".wav", ".mp3", ".m4a", ".flac", ".ogg", ".webm", ".mp4"}
        file_extension = os.path.splitext(file.filename)[1].lower()
        
        if file_extension not in allowed_formats:
            raise HTTPException(
                status_code=400,
                detail=f"지원하지 않는 파일 형식입니다. 지원 형식: {', '.join(allowed_formats)}"
            )
        
        # 파일 크기 확인 (최대 100MB)
        max_size = 100 * 1024 * 1024  # 100MB
        if file.size > max_size:
            raise HTTPException(
                status_code=400,
                detail="파일 크기가 너무 큽니다. 최대 100MB까지 지원합니다."
            )
        
        # 테넌트별 리소스 사용량 확인
        await check_tenant_usage_limits(tenant_id, "stt_processing")
        
        # 임시 파일로 저장
        temp_file = tempfile.NamedTemporaryFile(
            delete=False,
            suffix=file_extension,
            prefix=f"upload_{meeting_id}_"
        )
        temp_file_path = temp_file.name
        temp_file.close()
        
        # 파일 내용을 임시 파일에 비동기로 저장
        async with aiofiles.open(temp_file_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        logger.info(f"💾 파일 저장 완료: {temp_file_path} ({file.size} bytes)")
        
        # WhisperX 프로세서 확인
        if not whisper_processor:
            raise HTTPException(
                status_code=503,
                detail="WhisperX 모델이 로드되지 않았습니다. 잠시 후 다시 시도해주세요."
            )
        
        # STT 처리
        stt_result = await whisper_processor.process_audio_file(
            audio_url=temp_file_path,
            meeting_id=meeting_id,
            language=language
        )
        
        # 응답 데이터 구성
        result = {
            "meeting_id": meeting_id,
            "tenant_id": tenant_id,
            "filename": file.filename,
            "file_size": file.size,
            "transcript": stt_result["transcript"],
            "segments": stt_result["segments"],
            "speakers": stt_result["speakers"],
            "confidence": stt_result["confidence"],
            "processing_time": stt_result["processing_time"],
            "language": stt_result["language"],
            "total_segments": stt_result["total_segments"],
            "total_speakers": stt_result["total_speakers"],
            "has_diarization": stt_result["has_diarization"]
        }
        
        # 사용량 기록
        await record_tenant_usage(tenant_id, "stt_processing", 1)
        
        logger.info(f"✅ 파일 업로드 STT 처리 완료: {meeting_id}")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 파일 업로드 STT 처리 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # 임시 파일 정리
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
                logger.debug(f"🗑️ 임시 파일 삭제: {temp_file_path}")
            except Exception as cleanup_error:
                logger.warning(f"⚠️ 임시 파일 삭제 실패: {cleanup_error}")

@app.websocket("/stt/realtime")
async def realtime_stt_websocket(websocket: WebSocket):
    """
    실시간 STT WebSocket 엔드포인트
    """
    await websocket.accept()
    session_id = None
    
    try:
        logger.info("🔌 실시간 STT WebSocket 연결됨")
        
        # 연결 확인 메시지 전송
        await websocket.send_json({
            "type": "connection",
            "status": "connected",
            "message": "실시간 STT 서비스가 준비되었습니다.",
            "whisper_ready": whisper_processor is not None
        })
        
        while True:
            try:
                # 클라이언트로부터 메시지 수신
                data = await websocket.receive_text()
                message = json.loads(data)
                
                message_type = message.get("type")
                
                if message_type == "start_session":
                    # 세션 시작
                    session_id = message.get("session_id")
                    tenant_id = message.get("tenant_id")
                    meeting_id = message.get("meeting_id")
                    language = message.get("language", "ko")
                    
                    logger.info(f"🎤 실시간 STT 세션 시작: {session_id}")
                    
                    await websocket.send_json({
                        "type": "session_started",
                        "session_id": session_id,
                        "status": "ready",
                        "message": "실시간 STT 세션이 시작되었습니다."
                    })
                
                elif message_type == "audio_chunk":
                    # 오디오 청크 처리
                    if not session_id:
                        await websocket.send_json({
                            "type": "error",
                            "message": "세션이 시작되지 않았습니다. start_session을 먼저 호출하세요."
                        })
                        continue
                    
                    if not whisper_processor:
                        await websocket.send_json({
                            "type": "error",
                            "message": "WhisperX 모델이 로드되지 않았습니다."
                        })
                        continue
                    
                    # Base64로 인코딩된 오디오 데이터 디코딩
                    audio_data = base64.b64decode(message.get("audio_data", ""))
                    
                    # 실시간 STT 처리 (현재는 기본 응답)
                    result = await whisper_processor.process_audio_stream(
                        audio_chunk=audio_data,
                        session_id=session_id
                    )
                    
                    # 결과 전송
                    await websocket.send_json({
                        "type": "transcription",
                        "session_id": session_id,
                        "partial_text": result["partial_text"],
                        "is_final": result["is_final"],
                        "confidence": result["confidence"],
                        "timestamp": asyncio.get_event_loop().time()
                    })
                
                elif message_type == "end_session":
                    # 세션 종료
                    logger.info(f"🛑 실시간 STT 세션 종료: {session_id}")
                    
                    await websocket.send_json({
                        "type": "session_ended",
                        "session_id": session_id,
                        "message": "실시간 STT 세션이 종료되었습니다."
                    })
                    
                    session_id = None
                
                else:
                    await websocket.send_json({
                        "type": "error",
                        "message": f"알 수 없는 메시지 타입: {message_type}"
                    })
                    
            except json.JSONDecodeError:
                await websocket.send_json({
                    "type": "error",
                    "message": "잘못된 JSON 형식입니다."
                })
            except Exception as e:
                logger.error(f"❌ 실시간 STT 처리 오류: {str(e)}")
                await websocket.send_json({
                    "type": "error",
                    "message": f"처리 오류: {str(e)}"
                })
                
    except WebSocketDisconnect:
        logger.info("🔌 실시간 STT WebSocket 연결 해제됨")
    except Exception as e:
        logger.error(f"❌ WebSocket 오류: {str(e)}")
    finally:
        if session_id:
            logger.info(f"🧹 세션 정리: {session_id}")

@app.get("/stt/status")
async def get_stt_status():
    """STT 서비스 상태 확인"""
    try:
        gpu_available = torch.cuda.is_available() if 'torch' in globals() else False
        gpu_memory = None
        
        if gpu_available:
            try:
                import torch
                gpu_memory = {
                    "allocated": torch.cuda.memory_allocated(),
                    "cached": torch.cuda.memory_reserved(),
                    "total": torch.cuda.get_device_properties(0).total_memory
                }
            except Exception:
                pass
        
        return {
            "whisper_loaded": whisper_processor is not None,
            "gpu_available": gpu_available,
            "gpu_memory": gpu_memory,
            "supported_languages": ["ko", "en", "ja", "zh"],
            "max_file_size_mb": 100,
            "supported_formats": [".wav", ".mp3", ".m4a", ".flac", ".ogg", ".webm", ".mp4"]
        }
        
    except Exception as e:
        logger.error(f"❌ STT 상태 확인 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/planning/structure")
async def structure_meeting_content(
    request: TextProcessRequest,
    background_tasks: BackgroundTasks
):
    """
    회의 내용을 구조화된 기획안으로 변환 (Multi-tenant)
    """
    try:
        logger.info(f"📝 기획안 구조화 시작: {request.meeting_id} (tenant: {request.tenant_id})")
        
        # 테넌트별 리소스 사용량 확인
        await check_tenant_usage_limits(request.tenant_id, "ai_processing")
        
        # TODO: 실제 Qwen3 모델로 기획안 구조화 구현
        # result = await process_qwen_structuring(request.text)
        
        # 임시 응답 (실제 구현 예정)
        result = {
            "meeting_id": request.meeting_id,
            "tenant_id": request.tenant_id,
            "structured_content": {
                "title": "추출된 프로젝트 제목",
                "objectives": ["목표 1", "목표 2"],
                "requirements": ["요구사항 1", "요구사항 2"],
                "constraints": ["제약사항 1"],
                "timeline": "2주",
                "priority": "high"
            },
            "processing_time": 3.2,
            "confidence": 0.88
        }
        
        # 사용량 기록
        await record_tenant_usage(request.tenant_id, "ai_processing", 1)
        
        logger.info(f"✅ 기획안 구조화 완료: {request.meeting_id} (tenant: {request.tenant_id})")
        return result
        
    except Exception as e:
        logger.error(f"❌ 기획안 구조화 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/tasks/breakdown")
async def breakdown_tasks(
    request: TextProcessRequest,
    background_tasks: BackgroundTasks
):
    """
    기획안을 세부 업무로 분해
    """
    try:
        logger.info(f"⚡ 업무 분해 시작: {request.meeting_id}")
        
        # TODO: 실제 업무 분해 AI 로직 구현
        # result = await process_task_breakdown(request.text)
        
        # 임시 응답 (실제 구현 예정)
        result = {
            "meeting_id": request.meeting_id,
            "tasks": [
                {
                    "id": "task_1",
                    "title": "프로젝트 초기 설정",
                    "description": "프로젝트 환경 설정 및 기본 구조 생성",
                    "type": "epic",
                    "estimated_hours": 8,
                    "complexity": 3,
                    "required_skills": ["DevOps", "Backend"]
                },
                {
                    "id": "task_2",
                    "title": "데이터베이스 설계",
                    "description": "ERD 설계 및 스키마 생성",
                    "type": "story",
                    "estimated_hours": 12,
                    "complexity": 4,
                    "required_skills": ["Database", "Backend"]
                }
            ],
            "processing_time": 4.1,
            "total_estimated_hours": 20
        }
        
        logger.info(f"✅ 업무 분해 완료: {request.meeting_id}")
        return result
        
    except Exception as e:
        logger.error(f"❌ 업무 분해 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/assignments/optimize")
async def optimize_task_assignments(
    request: TextProcessRequest,
    background_tasks: BackgroundTasks
):
    """
    팀원별 최적 업무 배정
    """
    try:
        logger.info(f"👥 업무 배정 최적화 시작: {request.meeting_id}")
        
        # TODO: 실제 업무 배정 AI 로직 구현
        # result = await process_task_assignment(request.text)
        
        # 임시 응답 (실제 구현 예정)
        result = {
            "meeting_id": request.meeting_id,
            "assignments": [
                {
                    "task_id": "task_1",
                    "assigned_to": "user_1",
                    "confidence": 0.92,
                    "reason": "DevOps 경험이 풍부하고 현재 업무량이 적음"
                },
                {
                    "task_id": "task_2",
                    "assigned_to": "user_2",
                    "confidence": 0.87,
                    "reason": "데이터베이스 설계 전문가이며 관련 프로젝트 경험 보유"
                }
            ],
            "processing_time": 1.8,
            "optimization_score": 0.89
        }
        
        logger.info(f"✅ 업무 배정 최적화 완료: {request.meeting_id}")
        return result
        
    except Exception as e:
        logger.error(f"❌ 업무 배정 최적화 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Multi-tenant 유틸리티 함수들
async def check_tenant_usage_limits(tenant_id: str, resource_type: str):
    """테넌트별 사용량 제한 확인"""
    # TODO: 실제 데이터베이스에서 사용량 확인 구현
    logger.debug(f"사용량 제한 확인: {tenant_id} - {resource_type}")
    pass

async def record_tenant_usage(tenant_id: str, resource_type: str, amount: int):
    """테넌트별 사용량 기록"""
    # TODO: 실제 데이터베이스에 사용량 기록 구현
    logger.debug(f"사용량 기록: {tenant_id} - {resource_type}: {amount}")
    pass

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info"
    )