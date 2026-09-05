# Reproducibility

## 환경

- Python 3.10+
- 의존성은 `pyproject.toml` 참조
- 고정 seed: `20260822`
- 원본 파일 SHA-256은 `src/fabguard/config.py`와 `FABGUARD_DATA_AUDIT.md` 참조

## 실행 순서

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
python -m pip install -e .

fabguard-audit --data-dir data/raw --output-dir results/v1
fabguard-run --data-dir data/raw --output-dir results/v1
fabguard-report --data-dir data/raw --result-dir results/v1 --web-data-dir web/data
python -m unittest discover -s tests -v
```

Independent manufacturing data can be checked without touching V1 artifacts:

```bash
fabguard-independent-validate \
  --input examples/independent_validation/sample_manufacturing.csv \
  --output-dir results/independent-validation
```

This command validates provenance and schema only. It does not run or retrain the V1 model.

After canonical V1 selection is complete, export its Train-only fitted pipeline without changing `results/v1`:

```bash
fabguard-model-export --data-dir data/raw --canonical-result-dir results/v1 \
  --output-dir results/locked-model-v1
```

See [`docs/LOCKED_MODEL_EXPORT.md`](docs/LOCKED_MODEL_EXPORT.md). The generated joblib file is a trusted
artifact only; verify its manifest and SHA-256 before deserialization.

## 필수 결과

- `data_audit.json`: 데이터 계약과 감사 통계
- `train_split.csv`, `test_split.csv`: 불변 sample_id 기반 분할
- `cv_metrics.csv`, `cv_summary.csv`: 5×5 반복 CV
- `test_metrics.csv`: 시간 holdout 모델별 결과
- `top_k_test.csv`: 5%·10%·20% 점검 예산
- `priority_table.csv`: 생산 건별 위험순위와 익명 변수 근거
- `feature_stability.csv`, `final_model_importance.csv`
- `manifest.json`: 환경·해시·모델 선택·결과 상태
- `figures/`: 보고서 그래프

## 검증 원칙

- 후보 선택은 Train CV Average Precision 평균만 사용합니다.
- Test 수치로 후보군, 전처리, 분할, ranking 기준을 변경하지 않습니다.
- 동일 risk score는 sample_id 오름차순으로 순위를 결정합니다.
- 결과 보고 시 `docs/TEST_EXPOSURE.md`를 함께 제공합니다.
