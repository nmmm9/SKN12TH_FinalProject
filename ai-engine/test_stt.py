"""
WhisperX STT 시스템 테스트 스크립트
RunPod 환경에서 실행 가능한 테스트
"""

import asyncio
import httpx
import json
import os
import time
import base64
import websockets
from pathlib import Path

# 테스트 설정
BASE_URL = "http://localhost:8001"
TEST_AUDIO_PATH = "/tmp/test_audio.wav"  # 테스트용 오디오 파일 경로

async def test_health_check():
    """헬스 체크 테스트"""
    print("🏥 헬스 체크 테스트...")
    
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BASE_URL}/health")
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
        return response.status_code == 200

async def test_stt_status():
    """STT 상태 확인 테스트"""
    print("\n📊 STT 상태 확인 테스트...")
    
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BASE_URL}/stt/status")
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
        return response.status_code == 200

async def test_file_upload_stt():
    """파일 업로드 STT 테스트"""
    print("\n📁 파일 업로드 STT 테스트...")
    
    # 테스트용 오디오 파일이 있는지 확인
    if not os.path.exists(TEST_AUDIO_PATH):
        print(f"⚠️ 테스트 오디오 파일이 없습니다: {TEST_AUDIO_PATH}")
        print("테스트용 WAV 파일을 해당 경로에 배치하고 다시 실행하세요.")
        return False
    
    async with httpx.AsyncClient(timeout=120.0) as client:  # 2분 타임아웃
        with open(TEST_AUDIO_PATH, "rb") as audio_file:
            files = {"file": ("test_audio.wav", audio_file, "audio/wav")}
            data = {
                "meeting_id": "test_meeting_001",
                "tenant_id": "test_tenant",
                "user_id": "test_user",
                "language": "ko"
            }
            
            print("🚀 STT 처리 요청 중... (최대 2분 소요)")
            start_time = time.time()
            
            try:
                response = await client.post(f"{BASE_URL}/stt/upload", files=files, data=data)
                processing_time = time.time() - start_time
                
                print(f"Status: {response.status_code}")
                print(f"Processing Time: {processing_time:.2f}초")
                
                if response.status_code == 200:
                    result = response.json()
                    print("✅ STT 처리 성공!")
                    print(f"📝 변환된 텍스트: {result.get('transcript', '')[:200]}...")
                    print(f"🎯 신뢰도: {result.get('confidence', 0):.2f}")
                    print(f"👥 화자 수: {result.get('total_speakers', 0)}")
                    print(f"📊 세그먼트 수: {result.get('total_segments', 0)}")
                    return True
                else:
                    print(f"❌ STT 처리 실패: {response.text}")
                    return False
                    
            except Exception as e:
                print(f"❌ 요청 실패: {str(e)}")
                return False

async def test_websocket_stt():
    """WebSocket 실시간 STT 테스트"""
    print("\n🔌 WebSocket 실시간 STT 테스트...")
    
    try:
        ws_url = f"ws://localhost:8001/stt/realtime"
        
        async with websockets.connect(ws_url) as websocket:
            print("✅ WebSocket 연결 성공")
            
            # 연결 메시지 수신
            welcome_msg = await websocket.recv()
            print(f"📨 환영 메시지: {welcome_msg}")
            
            # 세션 시작
            start_session_msg = {
                "type": "start_session",
                "session_id": "test_session_001",
                "tenant_id": "test_tenant",
                "meeting_id": "test_meeting_ws",
                "language": "ko"
            }
            
            await websocket.send(json.dumps(start_session_msg))
            response = await websocket.recv()
            print(f"📨 세션 시작 응답: {response}")
            
            # 더미 오디오 청크 전송 (테스트용)
            dummy_audio = b'\x00' * 1024  # 1KB 더미 오디오
            audio_msg = {
                "type": "audio_chunk",
                "audio_data": base64.b64encode(dummy_audio).decode()
            }
            
            await websocket.send(json.dumps(audio_msg))
            response = await websocket.recv()
            print(f"📨 오디오 처리 응답: {response}")
            
            # 세션 종료
            end_session_msg = {
                "type": "end_session"
            }
            
            await websocket.send(json.dumps(end_session_msg))
            response = await websocket.recv()
            print(f"📨 세션 종료 응답: {response}")
            
            print("✅ WebSocket 테스트 성공")
            return True
            
    except Exception as e:
        print(f"❌ WebSocket 테스트 실패: {str(e)}")
        return False

async def test_url_stt():
    """URL 기반 STT 테스트"""
    print("\n🌐 URL 기반 STT 테스트...")
    
    if not os.path.exists(TEST_AUDIO_PATH):
        print(f"⚠️ 테스트 오디오 파일이 없습니다: {TEST_AUDIO_PATH}")
        return False
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        data = {
            "audio_url": TEST_AUDIO_PATH,  # 로컬 파일 경로
            "meeting_id": "test_meeting_url",
            "tenant_id": "test_tenant",
            "user_id": "test_user",
            "language": "ko"
        }
        
        print("🚀 URL 기반 STT 처리 요청 중...")
        start_time = time.time()
        
        try:
            response = await client.post(f"{BASE_URL}/stt/process", json=data)
            processing_time = time.time() - start_time
            
            print(f"Status: {response.status_code}")
            print(f"Processing Time: {processing_time:.2f}초")
            
            if response.status_code == 200:
                result = response.json()
                print("✅ URL 기반 STT 처리 성공!")
                print(f"📝 변환된 텍스트: {result.get('transcript', '')[:200]}...")
                return True
            else:
                print(f"❌ URL 기반 STT 처리 실패: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ 요청 실패: {str(e)}")
            return False

async def create_test_audio():
    """테스트용 오디오 파일 생성 (optional)"""
    print("\n🎵 테스트용 오디오 파일 생성...")
    
    try:
        import numpy as np
        import soundfile as sf
        
        # 1초간의 440Hz 사인파 생성 (A4 음계)
        duration = 3.0  # 3초
        sample_rate = 16000
        frequency = 440.0
        
        t = np.linspace(0, duration, int(sample_rate * duration))
        audio_data = 0.3 * np.sin(2 * np.pi * frequency * t)
        
        sf.write(TEST_AUDIO_PATH, audio_data, sample_rate)
        print(f"✅ 테스트 오디오 파일 생성 완료: {TEST_AUDIO_PATH}")
        return True
        
    except ImportError:
        print("⚠️ numpy 또는 soundfile이 설치되지 않아 테스트 오디오를 생성할 수 없습니다.")
        print("실제 오디오 파일을 사용하거나 해당 라이브러리를 설치하세요.")
        return False
    except Exception as e:
        print(f"❌ 테스트 오디오 생성 실패: {str(e)}")
        return False

async def main():
    """메인 테스트 실행"""
    print("🚀 DdalKkak WhisperX STT 시스템 테스트 시작")
    print("=" * 60)
    
    # 테스트 오디오 파일이 없으면 생성 시도
    if not os.path.exists(TEST_AUDIO_PATH):
        await create_test_audio()
    
    tests = [
        ("헬스 체크", test_health_check),
        ("STT 상태 확인", test_stt_status),
        ("URL 기반 STT", test_url_stt),
        ("파일 업로드 STT", test_file_upload_stt),
        ("WebSocket 실시간 STT", test_websocket_stt),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            print(f"\n{'='*20} {test_name} {'='*20}")
            result = await test_func()
            results.append((test_name, result))
            
            if result:
                print(f"✅ {test_name}: 성공")
            else:
                print(f"❌ {test_name}: 실패")
                
        except Exception as e:
            print(f"❌ {test_name}: 예외 발생 - {str(e)}")
            results.append((test_name, False))
    
    # 결과 요약
    print("\n" + "="*60)
    print("📊 테스트 결과 요약")
    print("="*60)
    
    passed = 0
    total = len(results)
    
    for test_name, result in results:
        status = "✅ 성공" if result else "❌ 실패"
        print(f"{test_name}: {status}")
        if result:
            passed += 1
    
    print(f"\n전체 테스트: {passed}/{total} 성공 ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 모든 테스트가 성공했습니다!")
    else:
        print("⚠️ 일부 테스트가 실패했습니다. 로그를 확인하세요.")

if __name__ == "__main__":
    # 사용법 안내
    print("💡 사용법:")
    print("1. AI Engine 서버가 실행 중인지 확인: python main.py")
    print("2. 테스트 실행: python test_stt.py")
    print(f"3. 테스트 오디오 파일 준비: {TEST_AUDIO_PATH}")
    print()
    
    asyncio.run(main())