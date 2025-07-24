"""
TtalKkac BERT 분류 모델
WhisperX Triplet 데이터를 중요도별로 분류하는 BERT 기반 필터링 시스템
"""

import os
import torch
import numpy as np
from typing import List, Dict, Any, Optional
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import logging

logger = logging.getLogger(__name__)

class TtalkkacBERTClassifier:
    """
    회의 발화 중요도 분류를 위한 BERT 모델
    - Label 0: 중요한 업무 관련 발화 (유지)
    - Label 1: 잡담, 인사말 등 불필요한 발화 (제거)
    """
    
    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path or "klue/bert-base"
        self.tokenizer = None
        self.model = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        
        logger.info(f"🧠 BERT 분류기 초기화 - Device: {self.device}")
    
    def load_model(self):
        """BERT 모델 로딩"""
        try:
            logger.info(f"📦 BERT 모델 로딩: {self.model_path}")
            
            # 토크나이저 로드
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_path)
            
            # 모델 로드 (파인튜닝된 모델이 있다면 해당 경로 사용)
            local_model_path = "../Bert모델/Ttalkkac_model_v2"
            if os.path.exists(local_model_path):
                logger.info("🎯 로컬 파인튜닝 모델 사용")
                from transformers import AutoConfig
                
                # config 로드 (num_labels=2 확인)
                config = AutoConfig.from_pretrained(local_model_path, num_labels=2)
                
                # 모델 아키텍처 생성
                self.model = AutoModelForSequenceClassification.from_config(config)
                
                # .pt 파일 로드 (사용자가 업로드할 예정)
                pt_file_path = os.path.join(local_model_path, "Ttalkkac_model_v2.pt")
                if os.path.exists(pt_file_path):
                    state_dict = torch.load(pt_file_path, map_location=self.device)
                    self.model.load_state_dict(state_dict)
                    logger.info("✅ 파인튜닝된 모델 로드 완료")
                else:
                    logger.warning("⚠️ .pt 파일 없음, 기본 BERT 모델 사용")
                    self.model = AutoModelForSequenceClassification.from_pretrained(
                        self.model_path, num_labels=2
                    )
            else:
                # 기본 BERT 모델 사용
                logger.info("📖 기본 BERT 모델 사용")
                self.model = AutoModelForSequenceClassification.from_pretrained(
                    self.model_path, num_labels=2
                )
            
            # GPU로 이동
            self.model.to(self.device)
            self.model.eval()
            
            logger.info("✅ BERT 모델 로딩 완료")
            
        except Exception as e:
            logger.error(f"❌ BERT 모델 로딩 실패: {e}")
            raise e
    
    def classify_triplet(self, triplet: Dict[str, Any]) -> int:
        """단일 Triplet 분류"""
        if not self.model or not self.tokenizer:
            self.load_model()
        
        try:
            # Triplet 텍스트 결합 (맥락 포함)
            prev_text = triplet.get("prev", "")
            target_text = triplet.get("target", "")
            next_text = triplet.get("next", "")
            
            # [TGT] 태그 제거 후 결합
            target_clean = target_text.replace("[TGT]", "").replace("[/TGT]", "").strip()
            combined_text = f"{prev_text} {target_clean} {next_text}".strip()
            
            # 토크나이징
            inputs = self.tokenizer(
                combined_text,
                return_tensors="pt",
                padding=True,
                truncation=True,
                max_length=512
            )
            
            # GPU로 이동
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            
            # 추론
            with torch.no_grad():
                outputs = self.model(**inputs)
                prediction = torch.argmax(outputs.logits, dim=-1)
                confidence = torch.softmax(outputs.logits, dim=-1)
            
            label = prediction.item()
            conf_score = confidence[0][label].item()
            
            return {
                "label": label,  # 0: 중요, 1: 노이즈
                "confidence": conf_score,
                "text_length": len(combined_text)
            }
            
        except Exception as e:
            logger.error(f"❌ Triplet 분류 실패: {e}")
            # 기본값: 중요한 발화로 분류 (안전장치)
            return {"label": 0, "confidence": 0.5, "text_length": 0}
    
    def classify_triplets_batch(self, triplets: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Triplet 배치 분류"""
        logger.info(f"🔍 BERT 분류 시작: {len(triplets)}개 Triplet")
        
        classified_triplets = []
        important_count = 0
        noise_count = 0
        
        for i, triplet in enumerate(triplets):
            try:
                # 분류 수행
                classification = self.classify_triplet(triplet)
                
                # 결과 추가
                triplet_with_label = triplet.copy()
                triplet_with_label["label"] = classification["label"]
                triplet_with_label["confidence"] = classification["confidence"]
                
                classified_triplets.append(triplet_with_label)
                
                # 통계 수집
                if classification["label"] == 0:
                    important_count += 1
                else:
                    noise_count += 1
                    
                # 진행률 로그
                if (i + 1) % 50 == 0 or (i + 1) == len(triplets):
                    logger.info(f"📊 분류 진행률: {i+1}/{len(triplets)} ({((i+1)/len(triplets)*100):.1f}%)")
                    
            except Exception as e:
                logger.error(f"❌ Triplet {i} 분류 실패: {e}")
                # 실패 시 기본값으로 중요한 발화로 분류
                triplet["label"] = 0
                triplet["confidence"] = 0.5
                classified_triplets.append(triplet)
                important_count += 1
        
        # 분류 결과 통계
        total = len(triplets)
        noise_ratio = (noise_count / total) * 100 if total > 0 else 0
        
        logger.info(f"✅ BERT 분류 완료")
        logger.info(f"📈 분류 통계:")
        logger.info(f"   - 전체: {total}개")
        logger.info(f"   - 중요 발화: {important_count}개 ({100-noise_ratio:.1f}%)")
        logger.info(f"   - 노이즈 발화: {noise_count}개 ({noise_ratio:.1f}%)")
        
        return classified_triplets
    
    def get_classification_stats(self, classified_triplets: List[Dict[str, Any]]) -> Dict[str, Any]:
        """분류 통계 생성"""
        total = len(classified_triplets)
        important = sum(1 for t in classified_triplets if t.get("label") == 0)
        noise = total - important
        
        return {
            "total_triplets": total,
            "important_triplets": important,
            "noise_triplets": noise,
            "noise_reduction_ratio": (noise / total) if total > 0 else 0,
            "avg_confidence": np.mean([t.get("confidence", 0.5) for t in classified_triplets]),
            "method": "BERT-based classification"
        }

# 전역 인스턴스
bert_classifier = None

def get_bert_classifier() -> TtalkkacBERTClassifier:
    """BERT 분류기 싱글톤 인스턴스 반환"""
    global bert_classifier
    
    if bert_classifier is None:
        bert_classifier = TtalkkacBERTClassifier()
        bert_classifier.load_model()
    
    return bert_classifier