"""Offline 50 ms robot-window SPC protocol: exploratory alarm activity only.

This module windows one acceleration file at a time, fits a centre/scale on
reference-role windows, chooses thresholds on calibration-role windows from a
frozen grid, and reports Shewhart / EWMA / two-sided CUSUM alarm activity on
evaluation-role windows. It never reads onset labels and never reports
detection delay, recall, miss rate or a false-alarm rate. A completed run is
``exploratory_alarm_activity_only``; it is not a performance, safety, stability
or root-cause result. Nothing here controls equipment.
"""

from __future__ import annotations

import bisect
import hashlib
import importlib.util
import json
import math
import statistics
from collections import Counter
from collections.abc import Mapping
from decimal import Decimal, InvalidOperation
from fractions import Fraction
from pathlib import Path

ROLES = ("reference", "calibration", "evaluation")
METHODS = ("shewhart", "ewma", "cusum")
RMS_MODES = ("axis_x", "axis_y", "axis_z", "vector")
STABILITY_CATEGORIES = ("operating_context", "trend", "distribution", "autocorrelation", "motion_cycle")
CONFIG_KEYS = {
    "schema_version", "window_s", "boundary", "anchor", "rms_mode", "dc_handling", "time_unit",
    "value_unit", "axes", "nominal_period_s", "cadence_rel_tolerance", "gap_factor", "min_samples",
    "min_reference_windows", "ewma_lambda", "cusum_k", "reset_after_alarm", "grids",
    "max_raw_alarm_fraction",
}
FILE_KEYS = {"file_id", "recording_group", "role", "source_sha256", "condition"}
# Timestamps within 1 ns of a window boundary (but not on it) are assigned by
# their exact stored binary value; they are counted so the sensitivity is visible.
NEAR_BOUNDARY_S = Fraction(1, 10**9)
# Declared numeric guards (not sensor specifications). Any sample with |value| above
# MAX_ABS_SAMPLE_G makes its window not evaluable before squaring, so RMS, centre,
# scale and detector statistics stay finite. A reference scale below
# MIN_REFERENCE_SCALE_G is rejected instead of producing unbounded z-scores.
MAX_ABS_SAMPLE_G = 1e6
# Largest number of complete windows one file may span. Indices and counts above this
# are not exact in IEEE doubles (JSON/JS consumers), so such files are rejected as
# invalid instead of being reported with approximate indices. Same limit as the browser port.
MAX_WINDOWS_PER_FILE = 2**53 - 1
MIN_REFERENCE_SCALE_G = 1e-9
NOTES = (
    "condition_labels_do_not_establish_motion_speed_or_session_equivalence",
    "windows_are_not_independent_sessions",
    "equal_calibration_cap_is_not_equal_false_alarm_rate_or_arl",
    "raw_alarms_and_episodes_are_counted_separately",
    "alarm_activity_is_not_false_alarm_rate_without_established_stable_normal_reference",
    "no_onset_or_end_labels_so_delay_recall_miss_not_evaluable",
    "synthetic_or_window_counts_are_not_latency_in_seconds_of_a_real_system",
    "no_causal_capability_yield_or_economic_claim",
    "source_sha256_proves_bytes_only_not_provenance_or_trusted_decoding",
    "separate_from_model_artifact_binding",
)


class RobotDependencyError(ImportError):
    """The optional ``robot`` extra (pyarrow) is required for Parquet decoding."""


def parquet_engine_available() -> bool:
    """True when the declared optional engine (pyarrow, from ``fabguard-ai[robot]``) is importable."""
    return importlib.util.find_spec("pyarrow") is not None


def _require_parquet_engine() -> None:
    if not parquet_engine_available():
        raise RobotDependencyError(
            "Parquet decoding needs the optional robot extra: pip install 'fabguard-ai[robot]' (pyarrow). "
            "CSV decoding and all window/detector logic work without it.")


class ProtocolFailure(Exception):
    """A predeclared failure state. Never caught and reported as success."""


def _canonical(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True,
                      allow_nan=False).encode("utf-8")


def config_digest(config: Mapping) -> str:
    return hashlib.sha256(_canonical(dict(config))).hexdigest()


def _decimal_string(value: object) -> Fraction | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = Decimal(value)
    except InvalidOperation:
        return None
    if not parsed.is_finite() or parsed <= 0:
        return None
    return Fraction(parsed)


def _finite_number(value: object) -> bool:
    return type(value) in (int, float) and math.isfinite(value)


def validate_config(config: object) -> list[str]:
    if not isinstance(config, Mapping):
        return ["config_not_mapping"]
    reasons = []
    if set(config) != CONFIG_KEYS:
        reasons.append("config_schema_mismatch")
    if config.get("schema_version") != 1:
        reasons.append("config_version_mismatch")
    if _decimal_string(config.get("window_s")) is None:
        reasons.append("window_s_must_be_decimal_string")
    if _decimal_string(config.get("nominal_period_s")) is None:
        reasons.append("nominal_period_s_must_be_decimal_string")
    if config.get("boundary") != "left_closed_right_open":
        reasons.append("boundary_unsupported")
    if config.get("anchor") != "file_first_timestamp":
        reasons.append("anchor_unsupported")
    if config.get("rms_mode") not in RMS_MODES:
        reasons.append("rms_mode_unsupported")
    if config.get("dc_handling") != "none":
        reasons.append("dc_handling_unsupported")
    if config.get("time_unit") != "s":
        reasons.append("time_unit_unsupported")
    if config.get("value_unit") != "g":
        reasons.append("value_unit_unsupported")
    axes = config.get("axes")
    if not isinstance(axes, list) or len(axes) != 3 or not all(isinstance(a, str) and a for a in axes):
        reasons.append("axes_invalid")
    tol = config.get("cadence_rel_tolerance")
    if not _finite_number(tol) or not 0 < tol <= 1:
        reasons.append("cadence_rel_tolerance_invalid")
    gap = config.get("gap_factor")
    if not _finite_number(gap) or gap <= 1:
        reasons.append("gap_factor_invalid")
    for key, low in (("min_samples", 1), ("min_reference_windows", 2)):
        if type(config.get(key)) is not int or config.get(key) < low:
            reasons.append(f"{key}_invalid")
    lam = config.get("ewma_lambda")
    if not _finite_number(lam) or not 0 < lam <= 1:
        reasons.append("ewma_lambda_invalid")
    k = config.get("cusum_k")
    if not _finite_number(k) or k < 0:
        reasons.append("cusum_k_invalid")
    if type(config.get("reset_after_alarm")) is not bool:
        reasons.append("reset_after_alarm_must_be_declared_bool")
    grids = config.get("grids")
    if not isinstance(grids, Mapping) or set(grids) != set(METHODS):
        reasons.append("grids_invalid")
    else:
        for method in METHODS:
            grid = grids[method]
            if (not isinstance(grid, list) or not grid or not all(_finite_number(t) and t > 0 for t in grid)
                    or any(b <= a for a, b in zip(grid, grid[1:]))):
                reasons.append(f"grid_invalid:{method}")
    budget = config.get("max_raw_alarm_fraction")
    if not _finite_number(budget) or not 0 <= budget < 1:
        reasons.append("max_raw_alarm_fraction_invalid")
    window = _decimal_string(config.get("window_s"))
    period = _decimal_string(config.get("nominal_period_s"))
    if window and period and type(config.get("min_samples")) is int and config["min_samples"] > window / period:
        reasons.append("min_samples_exceeds_nominal_window_capacity")
    return reasons


def recording_group_from_id(file_id: str) -> str | None:
    return file_id.rsplit("_dataLog_", 1)[0] if "_dataLog_" in file_id else None


def validate_manifest(manifest: object, config: Mapping) -> list[str]:
    if not isinstance(manifest, Mapping):
        return ["manifest_not_mapping"]
    reasons = []
    if manifest.get("schema_version") != 1:
        reasons.append("manifest_version_mismatch")
    try:
        if manifest.get("config_sha256") != config_digest(config):
            reasons.append("config_sha256_mismatch")
    except (TypeError, ValueError):
        reasons.append("config_not_canonical")
    if manifest.get("protocol_status") not in ("prespecified", "exploratory_posthoc"):
        reasons.append("protocol_status_invalid")
    if manifest.get("holdout_status") not in ("reused_development_data", "custodian_locked_new_data"):
        reasons.append("holdout_status_invalid")
    expected = manifest.get("expected_groups")
    if (not isinstance(expected, Mapping) or set(expected) != set(ROLES)
            or not all(type(expected[r]) is int and expected[r] >= 1 for r in ROLES)):
        reasons.append("expected_groups_invalid")
        expected = None
    files = manifest.get("files")
    if not isinstance(files, list) or not files:
        return reasons + ["files_missing"]
    ids, hashes, group_roles = set(), set(), {}
    for entry in files:
        if not isinstance(entry, Mapping):
            reasons.append("file_entry_not_mapping")
            continue
        extra = set(entry) - FILE_KEYS
        if any(word in key.lower() for key in extra for word in ("onset", "offset", "end_label", "fault_time")):
            reasons.append("onset_labels_not_supported")
        elif extra or set(entry) != FILE_KEYS:
            reasons.append("file_schema_mismatch")
        file_id, group, role = entry.get("file_id"), entry.get("recording_group"), entry.get("role")
        sha = entry.get("source_sha256")
        if not isinstance(file_id, str) or not file_id or file_id in ids:
            reasons.append("file_id_invalid_or_duplicate")
        else:
            ids.add(file_id)
        if not isinstance(group, str) or not group:
            reasons.append("recording_group_invalid")
            continue
        if isinstance(file_id, str):
            derived = recording_group_from_id(file_id)
            if derived is not None and derived != group:
                reasons.append(f"recording_group_mismatch:{file_id}")
        if role not in ROLES:
            reasons.append("role_invalid")
            continue
        if not (isinstance(sha, str) and len(sha) == 64 and all(c in "0123456789abcdef" for c in sha)):
            reasons.append("source_sha256_invalid")
        elif sha in hashes:
            reasons.append("duplicate_source_sha256")
        else:
            hashes.add(sha)
        condition = entry.get("condition")
        if (not isinstance(condition, Mapping) or set(condition) != {"op", "env"}
                or not all(isinstance(v, str) and v for v in condition.values())):
            reasons.append("condition_invalid")
        group_roles.setdefault(group, set()).add(role)
    for group, roles in sorted(group_roles.items()):
        if len(roles) > 1:
            reasons.append(f"recording_group_crosses_roles:{group}")
    if expected:
        for role in ROLES:
            actual = sum(1 for roles in group_roles.values() if roles == {role})
            if actual != expected[role]:
                reasons.append(f"group_count_mismatch:{role}:{actual}!={expected[role]}")
    return list(dict.fromkeys(reasons))


def verify_sources(manifest: Mapping, source_bytes: Mapping[str, bytes]) -> list[str]:
    reasons = []
    for entry in manifest["files"]:
        data = source_bytes.get(entry["file_id"])
        if data is None:
            reasons.append(f"source_missing:{entry['file_id']}")
        elif hashlib.sha256(data).hexdigest() != entry["source_sha256"]:
            reasons.append(f"source_sha256_mismatch:{entry['file_id']}")
    return reasons


def decode_csv_bytes(data: bytes, config: Mapping) -> tuple[list[float], list[list[float]]]:
    """Decode the exact verified bytes of one CSV file (stdlib only).

    Header must be exactly ``Time`` plus the configured axes. Empty, ``nan`` or
    ``inf`` axis cells become NaN (window later not evaluable); any malformed
    number or non-finite time raises ``ValueError``.
    """
    import csv
    import io
    import re

    try:
        text = data.decode("utf-8-sig", errors="strict")
    except UnicodeDecodeError as error:
        raise ValueError("csv_not_utf8") from error
    rows = list(csv.reader(io.StringIO(text)))
    if not rows or rows[0] != ["Time", *config["axes"]]:
        raise ValueError("column_schema_mismatch")
    number = re.compile(r"[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?")
    missing = {"", "nan", "NaN", "NAN", "inf", "-inf", "+inf", "Inf", "INF", "Infinity", "-Infinity"}
    times: list[float] = []
    axes: list[list[float]] = [[], [], []]
    for line, row in enumerate(rows[1:], 2):
        if not any(cell.strip() for cell in row):
            continue
        if len(row) != 4:
            raise ValueError(f"row_shape_invalid:{line}")
        cells = [cell.strip() for cell in row]
        if not number.fullmatch(cells[0]):
            raise ValueError(f"time_nonfinite_or_nonnumeric:{line}")
        times.append(float(cells[0]))
        for a, cell in enumerate(cells[1:]):
            if number.fullmatch(cell):
                axes[a].append(float(cell))
            elif cell in missing:
                axes[a].append(float("nan"))
            else:
                raise ValueError(f"value_nonnumeric:{line}")
    return times, axes


def decode_parquet_bytes(data: bytes, config: Mapping) -> tuple[list[float], list[list[float]]]:
    """Decode the exact verified bytes of one Parquet file. Requires the ``robot`` extra."""
    _require_parquet_engine()
    import io

    import pandas as pd

    frame = pd.read_parquet(io.BytesIO(data))
    if set(frame.columns) != {"Time", *config["axes"]}:
        raise ValueError("column_schema_mismatch")
    times = frame["Time"].to_numpy(dtype=float).tolist()
    return times, [frame[axis].to_numpy(dtype=float).tolist() for axis in config["axes"]]


DECODERS = {"csv": decode_csv_bytes, "parquet": decode_parquet_bytes}


def load_axes_parquet(path: Path, config: Mapping) -> tuple[list[float], list[list[float]]]:
    """Read one Parquet file once and decode those same bytes (engine checked before reading)."""
    _require_parquet_engine()
    return decode_parquet_bytes(Path(path).read_bytes(), config)


def _invalid_file(reasons: list) -> dict:
    return {"file_status": "invalid", "file_reasons": reasons, "windows": [], "empty_window_runs": [],
            "windows_complete": 0, "partial_tail": None, "n_gaps": 0, "near_boundary_samples": 0,
            "duration_total_s": None}


def _merge_ranges(ranges: list) -> list:
    merged: list[list[int]] = []
    for first, last in sorted(ranges):
        if merged and first <= merged[-1][1] + 1:
            merged[-1][1] = max(merged[-1][1], last)
        else:
            merged.append([first, last])
    return merged


def _split_by_ranges(first: int, last: int, ranges: list, starts: list) -> list:
    """Split [first, last] into (start, end, in_gap) pieces using merged gap ranges."""
    pieces, cursor = [], first
    start = max(bisect.bisect_right(starts, first) - 1, 0)
    for lo, hi in ranges[start:]:
        if lo > last:
            break
        if hi < cursor:
            continue
        if lo > cursor:
            pieces.append((cursor, lo - 1, False))
        pieces.append((max(lo, cursor), min(hi, last), True))
        cursor = min(hi, last) + 1
        if cursor > last:
            break
    if cursor <= last:
        pieces.append((cursor, last, False))
    return pieces


def window_file(times: list, axes_values: list, config: Mapping) -> dict:
    """Split one file into complete half-open windows anchored at its first timestamp.

    Boundaries use exact rational arithmetic on the stored float timestamps and
    the decimal window width. Samples after the last complete window form the
    partial tail, which is recorded and never scored. Nothing is interpolated,
    sorted, deleted or carried across files.

    Work and memory are proportional to the number of samples and gaps, not to
    the time span: windows that contain no sample are reported as run-length
    ``empty_window_runs`` (each run is not evaluable) instead of one entry per
    window. A sample with magnitude above ``MAX_ABS_SAMPLE_G`` makes its window
    not evaluable (``value_out_of_range``) before any square is computed.
    """
    reasons = []
    n = len(times) if isinstance(times, list) else 0
    if n < 2 or not isinstance(axes_values, list) or len(axes_values) != 3 \
            or any(not isinstance(a, list) or len(a) != n for a in axes_values):
        return _invalid_file(["shape_invalid"])
    if not all(_finite_number(t) for t in times):
        reasons.append("time_nonfinite_or_nonnumeric")
    elif any(b <= a for a, b in zip(times, times[1:])):
        reasons.append("time_not_strictly_increasing")
    period = _decimal_string(config["nominal_period_s"])
    if not reasons:
        median_dt = statistics.median(Fraction(b) - Fraction(a) for a, b in zip(times, times[1:]))
        if abs(median_dt - period) / period > Fraction(config["cadence_rel_tolerance"]):
            reasons.append("cadence_mismatch")
    if reasons:
        return _invalid_file(reasons)

    width = _decimal_string(config["window_s"])
    exact = [Fraction(t) for t in times]
    t0, t_last = exact[0], exact[-1]
    n_complete = math.floor((t_last - t0) / width)
    if n_complete > MAX_WINDOWS_PER_FILE:
        return _invalid_file(["time_span_exceeds_window_index_limit"])
    gap_limit = period * Fraction(config["gap_factor"])
    gap_ranges = []
    for a, b in zip(exact, exact[1:]):
        if b - a > gap_limit:
            gap_ranges.append((math.floor((a + period - t0) / width), math.floor((b - t0) / width)))
    n_gaps = len(gap_ranges)
    gap_ranges = _merge_ranges(gap_ranges)
    starts = [r[0] for r in gap_ranges]

    def in_gap(k: int) -> bool:
        i = bisect.bisect_right(starts, k) - 1
        return i >= 0 and gap_ranges[i][0] <= k <= gap_ranges[i][1]

    groups: list[tuple[int, list[int]]] = []  # only windows that contain samples
    tail = []
    near_boundary = 0
    for i, t in enumerate(exact):
        position = (t - t0) / width
        k = math.floor(position)
        nearest = round(position)
        if position != nearest and abs(position - nearest) * width <= NEAR_BOUNDARY_S:
            near_boundary += 1
        if k >= n_complete:
            tail.append(i)
        elif groups and groups[-1][0] == k:
            groups[-1][1].append(i)
        else:
            groups.append((k, [i]))

    mode = config["rms_mode"]
    windows, empty_runs = [], []

    def add_empty(first: int, last: int) -> None:
        for lo, hi, gap in _split_by_ranges(first, last, gap_ranges, starts):
            why = (["timestamp_gap"] if gap else []) + ["insufficient_samples"]
            empty_runs.append({"first_index": lo, "last_index": hi, "count": hi - lo + 1,
                               "start_s": float(t0 + lo * width), "status": "not_evaluable", "reasons": why})

    previous = -1
    for k, idx in groups:
        if k > previous + 1:
            add_empty(previous + 1, k - 1)
        previous = k
        why = []
        if in_gap(k):
            why.append("timestamp_gap")
        if len(idx) < config["min_samples"]:
            why.append("insufficient_samples")
        if any(not _finite_number(axes_values[a][i]) for i in idx for a in range(3)):
            why.append("nonfinite_value")
        elif any(abs(axes_values[a][i]) > MAX_ABS_SAMPLE_G for i in idx for a in range(3)):
            why.append("value_out_of_range")
        value = None
        if not why:
            if mode == "vector":
                squares = [axes_values[0][i] ** 2 + axes_values[1][i] ** 2 + axes_values[2][i] ** 2 for i in idx]
            else:
                axis = "xyz".index(mode[-1])
                squares = [axes_values[axis][i] ** 2 for i in idx]
            value = math.sqrt(math.fsum(squares) / len(squares))
            if not math.isfinite(value):  # unreachable under MAX_ABS_SAMPLE_G; kept fail-closed
                why.append("value_out_of_range")
                value = None
        windows.append({"window_index": k, "start_s": float(t0 + k * width), "n_samples": len(idx),
                        "status": "not_evaluable" if why else "ok", "reasons": why, "value": value})
    if n_complete > previous + 1:
        add_empty(previous + 1, n_complete - 1)
    tail_start = t0 + n_complete * width
    return {
        "file_status": "valid", "file_reasons": [], "windows": windows, "empty_window_runs": empty_runs,
        "windows_complete": n_complete, "n_gaps": n_gaps, "near_boundary_samples": near_boundary,
        "duration_total_s": float(t_last - t0),
        "partial_tail": {"n_samples": len(tail), "duration_s": float(t_last - tail_start) if tail else 0.0},
    }


class EmptyRun:
    """``count`` consecutive windows with no samples; equivalent to ``count`` Nones."""

    __slots__ = ("first_index", "count")

    def __init__(self, first_index: int, count: int):
        self.first_index, self.count = first_index, count


def run_detector(values: list, center: float, scale: float, method: str, threshold: float,
                 config: Mapping) -> dict:
    """Run one detector over one file's window values.

    Items are a float (evaluable window), ``None`` (one not-evaluable window) or
    ``EmptyRun`` (several empty windows; same effect as that many ``None``).
    State starts at zero for every call, so separate files are never joined.
    Any not-evaluable window resets state; reset after alarm is a declared
    configuration choice. Raw alarms and episodes are counted separately. A
    non-finite statistic raises ``ProtocolFailure`` instead of producing a result.
    """
    if method not in METHODS or not _finite_number(scale) or scale <= 0 or not _finite_number(threshold):
        raise ProtocolFailure("detector_configuration_invalid")
    lam, k = config["ewma_lambda"], config["cusum_k"]
    norm = math.sqrt(lam / (2 - lam))
    e = upper = lower = 0.0
    rows, resets = [], Counter()
    raw = episodes = 0
    in_episode = False
    mask: list[list] = []  # run-length evaluable mask: [[bit, count], ...]

    def mark(bit: str, count: int) -> None:
        if mask and mask[-1][0] == bit:
            mask[-1][1] += count
        else:
            mask.append([bit, count])

    index = 0
    for x in values:
        if x is None or isinstance(x, EmptyRun):
            count = 1 if x is None else x.count
            rows.append({"window_index": index, "window_count": count, "status": "not_evaluable",
                         "statistic": None, "raw_alarm": False})
            e = upper = lower = 0.0
            resets["not_evaluable_window"] += count
            in_episode = False
            mark("0", count)
            index += count
            continue
        z = (x - center) / scale
        if method == "shewhart":
            stat = abs(z)
        elif method == "ewma":
            e = lam * z + (1 - lam) * e
            stat = abs(e) / norm
        else:
            upper = max(0.0, upper + z - k)
            lower = max(0.0, lower - z - k)
            stat = max(upper, lower)
        if not math.isfinite(stat):
            raise ProtocolFailure("detector_statistic_nonfinite")
        alarm = stat > threshold
        rows.append({"window_index": index, "window_count": 1, "status": "alarm" if alarm else "within",
                     "statistic": stat, "raw_alarm": alarm})
        mark("1", 1)
        index += 1
        if alarm:
            raw += 1
            if not in_episode:
                episodes += 1
            in_episode = True
            if config["reset_after_alarm"]:
                e = upper = lower = 0.0
                resets["after_alarm"] += 1
        else:
            in_episode = False
    encoded = ",".join(f"{bit}x{count}" for bit, count in mask)
    return {"rows": rows, "raw_alarms": raw, "episodes": episodes, "resets": dict(resets),
            "evaluable_windows": sum(c for b, c in mask if b == "1"),
            "evaluable_mask_rle_sha256": hashlib.sha256(encoded.encode()).hexdigest()}


def _require_role(files: list, role: str) -> None:
    if not files or any(f.get("role") != role for f in files):
        raise ProtocolFailure(f"role_violation:{role}_only")
    if any(f.get("file_status") != "valid" for f in files):
        raise ProtocolFailure(f"{role}_file_invalid")


def _values(windowed: dict) -> list:
    """Window values in index order; empty runs become one ``EmptyRun`` item each."""
    items = [(w["window_index"], w["value"] if w["status"] == "ok" else None) for w in windowed["windows"]]
    items += [(r["first_index"], EmptyRun(r["first_index"], r["count"])) for r in windowed.get("empty_window_runs", [])]
    return [value for _, value in sorted(items, key=lambda pair: pair[0])]


def fit_reference(files: list, config: Mapping) -> dict:
    _require_role(files, "reference")
    values = [v for f in files for v in _values(f) if isinstance(v, float)]
    if len(values) < config["min_reference_windows"]:
        raise ProtocolFailure("reference_windows_insufficient")
    center, scale = statistics.fmean(values), statistics.stdev(values)
    if not math.isfinite(center) or not math.isfinite(scale) or scale <= 0:
        raise ProtocolFailure("reference_scale_invalid")
    if scale < MIN_REFERENCE_SCALE_G:
        raise ProtocolFailure("reference_scale_below_floor")
    lag1 = None
    if len(values) > 2:
        dev = [v - center for v in values]
        denom = math.fsum(d * d for d in dev)
        lag1 = math.fsum(a * b for a, b in zip(dev, dev[1:])) / denom if denom else None
    return {"center": center, "scale": scale, "n_windows": len(values),
            "files": [f["file_id"] for f in files],
            "descriptive_only": {"lag1_autocorrelation": lag1,
                                 "note": "descriptive; does not establish stability"}}


def calibrate(files: list, center: float, scale: float, config: Mapping) -> dict:
    """Pick the smallest frozen-grid threshold within the raw-alarm budget, per method."""
    _require_role(files, "calibration")
    out = {}
    for method in METHODS:
        grid = list(config["grids"][method])
        tried = []
        chosen = None
        for threshold in grid:
            runs = [run_detector(_values(f), center, scale, method, threshold, config) for f in files]
            alarms = sum(r["raw_alarms"] for r in runs)
            evaluable = sum(r["evaluable_windows"] for r in runs)
            fraction = alarms / evaluable if evaluable else None
            tried.append({"threshold": threshold, "raw_alarms": alarms, "evaluable_windows": evaluable})
            if fraction is not None and fraction <= config["max_raw_alarm_fraction"]:
                chosen = threshold
                break
        out[method] = {"status": "calibrated" if chosen is not None else "calibration_failed",
                       "threshold": chosen, "grid": grid, "tried": tried,
                       "budget_max_raw_alarm_fraction": config["max_raw_alarm_fraction"]}
    return out


def assess_stability(evidence: object) -> dict:
    """Stable-normal status needs documented evidence for every category.

    A single p-value (e.g. p >= .05) is never accepted. Even complete
    annotation is reported as annotation, not as proof.
    """
    if not isinstance(evidence, Mapping):
        return {"status": "stability_unverified", "reasons": ["no_stability_evidence"]}
    reasons = []
    for category in STABILITY_CATEGORIES:
        item = evidence.get(category)
        if not isinstance(item, Mapping):
            reasons.append(f"missing:{category}")
        elif not (item.get("status") == "supported" and isinstance(item.get("basis"), str) and item["basis"]
                  and isinstance(item.get("assessed_by"), str) and item["assessed_by"]):
            reasons.append(f"p_value_only_not_accepted:{category}" if "p_value" in item
                           else f"incomplete:{category}")
    if reasons:
        return {"status": "stability_unverified", "reasons": reasons}
    return {"status": "stability_supported_by_annotation", "reasons": []}


def _evaluate_file(windowed: dict, entry: Mapping, reference: dict, calibration: dict, config: Mapping) -> dict:
    record = {"file_id": entry["file_id"], "recording_group": entry["recording_group"],
              "condition": dict(entry["condition"]), "file_status": windowed["file_status"],
              "file_reasons": windowed["file_reasons"]}
    if windowed["file_status"] != "valid":
        return record
    width = float(_decimal_string(config["window_s"]))
    excluded = Counter(reason for w in windowed["windows"] for reason in w["reasons"])
    for run in windowed.get("empty_window_runs", []):
        for reason in run["reasons"]:
            excluded[reason] += run["count"]
    complete = windowed["windows_complete"]
    evaluable = sum(1 for w in windowed["windows"] if w["status"] == "ok")
    record.update({
        "duration_total_s": windowed["duration_total_s"],
        "duration_evaluable_s": evaluable * width,
        "windows_complete": complete, "windows_evaluable": evaluable,
        "windows_excluded": dict(excluded),
        "exclusion_fraction": (complete - evaluable) / complete if complete else None,
        "partial_tail": windowed["partial_tail"], "n_gaps": windowed["n_gaps"],
        "near_boundary_samples": windowed["near_boundary_samples"],
        "empty_window_runs": len(windowed.get("empty_window_runs", [])), "methods": {},
    })
    for method in METHODS:
        cal = calibration[method]
        if cal["status"] != "calibrated":
            record["methods"][method] = {"status": "unavailable_calibration_failed"}
            continue
        run = run_detector(_values(windowed), reference["center"], reference["scale"], method,
                           cal["threshold"], config)
        record["methods"][method] = {
            "status": "alarm_activity_recorded", "threshold": cal["threshold"],
            "raw_alarms": run["raw_alarms"], "episodes": run["episodes"],
            "any_raw_alarm": run["raw_alarms"] > 0,
            "alarm_activity_per_evaluable_window": run["raw_alarms"] / evaluable if evaluable else None,
            "resets": run["resets"], "evaluable_mask_rle_sha256": run["evaluable_mask_rle_sha256"],
        }
    return record


def run_protocol(manifest: Mapping, config: Mapping, arrays: Mapping, source_bytes: Mapping | None,
                 stability_evidence: object = None) -> dict:
    """Run on caller-supplied decoded arrays.

    ``source_bytes`` hashes are checked, but nothing proves that ``arrays`` were
    decoded from those bytes. The report says so (``input_binding`` and a flag).
    Prefer ``run_protocol_from_bytes``.
    """
    return _run(manifest, config, arrays, source_bytes, stability_evidence,
                binding="caller_supplied_arrays_not_bound_to_source_bytes")


def run_protocol_from_bytes(manifest: Mapping, config: Mapping, source_bytes: Mapping | None,
                            decoder: str, stability_evidence: object = None) -> dict:
    """Verify each file's SHA-256, then decode those exact bytes with a named decoder.

    This binds parsing to the verified bytes. It is not full provenance
    authentication: the decoder (stdlib ``csv`` or pandas/pyarrow) is a trusted
    boundary, and a matching hash only shows the bytes equal the manifest.
    """
    if decoder not in DECODERS:
        raise ValueError(f"decoder must be one of {sorted(DECODERS)}")
    if decoder == "parquet":
        _require_parquet_engine()  # fail before any work, not as per-file decode errors
    return _run(manifest, config, None, source_bytes, stability_evidence,
                binding=f"decoded_from_verified_source_bytes:{decoder}", decoder=DECODERS[decoder])


def _run(manifest: Mapping, config: Mapping, arrays: Mapping | None, source_bytes: Mapping | None,
         stability_evidence: object, binding: str, decoder=None) -> dict:
    """Run the frozen protocol. Every failure state is a terminal, named status."""
    report = {"input_binding": binding,"run_status": None, "reasons": [], "flags": [], "notes": list(NOTES),
              "reference": None, "calibration": None, "evaluation_files": [],
              "independent_units": None,
              "performance": {"detection_delay": None, "anomaly_recall": None, "miss_rate": None,
                              "false_alarm_rate": None,
                              "reason": "no_onset_end_labels_and_stable_normal_not_established"}}

    def stop(status: str, reasons: list) -> dict:
        report.update(run_status=status, reasons=list(reasons))
        return report

    config_reasons = validate_config(config)
    if config_reasons:
        return stop("invalid_config", config_reasons)
    manifest_reasons = validate_manifest(manifest, config)
    if manifest_reasons:
        return stop("invalid_manifest", manifest_reasons)
    report["config_sha256"] = config_digest(config)
    report["manifest_sha256"] = hashlib.sha256(_canonical(dict(manifest))).hexdigest()
    if source_bytes is None:
        return stop("source_verification_failed", ["source_bytes_not_provided"])
    source_reasons = verify_sources(manifest, source_bytes)
    if source_reasons:
        return stop("source_verification_failed", source_reasons)
    if decoder is None:
        missing = [e["file_id"] for e in manifest["files"] if e["file_id"] not in arrays]
        if missing:
            return stop("input_missing", [f"array_missing:{m}" for m in missing])
        report["flags"].append("arrays_not_bound_to_verified_bytes")

    windowed = {}
    for entry in manifest["files"]:
        if decoder is None:
            times, values = arrays[entry["file_id"]]
            result = window_file(times, values, config)
        else:
            try:
                times, values = decoder(source_bytes[entry["file_id"]], config)
                result = window_file(times, values, config)
            except (ValueError, TypeError, OSError, NotImplementedError) as error:
                # Malformed verified bytes make that file invalid. ImportError (missing
                # optional engine) is not caught: it was checked before the run started.
                result = _invalid_file([f"decode_failed:{type(error).__name__}:{error}"[:300]])
        result.update(file_id=entry["file_id"], role=entry["role"], recording_group=entry["recording_group"])
        windowed[entry["file_id"]] = result
    by_role = {role: [windowed[e["file_id"]] for e in manifest["files"] if e["role"] == role] for role in ROLES}
    try:
        reference = fit_reference(by_role["reference"], config)
    except ProtocolFailure as error:
        return stop("reference_invalid", [str(error)])
    report["reference"] = reference
    try:
        calibration = calibrate(by_role["calibration"], reference["center"], reference["scale"], config)
    except ProtocolFailure as error:
        return stop("calibration_failed", [str(error)])
    report["calibration"] = calibration
    failed = [m for m in METHODS if calibration[m]["status"] != "calibrated"]
    if len(failed) == len(METHODS):
        return stop("calibration_failed", [f"calibration_failed:{m}" for m in failed])
    report["flags"].extend(f"calibration_failed:{m}" for m in failed)

    entries = {e["file_id"]: e for e in manifest["files"]}
    try:
        evaluated = [_evaluate_file(result, entries[result["file_id"]], reference, calibration, config)
                     for result in by_role["evaluation"]]
    except ProtocolFailure as error:
        return stop("numeric_failure", [str(error)])
    report["evaluation_files"].extend(evaluated)
    if any(w.get("near_boundary_samples") for w in windowed.values()):
        report["flags"].append("near_boundary_timestamps_present")
    stability = assess_stability(stability_evidence)
    report["stability"] = stability
    report["flags"].append(stability["status"])
    report["flags"].append(manifest["holdout_status"])
    if manifest["protocol_status"] == "exploratory_posthoc":
        report["flags"].append("exploratory_posthoc_reference_selection")
    report["independent_units"] = {
        "evaluation_recording_groups": len({e["recording_group"] for e in manifest["files"]
                                            if e["role"] == "evaluation"}),
        "evaluation_files": len(by_role["evaluation"]),
        "windows_are_independent_sessions": False,
    }
    report["run_status"] = "exploratory_alarm_activity_only"
    return report
