"""Operational validation core for a future Fledge filter adapter.

This module is runtime-agnostic: it provides isolation, durable deduplication,
lateness checks, simple drift monitoring and alert contracts without importing
Fledge or changing FabGuard's model experiment.
"""

from __future__ import annotations

import json
import math
import os
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from time import perf_counter
from typing import Iterable, Mapping

import numpy as np

from .fledge_contract import FledgeContractError, normalize_fledge_readings


def _utc(value: str | datetime) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00")) if isinstance(value, str) else value
    if parsed.tzinfo is None:
        raise ValueError("timestamp must include a timezone")
    return parsed.astimezone(timezone.utc)


@dataclass(frozen=True)
class OperationsConfig:
    required_measurements: tuple[str, ...] = ()
    max_lateness_seconds: float = 300.0
    max_future_skew_seconds: float = 5.0
    disconnect_after_seconds: float = 120.0
    dedupe_retention_seconds: float = 86_400.0
    drift_threshold: float = 0.2
    drift_bins: int = 10
    drift_min_samples: int = 5


class StateStoreError(RuntimeError):
    """Raised when durable local state cannot be trusted or exclusively updated."""


class JsonStateStore:
    """Small single-writer state store used to verify local restart behavior."""

    def __init__(self, path: Path):
        self.path = path
        self.lock_path = path.with_suffix(path.suffix + ".lock")

    def load(self) -> dict[str, object]:
        if not self.path.exists():
            return {"seen": {}, "last_seen": {}, "disconnect_alerted": []}
        try:
            state = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise StateStoreError(f"state file is unreadable or corrupt: {self.path}") from error
        if not isinstance(state, dict):
            raise StateStoreError("state root must be a JSON object")
        return state

    @contextmanager
    def exclusive(self):
        """Fail fast when another local process owns this single-writer store."""

        self.path.parent.mkdir(parents=True, exist_ok=True)
        try:
            descriptor = os.open(self.lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        except FileExistsError as error:
            raise StateStoreError(f"state store is already locked: {self.lock_path}") from error
        try:
            os.write(descriptor, str(os.getpid()).encode("ascii"))
            os.fsync(descriptor)
            yield
        finally:
            os.close(descriptor)
            self.lock_path.unlink(missing_ok=True)

    def save(self, state: Mapping[str, object]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.path.with_suffix(self.path.suffix + ".tmp")
        payload = json.dumps(state, sort_keys=True, indent=2, allow_nan=False)
        with temporary.open("w", encoding="utf-8") as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, self.path)


def population_stability_index(
    reference: Iterable[float],
    current: Iterable[float],
    *,
    bins: int = 10,
    min_samples: int = 5,
) -> float | None:
    """Return PSI on finite values using reference-derived quantile boundaries."""

    ref = np.asarray(list(reference), dtype=float)
    cur = np.asarray(list(current), dtype=float)
    ref, cur = ref[np.isfinite(ref)], cur[np.isfinite(cur)]
    if ref.size < min_samples or cur.size < min_samples:
        return None
    if np.ptp(ref) == 0:
        return 0.0 if np.allclose(cur, ref[0]) else float(math.log(1_000_000))
    edges = np.unique(np.quantile(ref, np.linspace(0, 1, bins + 1)))
    if edges.size < 2:
        return None
    edges[0], edges[-1] = -np.inf, np.inf
    ref_count, _ = np.histogram(ref, bins=edges)
    cur_count, _ = np.histogram(cur, bins=edges)
    epsilon = 1e-6
    ref_share = np.clip(ref_count / ref_count.sum(), epsilon, None)
    cur_share = np.clip(cur_count / cur_count.sum(), epsilon, None)
    return float(np.sum((cur_share - ref_share) * np.log(cur_share / ref_share)))


class FledgeOperationsProcessor:
    """Process readings independently so one invalid record cannot stop a batch."""

    def __init__(self, config: OperationsConfig, state_store: JsonStateStore):
        if config.max_lateness_seconds < 0 or config.max_future_skew_seconds < 0:
            raise ValueError("lateness and future-skew limits must be non-negative")
        if config.disconnect_after_seconds < 0 or config.dedupe_retention_seconds <= 0:
            raise ValueError("disconnect limit must be non-negative and retention must be positive")
        if config.drift_bins < 2 or config.drift_min_samples < 2:
            raise ValueError("drift_bins and drift_min_samples must be at least 2")
        self.config = config
        self.state_store = state_store

    def process_batch(
        self,
        readings: Iterable[Mapping[str, object]],
        *,
        observed_at: str | datetime,
        reference: Mapping[str, Iterable[float]] | None = None,
    ) -> dict[str, object]:
        with self.state_store.exclusive():
            return self._process_locked(readings, observed_at=observed_at, reference=reference)

    def _process_locked(
        self,
        readings: Iterable[Mapping[str, object]],
        *,
        observed_at: str | datetime,
        reference: Mapping[str, Iterable[float]] | None,
    ) -> dict[str, object]:
        started = perf_counter()
        observed = _utc(observed_at)
        accepted: list[dict[str, object]] = []
        dead_letters: list[dict[str, object]] = []
        alerts: list[dict[str, object]] = []
        state = self.state_store.load()
        raw_seen = state.get("seen", {})
        if not isinstance(raw_seen, dict):
            raise StateStoreError("state.seen must be an object")
        try:
            seen = {
                str(sample_id): str(timestamp)
                for sample_id, timestamp in raw_seen.items()
                if (observed - _utc(str(timestamp))).total_seconds()
                <= self.config.dedupe_retention_seconds
            }
            raw_last_seen = state.get("last_seen", {})
            raw_alerted = state.get("disconnect_alerted", [])
            if not isinstance(raw_last_seen, dict) or not isinstance(raw_alerted, list):
                raise TypeError("state fields have invalid types")
            last_seen = {str(asset): _utc(str(timestamp)).isoformat() for asset, timestamp in raw_last_seen.items()}
            disconnect_alerted = {str(asset) for asset in raw_alerted}
        except (TypeError, ValueError) as error:
            raise StateStoreError("state contains invalid deduplication or last-seen values") from error

        for index, reading in enumerate(readings):
            try:
                frame = normalize_fledge_readings(
                    [reading], required_measurements=self.config.required_measurements
                )
                row = frame.iloc[0]
                sample_id = str(row["sample_id"])
                if sample_id in seen:
                    raise FledgeContractError("duplicate reading already processed")
                event_time = row["event_time"].to_pydatetime()
                lateness = (observed - event_time).total_seconds()
                if lateness < -self.config.max_future_skew_seconds:
                    raise FledgeContractError(
                        f"reading is {-lateness:.3f}s in the future; clock-skew limit is "
                        f"{self.config.max_future_skew_seconds:.3f}s"
                    )
                if lateness > self.config.max_lateness_seconds:
                    raise FledgeContractError(
                        f"reading is late by {lateness:.3f}s; limit is {self.config.max_lateness_seconds:.3f}s"
                    )
                record = row.to_dict()
                record["event_time"] = event_time.isoformat()
                accepted.append(record)
                seen[sample_id] = event_time.isoformat()
                last_seen[str(row["asset_code"])] = event_time.isoformat()
                disconnect_alerted.discard(str(row["asset_code"]))
            except (FledgeContractError, ValueError, TypeError) as error:
                raw = dict(reading) if isinstance(reading, Mapping) else repr(reading)
                dead_letters.append({"index": index, "reason": str(error), "reading": raw})

        for asset_code, timestamp in last_seen.items():
            gap = (observed - _utc(str(timestamp))).total_seconds()
            if gap > self.config.disconnect_after_seconds:
                if asset_code not in disconnect_alerted:
                    alerts.append(
                        {
                            "type": "asset_disconnect",
                            "asset_code": asset_code,
                            "gap_seconds": gap,
                            "observed_at": observed.isoformat(),
                        }
                    )
                    disconnect_alerted.add(asset_code)

        drift: dict[str, float] = {}
        if reference and accepted:
            for name, values in reference.items():
                column = f"measurement__{name}"
                current = [item[column] for item in accepted if item.get(column) is not None]
                score = population_stability_index(
                    values,
                    current,
                    bins=self.config.drift_bins,
                    min_samples=self.config.drift_min_samples,
                )
                if score is None:
                    alerts.append(
                        {
                            "type": "drift_evidence_insufficient",
                            "measurement": name,
                            "minimum_samples": self.config.drift_min_samples,
                            "current_samples": len(current),
                        }
                    )
                    continue
                drift[name] = score
                if score >= self.config.drift_threshold:
                    alerts.append(
                        {"type": "distribution_drift", "measurement": name, "psi": score}
                    )

        persisted = {
            "seen": dict(sorted(seen.items())),
            "last_seen": last_seen,
            "disconnect_alerted": sorted(disconnect_alerted),
        }
        self.state_store.save(persisted)
        elapsed = max(perf_counter() - started, 1e-12)
        return {
            "status": "local_operational_validation",
            "input_count": len(accepted) + len(dead_letters),
            "accepted_count": len(accepted),
            "dead_letter_count": len(dead_letters),
            "accepted": accepted,
            "dead_letters": dead_letters,
            "alerts": alerts,
            "drift": drift,
            "elapsed_seconds": elapsed,
            "throughput_readings_per_second": (len(accepted) + len(dead_letters)) / elapsed,
            "claim_boundary": "Local operational harness; not execution inside Fledge or field validation.",
        }
