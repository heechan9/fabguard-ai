"""Fixed V1 experiment settings declared before model results are inspected."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ExperimentConfig:
    data_dir: Path = Path("data/raw")
    output_dir: Path = Path("results/v1")
    random_seed: int = 20260822
    train_size: int = 1175
    test_size: int = 392
    missing_threshold: float = 0.50
    cv_splits: int = 5
    cv_repeats: int = 5
    top_k_fractions: tuple[float, ...] = (0.05, 0.10, 0.20)
    logistic_c_values: tuple[float, ...] = (0.01, 0.10, 1.0)
    rf_candidates: tuple[tuple[int | None, int, str | float], ...] = (
        (8, 4, "sqrt"),
        (None, 8, "sqrt"),
    )
    rf_estimators: int = 120


OFFICIAL_HASHES = {
    "secom.data": "20f0e7ee434f7dcbae0eea9ffff009a2b57f42d6b0dc9a5bd4f00782c0a3374c",
    "secom.names": "6d91b0b46cdee03064ee3e3112f937c1b3f7fcd9933575794ec07974e6f1ea59",
    "secom_labels.data": "126884cf453705c9e61a903fe906f0665a3b45ce3639e621edc5c93c89627e03",
}

