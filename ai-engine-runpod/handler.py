"""
TtalKkak AI Engine - Runpod Serverless Handler
WhisperX (STT) + Qwen3-14B 4bit (LLM) 통합 처리
"""

import runpod
import torch
import json
import base64
import tempfile
import os
import logging
from typing import Dict, Any, Optional

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global model variables (for cold start optimization)
whisper_model = None
qwen_model = None
qwen_tokenizer = None

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
                language="ko"  # 한국어 최적화
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
            
            # 토크나이저 로드
            qwen_tokenizer = AutoTokenizer.from_pretrained(
                model_name,
                trust_remote_code=True
            )
            
            # 모델 로드
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

def transcribe_audio(audio_base64: str) -> Dict[str, Any]:
    """음성 전사 처리"""
    try:
        logger.info("🎤 Starting audio transcription...")
        
        # 모델 로드
        whisper_model = load_whisperx()
        
        # Base64 디코딩 및 임시 파일 저장
        audio_data = base64.b64decode(audio_base64)
        
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
            temp_file.write(audio_data)
            temp_path = temp_file.name
        
        try:
            # WhisperX 전사 실행
            result = whisper_model.transcribe(temp_path, batch_size=16)
            
            # 결과 처리
            segments = result.get("segments", [])
            full_text = " ".join([seg.get("text", "") for seg in segments])
            
            logger.info(f"✅ Transcription completed: {len(full_text)} characters")
            
            return {
                "success": True,
                "transcription": {
                    "segments": segments,
                    "full_text": full_text,
                    "language": result.get("language", "ko"),
                    "duration": len(segments) * 2  # 대략적인 시간
                }
            }
            
        finally:
            # 임시 파일 정리
            if os.path.exists(temp_path):
                os.unlink(temp_path)
                
    except Exception as e:
        logger.error(f"❌ Transcription error: {e}")
        return {
            "success": False,
            "error": f"Transcription failed: {str(e)}"
        }

def analyze_meeting(transcript_text: str) -> Dict[str, Any]:
    """회의 내용 AI 분석"""
    try:
        logger.info("🧠 Starting meeting analysis...")
        
        # 모델 로드
        qwen_model, qwen_tokenizer = load_qwen3()
        
        # 프롬프트 구성
        prompt = f"""다음 회의 전사 내용을 분석하여 JSON 형식으로 답변해주세요.

회의 내용:
{transcript_text}

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
        try:
            # JSON 부분만 추출 (마크다운 코드 블록 제거)
            if "```json" in response:
                json_start = response.find("```json") + 7
                json_end = response.find("```", json_start)
                response = response[json_start:json_end].strip()
            elif "{" in response and "}" in response:
                json_start = response.find("{")
                json_end = response.rfind("}") + 1
                response = response[json_start:json_end]
            
            analysis_json = json.loads(response)
            
            return {
                "success": True,
                "analysis": analysis_json,
                "raw_response": response
            }
            
        except json.JSONDecodeError as e:
            logger.warning(f"⚠️ JSON parsing failed, returning raw response: {e}")
            return {
                "success": True,
                "analysis": {"raw_text": response},
                "raw_response": response,
                "json_error": str(e)
            }
            
    except Exception as e:
        logger.error(f"❌ Analysis error: {e}")
        return {
            "success": False,
            "error": f"Analysis failed: {str(e)}"
        }

def handler(event):
    """Runpod 메인 핸들러"""
    try:
        job_input = event.get("input", {})
        action = job_input.get("action")
        
        logger.info(f"🚀 Processing action: {action}")
        
        if action == "transcribe":
            # 음성 전사만
            audio_base64 = job_input.get("audio_base64")
            if not audio_base64:
                return {"success": False, "error": "Missing audio_base64"}
            
            result = transcribe_audio(audio_base64)
            
        elif action == "analyze":
            # 텍스트 분석만
            transcript = job_input.get("transcript")
            if not transcript:
                return {"success": False, "error": "Missing transcript"}
            
            result = analyze_meeting(transcript)
            
        elif action == "pipeline":
            # 전체 파이프라인: 음성 → 전사 → 분석
            audio_base64 = job_input.get("audio_base64")
            if not audio_base64:
                return {"success": False, "error": "Missing audio_base64"}
            
            # 1단계: 전사
            logger.info("📝 Step 1: Transcription")
            transcribe_result = transcribe_audio(audio_base64)
            if not transcribe_result["success"]:
                return transcribe_result
                
            # 2단계: 분석
            logger.info("📊 Step 2: Analysis")
            analysis_result = analyze_meeting(
                transcribe_result["transcription"]["full_text"]
            )
            
            result = {
                "success": True,
                "transcription": transcribe_result["transcription"],
                "analysis": analysis_result.get("analysis", {}),
                "raw_analysis": analysis_result.get("raw_response", ""),
                "analysis_success": analysis_result["success"]
            }
            
        elif action == "health":
            # 헬스 체크
            result = {
                "success": True,
                "status": "healthy",
                "gpu_available": torch.cuda.is_available(),
                "gpu_count": torch.cuda.device_count() if torch.cuda.is_available() else 0,
                "models_loaded": {
                    "whisperx": whisper_model is not None,
                    "qwen3": qwen_model is not None
                }
            }
            
        else:
            result = {
                "success": False, 
                "error": f"Unknown action: {action}. Available: transcribe, analyze, pipeline, health"
            }
            
        logger.info(f"✅ Action {action} completed successfully")
        return result
        
    except Exception as e:
        logger.error(f"❌ Handler error: {e}")
        return {
            "success": False,
            "error": f"Handler failed: {str(e)}"
        }

# Runpod 시작
if __name__ == "__main__":
    logger.info("🚀 Starting TtalKkak AI Engine on Runpod...")
    runpod.serverless.start({"handler": handler})