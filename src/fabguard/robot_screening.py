"""Label-free feature-contract checks, not a robot classifier or scoring API.

No model is loaded, fitted or scored. A passing contract is not a normal/safe
verdict, nor evidence of raw sensor quality or synchronization.
"""

from __future__ import annotations

import hashlib
import json
import math
from collections import Counter
from collections.abc import Mapping
from numbers import Real

CHANNELS = (
    "imp23absu_mic_MIC", "ism330dhcx_acc_Ax", "ism330dhcx_acc_Ay",
    "ism330dhcx_acc_Az", "ism330dhcx_gyro_Gx", "ism330dhcx_gyro_Gy",
    "ism330dhcx_gyro_Gz",
)
STATISTICS = ("mean", "std", "rms", "abs_p95", "diff_rms", "valid_fraction")
FEATURE_COLUMNS = tuple(f"{channel}_{stat}" for channel in CHANNELS for stat in STATISTICS)
METADATA = ("segment_id", "domain_shift_op", "domain_shift_env")
OPERATIONS = ("weight00", "weight10", "weight15", "weight20", "weight25", "weight30", "weight35")
ENVIRONMENTS = tuple(f"Bckg{x}" for x in "ABCDEFG")
PROTOCOLS = ("published_split", "disjoint_recording_groups")
CLAIM_BOUNDARY = "Feature-contract checks only; no robot diagnosis, safety verdict, score or control."


def _sha(value: object) -> bool:
    return isinstance(value, str) and len(value) == 64 and all(c in "0123456789abcdef" for c in value)


def manifest_digest(manifest: Mapping) -> str:
    """Canonical UTF-8 JSON SHA-256, excluding the manifest_sha256 field only."""
    payload = {key: value for key, value in manifest.items() if key != "manifest_sha256"}
    return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":"),
                                     ensure_ascii=True, allow_nan=False).encode("utf-8")).hexdigest()


def validate_manifest(manifest: object, *, model_sha256: str, feature_csv_sha256: str,
                      protocol: str) -> list[str]:
    """Validate structure and expected binding, not authenticity/training provenance.

    Expected digests must come from independently verified artifacts. This module
    neither supplies them nor treats a self-consistent hash as verification.
    """
    reasons = []
    if not _sha(model_sha256) or not _sha(feature_csv_sha256) or not isinstance(protocol, str) or protocol not in PROTOCOLS:
        reasons.append("invalid_expected_binding")
    if not isinstance(manifest, Mapping):
        return reasons + ["manifest_missing_or_malformed"]
    required = {"schema_version", "model_sha256", "feature_csv_sha256", "protocol",
                "feature_columns", "training_membership", "manifest_sha256"}
    if set(manifest) != required:
        reasons.append("manifest_schema_mismatch")
    if type(manifest.get("schema_version")) is not int or manifest.get("schema_version") != 1:
        reasons.append("manifest_version_mismatch")
    for key, expected in (("model_sha256", model_sha256), ("feature_csv_sha256", feature_csv_sha256)):
        if not _sha(expected) or not _sha(manifest.get(key)) or manifest.get(key) != expected:
            reasons.append(f"{key}_mismatch")
    actual_protocol = manifest.get("protocol")
    if not isinstance(actual_protocol, str) or actual_protocol not in PROTOCOLS or not isinstance(protocol, str) or actual_protocol != protocol:
        reasons.append("protocol_mismatch")
    columns = manifest.get("feature_columns")
    if not isinstance(columns, list) or not all(isinstance(c, str) for c in columns) or columns != list(FEATURE_COLUMNS):
        reasons.append("feature_schema_mismatch")
    try:
        if not _sha(manifest.get("manifest_sha256")) or manifest_digest(manifest) != manifest.get("manifest_sha256"):
            reasons.append("manifest_digest_mismatch")
    except (TypeError, ValueError, OverflowError, RecursionError):
        reasons.append("manifest_not_canonical_json")
    members = manifest.get("training_membership")
    if not isinstance(members, list) or not members:
        reasons.append("training_membership_missing_or_malformed")
    else:
        ids = set()
        for member in members:
            if not isinstance(member, dict) or set(member) != {*METADATA, "recording_group"}:
                reasons.append("training_member_schema_mismatch")
                continue
            sid, group = member["segment_id"], member["recording_group"]
            if not isinstance(sid, str) or not sid.strip() or not isinstance(group, str) or not group.strip():
                reasons.append("training_member_identity_invalid")
            elif sid in ids:
                reasons.append("training_member_duplicate")
            else:
                ids.add(sid)
            if (not isinstance(member["domain_shift_op"], str) or member["domain_shift_op"] not in OPERATIONS
                    or not isinstance(member["domain_shift_env"], str) or member["domain_shift_env"] not in ENVIRONMENTS):
                reasons.append("training_member_condition_invalid")
    return list(dict.fromkeys(reasons))


def _condition(row: Mapping, manifest: object, manifest_reasons: list[str]) -> tuple[str, list[str]]:
    reasons = []
    missing = False
    unknown = False
    for key, vocabulary in (("domain_shift_op", OPERATIONS), ("domain_shift_env", ENVIRONMENTS)):
        value = row.get(key)
        if value is None or (isinstance(value, str) and not value.strip()):
            missing = True
            reasons.append(f"{key}:missing")
        elif not isinstance(value, str) or value not in vocabulary:
            unknown = True
            reasons.append(f"{key}:unknown_value")
    if missing or unknown:
        return ("missing" if missing else "unknown_value"), reasons
    if manifest_reasons:
        return "not_evaluated", ["condition_manifest_unavailable"]
    pair = (row["domain_shift_op"], row["domain_shift_env"])
    pairs = {(member["domain_shift_op"], member["domain_shift_env"])
             for member in manifest["training_membership"]}
    if pair not in pairs:
        return "known_untrained", ["condition_not_seen_in_training"]
    return "seen_in_training", []


def assess_features(row: object, manifest: object = None, *, model_sha256: str = "",
                    feature_csv_sha256: str = "", protocol: str = "") -> dict:
    """Check one ordered mapping of metadata plus 42 numeric features.

    Inputs are already-extracted summaries, not raw sensor files. All seven
    valid fractions must equal one: conservative withholding, not a learned
    quality threshold. Independent input, manifest and condition reasons survive.
    """
    manifest_reasons = validate_manifest(manifest, model_sha256=model_sha256,
                                        feature_csv_sha256=feature_csv_sha256, protocol=protocol)
    input_reasons = []
    fractions = {}
    if not isinstance(row, Mapping):
        input_reasons.append("row_not_mapping")
        condition_status, condition_reasons = "not_evaluated", ["row_unavailable"]
        sid = None
    else:
        sid = row.get("segment_id")
        if not isinstance(sid, str) or not sid.strip():
            input_reasons.append("segment_id_invalid")
            sid = None
        if any(key not in (*METADATA, *FEATURE_COLUMNS) for key in row):
            input_reasons.append("unexpected_columns")
        # Metadata order is irrelevant; feature order is part of the model contract.
        present = tuple(key for key in row if key in FEATURE_COLUMNS)
        if present != FEATURE_COLUMNS:
            input_reasons.append("feature_columns_missing_or_reordered")
        for column in FEATURE_COLUMNS:
            if column not in row:
                input_reasons.append(f"{column}:missing")
                continue
            value = row[column]
            if isinstance(value, bool) or not isinstance(value, Real):
                input_reasons.append(f"{column}:not_numeric")
                continue
            try:
                finite = math.isfinite(value)
            except (OverflowError, TypeError, ValueError):
                finite = False
            if not finite:
                input_reasons.append(f"{column}:nonfinite")
                continue
            if column.endswith("_valid_fraction"):
                if not 0 <= value <= 1:
                    input_reasons.append(f"{column}:out_of_range")
                else:
                    fractions[column] = float(value)
                    if value < 1:
                        input_reasons.append(f"{column}:incomplete_channel")
            elif not column.endswith("_mean") and value < 0:
                input_reasons.append(f"{column}:out_of_range")
        condition_status, condition_reasons = _condition(row, manifest, manifest_reasons)
    passed = not input_reasons and not manifest_reasons and condition_status == "seen_in_training"
    return {
        "segment_id": sid,
        "input_status": "invalid" if input_reasons else "feature_contract_passed",
        "input_reasons": input_reasons,
        "valid_fractions": fractions,
        "raw_sensor_quality": "not_evaluated",
        "time_sync": "not_verifiable",
        "manifest_status": "invalid" if manifest_reasons else "binding_consistent_not_authenticated",
        "manifest_reasons": manifest_reasons,
        "condition_status": condition_status,
        "condition_reasons": condition_reasons,
        "gate_status": "passed" if passed else "withheld",
        "overall_status": "abstain",
        "overall_reasons": list(dict.fromkeys(input_reasons + manifest_reasons + condition_reasons
                                               + ["scoring_not_implemented"])),
        "score": None,
        "batch_rank": None,
        "claim_boundary": CLAIM_BOUNDARY,
    }


def assess_batch(rows: list, manifest: object = None, **binding) -> list[dict]:
    """Assess a nonempty batch, withholding every occurrence of duplicate IDs."""
    if not isinstance(rows, list) or not rows:
        raise ValueError("inspection batch must be a nonempty list")
    reports = [assess_features(row, manifest, **binding) for row in rows]
    counts = Counter(report["segment_id"] for report in reports if report["segment_id"] is not None)
    for report in reports:
        if counts[report["segment_id"]] > 1:
            report["input_status"] = "invalid"
            report["gate_status"] = "withheld"
            report["input_reasons"].append("duplicate_segment_id")
            report["overall_reasons"].append("duplicate_segment_id")
    return reports
