"""Model candidates and leakage-safe pipelines."""

from __future__ import annotations

from dataclasses import dataclass
import inspect

from sklearn.dummy import DummyClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from .config import ExperimentConfig
from .preprocessing import TrainColumnFilter


@dataclass(frozen=True)
class Candidate:
    name: str
    family: str
    params: dict[str, object]


def candidates(config: ExperimentConfig) -> list[Candidate]:
    items = [Candidate("dummy_prior", "dummy", {})]
    items.extend(
        Candidate(f"l1_logistic_c_{c:g}", "logistic", {"C": c})
        for c in config.logistic_c_values
    )
    items.extend(
        Candidate(
            f"random_forest_depth_{depth or 'none'}_leaf_{leaf}",
            "random_forest",
            {"max_depth": depth, "min_samples_leaf": leaf, "max_features": max_features},
        )
        for depth, leaf, max_features in config.rf_candidates
    )
    return items


def build_pipeline(candidate: Candidate, config: ExperimentConfig) -> Pipeline:
    common = [
        ("quality", TrainColumnFilter(config.missing_threshold)),
        ("imputer", SimpleImputer(strategy="median", add_indicator=True)),
    ]
    if candidate.family == "dummy":
        estimator = DummyClassifier(strategy="prior", random_state=config.random_seed)
    elif candidate.family == "logistic":
        common.append(("scaler", StandardScaler()))
        logistic_kwargs: dict[str, object] = {
            "solver": "liblinear",
            "class_weight": "balanced",
            "C": float(candidate.params["C"]),
            "random_state": config.random_seed,
            "max_iter": 3000,
        }
        penalty_default = inspect.signature(LogisticRegression).parameters["penalty"].default
        if penalty_default == "deprecated":
            logistic_kwargs["l1_ratio"] = 1.0
        else:
            logistic_kwargs["penalty"] = "l1"
        estimator = LogisticRegression(
            **logistic_kwargs,
        )
    elif candidate.family == "random_forest":
        estimator = RandomForestClassifier(
            n_estimators=config.rf_estimators,
            class_weight="balanced_subsample",
            random_state=config.random_seed,
            n_jobs=-1,
            max_depth=candidate.params["max_depth"],
            min_samples_leaf=int(candidate.params["min_samples_leaf"]),
            max_features=candidate.params["max_features"],
        )
    else:
        raise ValueError(f"Unknown model family: {candidate.family}")
    return Pipeline([*common, ("model", estimator)])


def transformed_feature_names(pipeline: Pipeline) -> list[str]:
    quality_names = pipeline.named_steps["quality"].get_feature_names_out()
    names = pipeline.named_steps["imputer"].get_feature_names_out(quality_names)
    return [str(name) for name in names]
