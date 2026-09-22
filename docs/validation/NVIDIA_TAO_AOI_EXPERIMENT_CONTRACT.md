# NVIDIA TAO AOI 최소 실험계약

## 상태와 목적

이 문서는 NVIDIA TAO Optical Inspection을 FabGuard의 **별도 AOI 시각검사 증거선**으로
검토하기 위한 실행 전 계약이다. 현재 상태는 `planned_blocked_pending_data_and_gpu`다.
학습, 평가, 추론, ONNX/TensorRT 내보내기를 실행했다는 증거가 아니다.

기존 SECOM V1은 익명 표형 생산기록의 위험순위를 평가한다. 이 AOI 후보는 기준 이미지와
검사 이미지를 비교하는 Siamese 네트워크다. 두 결과를 합치거나 SECOM 성능을 AOI 성능으로
전이해 주장하지 않는다.

기계 판독 계약은
[`examples/nvidia_tao/optical_inspection_contract.json`](../../examples/nvidia_tao/optical_inspection_contract.json)에 있다.

## NVIDIA 공식 실행 경계

| 항목 | 고정하거나 확인할 값 |
|---|---|
| NVIDIA 스킬 | `tao-train-optical-inspection` |
| 컨테이너 | `nvcr.io/nvidia/tao/tao-toolkit:7.1.0-pyt` |
| 모델 후보 | `Siamese_3`, custom backbone |
| 기본 학습 정책 | AutoML `on`; 실제 실행 시 자원·검색공간을 별도 기록 |
| 학습 모니터링 | TAO 기본 `val_acc` |
| 런타임 | Docker, NVIDIA Container Toolkit, NVIDIA GPU 1개, VRAM 8GB 이상 |
| 입력 묶음 | split별 `images.tar.gz`와 `dataset.csv` |
| 기본 입력 | LowAngleLight, SolderLight, UniformLight, WhiteLight의 4개 입력을 가정하되 실제 장비·데이터 확인 전 확정하지 않음 |

NVIDIA 지침상 train·validation·test 경로는 모든 학습 실행에서 명시해야 한다. 추론에도
별도의 이미지 묶음과 CSV가 필요하다. 체크포인트 파일명은 추측하지 않고 학습 작업의
선택 결과에서 해석한다. 신뢰하지 못한 체크포인트에 PyTorch 호환성 우회 환경변수를
적용하지 않는다.

## 데이터 승인 조건

실행 전 다음 항목을 모두 충족해야 한다.

1. 원본 이미지의 소유권·재배포 가능 범위·촬영 장비·조명 조건을 기록한다.
2. `dataset.csv`의 실제 열, 이미지 상대경로, 라벨 의미를 표본 파일로 검증한다.
3. 기준(golden) 이미지의 선정자·버전·기판/부품 위치와 결함 라벨의 전문가 근거를 남긴다.
4. 동일 기판, 동일 lot 또는 근접 촬영본이 train과 validation/test에 걸치지 않도록
   **물리 기판 또는 lot 단위**로 분할한다.
5. 결함 유형별 표본 수와 중복·손상·누락·해상도·조명 누락을 감사한다.
6. 실제 포맷이 NVIDIA TAO-ready인지 확인한다. 변환 데이터만 제공되면 변환은
   `not run: preconverted dataset provided`로 기록하며, 원본 PCB 형식을 만들었다고 쓰지 않는다.
7. 압축 해제 후 `dataset.csv`가 가리키는 이미지 루트와 `golden/` 및 기판 폴더가 실제로
   일치하는지 확인한다.

데이터가 없으므로 샘플 PCB 데이터, 가상 결함 라벨, 성공 결과를 생성하지 않는다.

## 평가와 승인 기준

TAO의 `val_acc`는 학습 모니터링 값일 뿐 FabGuard의 배포 승인 지표가 아니다. 독립 test에서
다음 항목을 원자료와 함께 남긴다.

- confusion matrix
- 전체 및 결함 유형별 recall
- false negative 건수와 해당 이미지 ID
- false positive 건수와 해당 이미지 ID
- 기판/lot/조명 조건별 성능 편차
- 고정 seed, 데이터 해시, 컨테이너 태그, spec, 선택 체크포인트

정량 임계값은 데이터의 결함 정의, 베이스레이트, 재검사 비용과 미탐 위험을 도메인 전문가가
확인한 뒤 정한다. 지금 숫자를 미리 넣지 않는다. 정확도가 높아도 결함 미탐이 크거나 split
누출이 있으면 실패다.

## 단계별 중단 조건

| 단계 | 진행 조건 | 중단 조건 |
|---|---|---|
| 사전감사 | 출처·권리·스키마·golden 근거 확인 | 하나라도 불명확 |
| 환경검사 | Docker·NVIDIA runtime·GPU/VRAM 확인 | 컨테이너 GPU smoke 실패 |
| 최소 smoke | batch size 2 이상, 작은 학습 구간, 출력·로그 경로 고정 | 이미지 경로·CSV·메모리·비결정성 오류 |
| 본 학습 | 사전 고정 split과 승인 spec 사용 | test 열람 또는 split 변경 |
| 평가 | 선택 체크포인트로 독립 test 1회 | 체크포인트 추측·재학습·test 튜닝 |
| export | 평가된 체크포인트만 ONNX 변환 | 평가와 다른 모델 또는 변환 불일치 |
| TensorRT | TAO Deploy 경로와 별도 검증 사용 | PyT 컨테이너에서 엔진 생성을 성공으로 기록 |

## 현재 허용되는 표현

- 허용: “NVIDIA TAO Optical Inspection 실행 전 계약을 작성했다.”
- 금지: “AOI 모델을 학습했다”, “결함검사를 검증했다”, “현장 적용 가능하다”,
  “수율을 개선했다”, “비용을 절감했다”.

다음 진행 조건은 **실제 AOI 이미지·라벨·golden 기준과 사용 가능한 NVIDIA GPU 환경 확보**다.
그 전에는 FabGuard 웹의 성과 카드나 SECOM 정본 결과에 AOI 성능을 추가하지 않는다.
SMT 시뮬레이션에는 실행 전 확인 항목만 표시하며, 합성 기판·이상값을 학습 입력이나 모델
출력으로 사용하지 않는다.
