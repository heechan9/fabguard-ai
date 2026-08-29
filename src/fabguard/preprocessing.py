"""Train-fitted feature quality filtering for leakage-safe SECOM pipelines."""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin


class TrainColumnFilter(BaseEstimator, TransformerMixin):
    def __init__(self, missing_threshold: float = 0.50):
        self.missing_threshold = missing_threshold

    def fit(self, X: pd.DataFrame, y: object = None) -> "TrainColumnFilter":
        frame = self._to_frame(X)
        missing = frame.isna().mean()
        unique = frame.nunique(dropna=True)
        eligible = frame.loc[:, (missing <= self.missing_threshold) & (unique > 1)]
        duplicate_mask = eligible.T.duplicated(keep="first")
        self.feature_names_in_ = np.asarray(frame.columns, dtype=object)
        self.high_missing_columns_ = missing.index[missing > self.missing_threshold].tolist()
        self.uninformative_columns_ = unique.index[unique <= 1].tolist()
        self.duplicate_columns_ = eligible.columns[duplicate_mask].tolist()
        self.selected_columns_ = eligible.columns[~duplicate_mask].tolist()
        if not self.selected_columns_:
            raise ValueError("No usable features remain after train-fitted filtering")
        return self

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        frame = self._to_frame(X)
        missing = [column for column in self.selected_columns_ if column not in frame]
        if missing:
            raise ValueError(f"Missing fitted columns during transform: {missing[:5]}")
        return frame.loc[:, self.selected_columns_].copy()

    def get_feature_names_out(self, input_features: object = None) -> np.ndarray:
        return np.asarray(self.selected_columns_, dtype=object)

    @staticmethod
    def _to_frame(X: pd.DataFrame) -> pd.DataFrame:
        if not isinstance(X, pd.DataFrame):
            raise TypeError("TrainColumnFilter requires a pandas DataFrame with stable feature names")
        return X

