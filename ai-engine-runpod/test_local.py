"""
로컬 테스트 스크립트 - Runpod 배포 전 확인용
"""

import base64
import json
from handler import handler

def test_health():
    """헬스 체크 테스트"""
    print("🔍 Testing health check...")
    
    event = {
        "input": {
            "action": "health"
        }
    }
    
    result = handler(event)
    print("Health check result:", json.dumps(result, indent=2, ensure_ascii=False))
    return result["success"]

def test_analyze():
    """텍스트 분석 테스트"""
    print("🧠 Testing text analysis...")
    
    test_transcript = """
    오늘 회의에서는 프로젝트 진행 상황을 논의했습니다.
    김개발님이 API 개발을 담당하시고, 다음 주 금요일까지 완료하기로 했습니다.
    이정도님은 프론트엔드 UI 작업을 맡으시고, 이번 주 내로 디자인을 마무리하시기로 했습니다.
    다음 회의는 다음 주 월요일 오후 2시에 진행하겠습니다.
    """
    
    event = {
        "input": {
            "action": "analyze",
            "transcript": test_transcript
        }
    }
    
    result = handler(event)
    print("Analysis result:", json.dumps(result, indent=2, ensure_ascii=False))
    return result["success"]

def create_test_audio_base64():
    """테스트용 더미 오디오 데이터 생성"""
    # 실제로는 wav 파일을 base64로 인코딩해야 함
    # 여기서는 더미 데이터 사용
    dummy_audio = b"DUMMY_AUDIO_DATA"
    return base64.b64encode(dummy_audio).decode()

def test_transcribe():
    """음성 전사 테스트 (더미 데이터)"""
    print("🎤 Testing transcription (with dummy data)...")
    
    audio_base64 = create_test_audio_base64()
    
    event = {
        "input": {
            "action": "transcribe",
            "audio_base64": audio_base64
        }
    }
    
    # 더미 데이터로는 실제 전사가 안 되므로 스킵
    print("⚠️ Skipping transcription test (needs real audio file)")
    return True

if __name__ == "__main__":
    print("🚀 TtalKkak AI Engine Local Test")
    print("=" * 50)
    
    try:
        # 1. 헬스 체크
        health_ok = test_health()
        print(f"Health check: {'✅' if health_ok else '❌'}")
        
        # 2. 텍스트 분석 테스트
        analyze_ok = test_analyze()
        print(f"Text analysis: {'✅' if analyze_ok else '❌'}")
        
        # 3. 음성 전사 테스트 (스킵)
        transcribe_ok = test_transcribe()
        print(f"Audio transcription: {'⚠️ Skipped (needs real audio)'}")
        
        print("\n" + "=" * 50)
        print("🎉 Local test completed!")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()