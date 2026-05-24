import struct
import os
from datetime import datetime
from nacl.signing import SigningKey
from nacl.encoding import RawEncoder
from config import HEADER_PATH
from data_manager import get_history
from dotenv import load_dotenv

# .env 파일이 있으면 읽어오고, 없으면(서버 환경) 시스템 환경변수를 그대로 사용합니다.
load_dotenv()

from nacl.signing import VerifyKey
from nacl.exceptions import BadSignatureError

def verify_in_python(binary_data, signature, public_key_bytes):
    try:
        # 1. 바이트 형태의 공개키로부터 VerifyKey 객체 생성
        verify_key = VerifyKey(public_key_bytes)
        
        # 2. 데이터와 서명을 대조하여 검증 (예외가 발생하지 않으면 성공)
        # signature와 binary_data는 모두 bytes 타입이어야 합니다.
        verify_key.verify(binary_data, signature)
        
        print("✅ [Python] Verification successful! 서명과 데이터가 일치합니다.")
        return True
    except BadSignatureError:
        print("❌ [Python] Verification failed! 서명이 올바르지 않습니다.")
        return False
    except Exception as e:
        print(f"⚠️ [Python] Error during verification: {e}")
        return False

# processor.py 내에서 호출 예시
# verify_in_python(binary_data, signature, public_key)

def generate_wasm_header():
    # 1. 데이터 로드 (data_manager 캐시 활용)
    history = get_history()
    if not history:
        print("Error: 가공할 데이터가 없습니다. JSON 파일을 확인하세요.")
        return False

    private_key_hex = os.environ.get('LOTTO_PRIVATE_KEY')
    
    if not private_key_hex:
        # CI 환경에서 실수로 키를 안 넣었을 때 에러를 발생시켜 빌드를 중단시킵니다.
        if os.environ.get('GITHUB_ACTIONS'): 
            raise ValueError("CI 환경에서 LOTTO_PRIVATE_KEY가 설정되지 않았습니다.")
    else:
        signing_key = SigningKey(bytes.fromhex(private_key_hex))

    # 3. 바이너리 패킹 (회차당 32바이트 구조: 8+8+8+8)
    binary_payload = b""
    try:
        for item in history:
            # [Field 1] 비트셋: 번호(45)+보너스(7)+회차(12) = 64bit
            bitset = 0
            for i in range(1, 7):
                bitset |= (1 << (item[f'tm{i}WnNo'] - 1))
            bitset |= (item['bnsWnNo'] << 45)
            bitset |= (item['ltEpsd'] << 52)

            # [Field 2,3,4] 당첨금: 각 uint64 (8bytes씩)
            amt1 = item['rnk1WnAmt']
            amt2 = item['rnk2WnAmt']
            amt3 = item['rnk3WnAmt']

            # 패킹 (Little-endian uint64 * 4), 포맷스트링 QQQQ 필드4개
            record = struct.pack('<QQQQ', bitset, amt1, amt2, amt3)
            binary_payload += record
    except KeyError as e:
        print(f"Error: JSON 데이터 형식이 잘못되었습니다. 누락된 키: {e}")
        return False

    # 4. Ed25519 서명 추출
    signed_data = signing_key.sign(binary_payload,)
    signature = signed_data.signature
    public_key = signing_key.verify_key.encode()


    # 5. C++ 헤더 템플릿 생성
    header_content = f"""/**
 * [ LOTTO DATA BINARY STRUCTURE ]
 * 
 * 1. 전체 구조: 
 *    - 각 회차는 32바이트(256비트)의 고정 크기 레코드로 구성됨.
 *    - 전체 데이터 크기 = LOTTO_TOTAL_COUNT * 32 Bytes.
 * 
 * 2. 레코드 상세 (32 Bytes / Little-endian):
 * 
 *    (1) Field 1: Lotto Metadata Bitset (8 Bytes / uint64_t)
 *        |  비트 범위  |  크기  |  내용                                |
 *        | :--------- | :---- | :---------------------------------- |
 *        |  00 ~ 44   |  45b  |  당첨번호 1~45 (각 비트가 번호 존재 여부) |
 *        |  45 ~ 51   |  07b  |  보너스 번호 (0~127 범위 가능, 실제 1~45) |
 *        |  52 ~ 63   |  12b  |  회차 정보 (0~4095 회차까지 기록 가능)    |
 * 
 *    (2) Field 2: 1st Prize Amount (8 Bytes / uint64_t)
 *        - 1등 당첨금 (원 단위, 최대 18.4경 원까지 수용 가능)
 * 
 *    (3) Field 3: 2nd Prize Amount (8 Bytes / uint64_t)
 *        - 2등 당첨금 (원 단위)
 * 
 *    (4) Field 4: 3rd Prize Amount (8 Bytes / uint64_t)
 *        - 3등 당첨금 (원 단위)
 * 
 * 3. 데이터 검증:
 *    - LOTTO_RAW_DATA 전체에 대해 Ed25519 서명이 수행됨.
 *    - Wasm 모듈 로드 시 LOTTO_SIGNATURE와 LOTTO_PUBLIC_KEY를 통해 무결성 검증.
 */
#ifndef LOTTO_DATA_H
#define LOTTO_DATA_H

#include <stdint.h>

/*
 * 자동 생성된 로또 데이터 헤더 (생성일: {datetime.now().strftime('%Y-%m-%d %H:%M')})
 * 구조: [Bitset(8B) | 1등금(8B) | 2등금(8B) | 3등금(8B)] = 회차당 32바이트
 * 비트셋 상세: 0-44(번호), 45-51(보너스), 52-63(회차)
 */

#define LOTTO_TOTAL_COUNT {len(history)}

// 로또 당첨 데이터 바이너리 배열
static const uint8_t LOTTO_RAW_DATA[] = {{
    {','.join([f'0x{b:02x}' for b in binary_payload])}
}};

// 데이터 무결성 검증을 위한 Ed25519 서명 (64 bytes)
static const uint8_t LOTTO_SIGNATURE[64] = {{
    {','.join([f'0x{b:02x}' for b in signature])}
}};

// 서명 검증용 공개키 (32 bytes)
static const uint8_t LOTTO_PUBLIC_KEY[32] = {{
    {','.join([f'0x{b:02x}' for b in public_key])}
}};

#endif
"""

    # 6. 파일 출력
    os.makedirs(os.path.dirname(HEADER_PATH), exist_ok=True)
    with open(HEADER_PATH, 'w', encoding='utf-8') as f:
        f.write(header_content)
    
    print(f"✅ 완료: {len(history)}회차 데이터가 {HEADER_PATH}에 저장되었습니다.")

    # 7. test
    # verify_in_python(binary_payload,signature,public_key)
    return True

# --- 단위 실행 테스트 섹션 ---
if __name__ == "__main__":
    # 로컬 테스트 시 환경변수 수동 설정 예시 (실제 운영 시에는 시스템 환경변수 사용)
    # os.environ['LOTTO_PRIVATE_KEY'] = 'your_64_hex_chars_here'
    
    print("--- Processor 단독 테스트 시작 ---")
    if generate_wasm_header():
        print("헤더 생성 테스트 성공!")
    else:
        print("헤더 생성 테스트 실패.")
    