"""
WhisperX STT Processor
RunPod GPU 환경에서 WhisperX 모델을 사용한 음성-텍스트 변환 처리
"""

import os
import asyncio
import time
import logging
from typing import Dict, List, Optional, Union, Any
from pathlib import Path
import tempfile
import aiofiles
import torch
import whisperx
import librosa
import soundfile as sf
from concurrent.futures import ThreadPoolExecutor
import gc

logger = logging.getLogger(__name__)

class WhisperXProcessor:
    """
    WhisperX를 사용한 STT 처리기
    - 파일 업로드 STT
    - 실시간 스트림 STT
    - 화자 분리 (Diarization)
    - 한국어 특화 최적화
    """
    
    def __init__(self, config: Optional[Dict] = None):
        self.config = config or self._get_default_config()
        self.model = None
        self.align_model = None
        self.diarize_model = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.compute_type = "float16" if self.device == "cuda" else "int8"
        self.executor = ThreadPoolExecutor(max_workers=2)
        
        logger.info(f"🎯 WhisperX Processor 초기화 - Device: {self.device}")
    
    def _get_default_config(self) -> Dict:
        """기본 설정"""
        return {
            "model_size": "large-v3",  # large-v3 모델 사용
            "language": "ko",          # 한국어 기본
            "batch_size": 16,          # GPU 메모리에 따라 조정
            "chunk_length": 30,        # 30초 청크
            "enable_diarization": True, # 화자 분리 활성화
            "hf_token": os.getenv("HF_TOKEN"),  # Hugging Face 토큰
            "max_audio_length": 3600,   # 최대 1시간 오디오
            "sample_rate": 16000,       # 샘플링 레이트
        }
    
    async def initialize(self):
        """모델 초기화 (비동기)"""
        try:
            logger.info("🚀 WhisperX 모델 로딩 시작...")
            
            # 메인 Whisper 모델 로드
            self.model = whisperx.load_model(
                self.config["model_size"],
                device=self.device,
                compute_type=self.compute_type,
                language=self.config["language"]
            )
            
            # 한국어 정렬 모델 로드 (사용 가능한 경우)
            try:
                self.align_model, self.align_metadata = whisperx.load_align_model(
                    language_code=self.config["language"],
                    device=self.device
                )
                logger.info("✅ 한국어 정렬 모델 로드 완료")
            except Exception as e:
                logger.warning(f"⚠️ 한국어 정렬 모델 로드 실패 (타임스탬프 제한): {e}")
                self.align_model = None
            
            # 화자 분리 모델 로드
            if self.config["enable_diarization"]:
                try:
                    self.diarize_model = whisperx.DiarizationPipeline(
                        use_auth_token=self.config["hf_token"],
                        device=self.device
                    )
                    logger.info("✅ 화자 분리 모델 로드 완료")
                except Exception as e:
                    logger.warning(f"⚠️ 화자 분리 모델 로드 실패: {e}")
                    self.diarize_model = None
            
            logger.info("🎉 WhisperX 모든 모델 로딩 완료!")
            return True
            
        except Exception as e:
            logger.error(f"❌ WhisperX 모델 로딩 실패: {e}")
            raise
    
    async def process_audio_file(
        self,
        audio_url: str,
        meeting_id: str,
        language: str = "ko"
    ) -> Dict[str, Any]:
        """
        오디오 파일 STT 처리
        """
        start_time = time.time()
        temp_file = None
        
        try:
            logger.info(f"🎵 오디오 파일 STT 처리 시작: {meeting_id}")
            
            # 1. 오디오 파일 다운로드 및 전처리
            audio_data, temp_file = await self._download_and_preprocess_audio(audio_url)
            
            # 2. WhisperX STT 처리 (블로킹 작업을 executor에서 실행)
            result = await asyncio.get_event_loop().run_in_executor(
                self.executor,
                self._process_with_whisperx,
                temp_file,
                language
            )
            
            # 3. 결과 후처리
            processed_result = await self._postprocess_result(result, meeting_id)
            
            processing_time = time.time() - start_time
            processed_result["processing_time"] = processing_time
            
            logger.info(f"✅ STT 처리 완료: {meeting_id} ({processing_time:.2f}초)")
            return processed_result
            
        except Exception as e:
            logger.error(f"❌ STT 처리 실패: {meeting_id} - {e}")
            raise
        finally:
            # 임시 파일 정리
            if temp_file and os.path.exists(temp_file):
                os.unlink(temp_file)
    
    def _process_with_whisperx(self, audio_file: str, language: str) -> Dict:
        """WhisperX 실제 처리 (동기 함수)"""
        try:
            # 1. 오디오 로드
            audio = whisperx.load_audio(audio_file)
            
            # 2. STT 변환
            result = self.model.transcribe(
                audio,
                batch_size=self.config["batch_size"],
                language=language
            )
            
            # 3. 정렬 (가능한 경우)
            if self.align_model:
                result = whisperx.align(
                    result["segments"],
                    self.align_model,
                    self.align_metadata,
                    audio,
                    self.device,
                    return_char_alignments=False
                )
            
            # 4. 화자 분리 (가능한 경우)
            if self.diarize_model:
                diarize_segments = self.diarize_model(audio_file)
                result = whisperx.assign_word_speakers(diarize_segments, result)
            
            return result
            
        except Exception as e:
            logger.error(f"❌ WhisperX 처리 중 오류: {e}")
            raise
    
    async def _download_and_preprocess_audio(self, audio_url: str) -> tuple:
        """오디오 파일 다운로드 및 전처리"""
        try:
            # 임시 파일 생성
            temp_file = tempfile.NamedTemporaryFile(
                delete=False,
                suffix=".wav",
                prefix="ddalkkak_audio_"
            )
            temp_path = temp_file.name
            temp_file.close()
            
            # URL이 로컬 파일인지 확인
            if audio_url.startswith(('http://', 'https://')):
                # HTTP 다운로드 (추후 구현)
                raise NotImplementedError("HTTP 오디오 다운로드는 추후 구현 예정")
            else:
                # 로컬 파일 처리
                if not os.path.exists(audio_url):
                    raise FileNotFoundError(f"오디오 파일을 찾을 수 없습니다: {audio_url}")
                
                # 오디오 파일을 16kHz WAV로 변환
                audio_data, sr = librosa.load(
                    audio_url,
                    sr=self.config["sample_rate"],
                    mono=True
                )
                
                # 최대 길이 확인
                if len(audio_data) > self.config["max_audio_length"] * self.config["sample_rate"]:
                    raise ValueError("오디오 파일이 너무 깁니다 (최대 1시간)")
                
                # WAV 파일로 저장
                sf.write(temp_path, audio_data, self.config["sample_rate"])
                
                logger.info(f"📁 오디오 전처리 완료: {len(audio_data)/sr:.1f}초")
                return audio_data, temp_path
                
        except Exception as e:
            logger.error(f"❌ 오디오 전처리 실패: {e}")
            if temp_path and os.path.exists(temp_path):
                os.unlink(temp_path)
            raise
    
    async def _postprocess_result(self, result: Dict, meeting_id: str) -> Dict[str, Any]:
        """STT 결과 후처리"""
        try:
            # 전체 텍스트 추출
            full_text = " ".join([seg["text"] for seg in result.get("segments", [])])
            
            # 화자별 정보 추출
            speakers = {}
            segments_with_speakers = []
            
            for segment in result.get("segments", []):
                segment_data = {
                    "start": segment.get("start", 0),
                    "end": segment.get("end", 0),
                    "text": segment.get("text", ""),
                    "confidence": segment.get("no_speech_prob", 0.0)
                }
                
                # 화자 정보가 있는 경우
                if "speaker" in segment:
                    speaker_id = segment["speaker"]
                    segment_data["speaker"] = speaker_id
                    
                    if speaker_id not in speakers:
                        speakers[speaker_id] = {
                            "total_duration": 0,
                            "segments_count": 0,
                            "text_parts": []
                        }
                    
                    duration = segment_data["end"] - segment_data["start"]
                    speakers[speaker_id]["total_duration"] += duration
                    speakers[speaker_id]["segments_count"] += 1
                    speakers[speaker_id]["text_parts"].append(segment_data["text"])
                
                segments_with_speakers.append(segment_data)
            
            # 결과 구성
            processed_result = {
                "meeting_id": meeting_id,
                "transcript": full_text,
                "segments": segments_with_speakers,
                "speakers": speakers,
                "language": result.get("language", "ko"),
                "total_segments": len(segments_with_speakers),
                "total_speakers": len(speakers),
                "confidence": self._calculate_average_confidence(segments_with_speakers),
                "has_diarization": len(speakers) > 0
            }
            
            return processed_result
            
        except Exception as e:
            logger.error(f"❌ 결과 후처리 실패: {e}")
            raise
    
    def _calculate_average_confidence(self, segments: List[Dict]) -> float:
        """평균 신뢰도 계산"""
        if not segments:
            return 0.0
        
        confidences = [seg.get("confidence", 0.0) for seg in segments]
        return sum(confidences) / len(confidences)
    
    async def process_audio_stream(
        self,
        audio_chunk: bytes,
        session_id: str
    ) -> Dict[str, Any]:
        """
        실시간 오디오 스트림 처리 (추후 구현)
        """
        # TODO: 실시간 스트림 처리 구현
        logger.info(f"🎤 실시간 오디오 처리: {session_id}")
        
        return {
            "session_id": session_id,
            "partial_text": "실시간 처리 구현 예정",
            "is_final": False,
            "confidence": 0.0
        }
    
    async def cleanup(self):
        """리소스 정리"""
        try:
            logger.info("🧹 WhisperX 프로세서 정리 중...")
            
            # 모델 메모리 해제
            if self.model:
                del self.model
            if self.align_model:
                del self.align_model
            if self.diarize_model:
                del self.diarize_model
            
            # GPU 메모리 정리
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            
            # 가비지 컬렉션
            gc.collect()
            
            # ThreadPoolExecutor 종료
            self.executor.shutdown(wait=True)
            
            logger.info("✅ WhisperX 프로세서 정리 완료")
            
        except Exception as e:
            logger.error(f"❌ 정리 중 오류: {e}")

# 전역 프로세서 인스턴스
whisper_processor = None

async def get_whisper_processor() -> WhisperXProcessor:
    """WhisperX 프로세서 싱글톤 인스턴스 반환"""
    global whisper_processor
    
    if whisper_processor is None:
        whisper_processor = WhisperXProcessor()
        await whisper_processor.initialize()
    
    return whisper_processor

async def cleanup_whisper_processor():
    """프로세서 정리"""
    global whisper_processor
    
    if whisper_processor:
        await whisper_processor.cleanup()
        whisper_processor = None