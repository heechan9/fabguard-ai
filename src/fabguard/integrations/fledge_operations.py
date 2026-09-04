"""Operational validation core for a future Fledge filter adapter.

This module is runtime-agnostic: it provides isolation, durable deduplication,
lateness checks, simple drift monitoring and alert contracts without importing
Fledge or changing FabGuard's model experiment.
"""

from __future__ import annotations

import json
import math
import os
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
    disconnect_after_seconds: float = 120.0
    drift_threshold: float = 0.2
    drift_bins: int = 10


class JsonStateStore:
    """Small atomic state store used to verify restart behavior locally."""

    def __init__(self, path: Path):
        self.path = path

    def load(self) -> dict[str, object]:
        if not self.path.exists():
            return {"seen": [], "last_seen": {}}
        return json.loads(self.path.read_text(encoding="utf-8"))

    def save(self, state: Mapping[str, object]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.path.with_suffix(self.path.suffix + ".tmp")
        temporary.write_text(json.dumps(state, sort_keys=True, indent=2), encoding="utf-8")
        os.replace(temporary, self.path)


def population_stability_index(
    reference: Iterable[float], current: Iterable[float], *, bins: int = 10
) -> float:
    """Return PSI on finite values using reference-derived quantile boundaries."""

    ref = np.asarray(list(reference), dtype=float)
    cur = np.asarray(list(current), dtype=float)
    ref, cur = ref[np.isfinite(ref)], cur[np.isfinite(cur)]
    if ref.size < 2 or cur.size < 1:
        return 0.0
    edges = np.unique(np.quantile(ref, np.linspace(0, 1, bins + 1)))
    if edges.size < 2:
        return 0.0
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
        self.config = config
        self.state_store = state_store
        self.state = state_store.load()

    def process_batch(
        self,
        readings: Iterable[Mapping[str, object]],
        *,
        observed_at: str | datetime,
        reference: Mapping[str, Iterable[float]] | None = None,
    ) -> dict[str, object]:
        started = perf_counter()
        observed = _utc(observed_at)
        accepted: list[dict[str, object]] = []
        dead_letters: list[dict[str, object]] = []
        alerts: list[dict[str, object]] = []
        seen = set(self.state.get("seen", []))
        last_seen = dict(self.state.get("last_seen", {}))

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
                if lateness > self.config.max_lateness_seconds:
                    raise FledgeContractError(
                        f"reading is late by {lateness:.3f}s; limit is {self.config.max_lateness_seconds:.3f}s"
                    )
                record = row.to_dict()
                record["event_time"] = event_time.isoformat()
                accepted.append(record)
                seen.add(sample_id)
                last_seen[str(row["asset_code"])] = event_time.isoformat()
            except (FledgeContractError, ValueError, TypeError) as error:
                raw = dict(reading) if isinstance(reading, Mapping) else repr(reading)
                dead_letters.append({"index": index, "reason": str(error), "reading": raw})

        for asset_code, timestamp in last_seen.items():
            gap = (observed - _utc(str(timestamp))).total_seconds()
            if gap > self.config.disconnect_after_seconds:
                alerts.append(
                    {
                        "type": "asset_disconnect",
                        "asset_code": asset_code,
                        "gap_seconds": gap,
                        "observed_at": observed.isoformat(),
                    }
                )

        drift: dict[str, float] = {}
        if reference and accepted:
            for name, values in reference.items():
                column = f"measurement__{name}"
                current = [item[column] for item in accepted if item.get(column) is not None]
                score = population_stability_index(values, current, bins=self.config.drift_bins)
                drift[name] = score
                if score >= self.config.drift_threshold:
                    alerts.append(
                        {"type": "distribution_drift", "measurement": name, "psi": score}
                    )

        self.state = {"seen": sorted(seen), "last_seen": last_seen}
        self.state_store.save(self.state)
        elapsed = perf_counter() - started
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
            "throughput_readings_per_second": (
                (len(accepted) + len(dead_letters)) / elapsed if elapsed else math.inf
            ),
            "claim_boundary": "Local operational harness; not execution inside Fledge or field validation.",
        }
