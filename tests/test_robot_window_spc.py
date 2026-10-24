"""Synthetic contract tests for the 50 ms robot-window SPC protocol.

No IMAD archive, Parquet sample, model file, or exposed 464-segment test data is
read. Every series below is generated in the test.
"""

import copy
import hashlib
import json
import math
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from fabguard import robot_window_spc as spc

AXES = ["A_x [g]", "A_y [g]", "A_z [g]"]
PERIOD = 0.001  # synthetic 1 kHz cadence: 50 samples per 50 ms window


def config(**overrides):
    base = {
        "schema_version": 1,
        "window_s": "0.050",
        "boundary": "left_closed_right_open",
        "anchor": "file_first_timestamp",
        "rms_mode": "vector",
        "dc_handling": "none",
        "time_unit": "s",
        "value_unit": "g",
        "axes": list(AXES),
        "nominal_period_s": "0.001",
        "cadence_rel_tolerance": 0.05,
        "gap_factor": 3.0,
        "min_samples": 45,
        "min_reference_windows": 10,
        "ewma_lambda": 0.2,
        "cusum_k": 0.5,
        "reset_after_alarm": False,
        "grids": {"shewhart": [3.0, 4.0, 5.0], "ewma": [3.0, 4.0, 5.0], "cusum": [4.0, 6.0, 8.0]},
        "max_raw_alarm_fraction": 0.05,
    }
    base.update(overrides)
    return base


def series(n, value=1.0, period=PERIOD, start=0.0, wiggle=0.0):
    times = [start + i * period for i in range(n)]
    x = [value + wiggle * math.sin(i) for i in range(n)]
    y = [0.0] * n
    z = [0.0] * n
    return times, [x, y, z]


def file_entry(file_id, group, role, payload=None):
    payload = payload if payload is not None else file_id.encode()
    return {"file_id": file_id, "recording_group": group, "role": role,
            "source_sha256": hashlib.sha256(payload).hexdigest(),
            "condition": {"op": "weight15", "env": "BckgA"}}


def manifest(cfg=None, files=None, status="prespecified"):
    cfg = cfg or config()
    files = files or [
        file_entry("refA_dataLog_1", "refA", "reference"),
        file_entry("calB_dataLog_1", "calB", "calibration"),
        file_entry("evC_dataLog_1", "evC", "evaluation"),
        file_entry("evD_dataLog_1", "evD", "evaluation"),
    ]
    return {"schema_version": 1, "config_sha256": spc.config_digest(cfg),
            "protocol_status": status,
            "holdout_status": "reused_development_data",
            "expected_groups": {"reference": 1, "calibration": 1, "evaluation": 2},
            "files": files}


class ManifestContract(unittest.TestCase):
    def test_valid_manifest_has_no_reasons(self):
        self.assertEqual(spc.validate_manifest(manifest(), config()), [])

    def test_group_crossing_roles_rejected(self):
        files = manifest()["files"]
        files[1] = file_entry("refA_dataLog_2", "refA", "calibration")
        reasons = spc.validate_manifest(manifest(files=files), config())
        self.assertIn("recording_group_crosses_roles:refA", reasons)

    def test_same_source_bytes_in_two_roles_rejected(self):
        files = manifest()["files"]
        files[1] = file_entry("calB_dataLog_1", "calB", "calibration", payload=b"refA_dataLog_1")
        self.assertIn("duplicate_source_sha256", spc.validate_manifest(manifest(files=files), config()))

    def test_group_counts_must_match_frozen_allocation(self):
        files = manifest()["files"][:3]
        self.assertIn("group_count_mismatch:evaluation:1!=2",
                      spc.validate_manifest(manifest(files=files), config()))

    def test_onset_fields_rejected(self):
        m = manifest()
        m["files"][2]["onset_s"] = 1.0
        self.assertIn("onset_labels_not_supported", spc.validate_manifest(m, config()))

    def test_file_id_prefix_must_match_declared_group(self):
        files = manifest()["files"]
        files[2] = file_entry("evX_dataLog_1", "evC", "evaluation")
        self.assertIn("recording_group_mismatch:evX_dataLog_1",
                      spc.validate_manifest(manifest(files=files), config()))

    def test_config_digest_binding(self):
        m = manifest()
        self.assertIn("config_sha256_mismatch", spc.validate_manifest(m, config(min_samples=40)))

    def test_float_window_width_is_boundary_ambiguous(self):
        self.assertIn("window_s_must_be_decimal_string", spc.validate_config(config(window_s=0.05)))

    def test_unsupported_dc_or_boundary_rejected(self):
        reasons = spc.validate_config(config(dc_handling="detrend", boundary="closed"))
        self.assertIn("dc_handling_unsupported", reasons)
        self.assertIn("boundary_unsupported", reasons)

    def test_source_hash_mismatch(self):
        m = manifest()
        good = {f["file_id"]: f["file_id"].encode() for f in m["files"]}
        self.assertEqual(spc.verify_sources(m, good), [])
        bad = dict(good, evC_dataLog_1=b"tampered")
        self.assertEqual(spc.verify_sources(m, bad), ["source_sha256_mismatch:evC_dataLog_1"])
        missing = dict(good)
        del missing["calB_dataLog_1"]
        self.assertEqual(spc.verify_sources(m, missing), ["source_missing:calB_dataLog_1"])


class Windowing(unittest.TestCase):
    def test_boundary_sample_belongs_to_next_window(self):
        # 0.05 is not exact in binary; boundaries use exact rationals.
        times = [0.0, 0.01, 0.049, 0.05, 0.06, 0.1, 0.11]
        cfg = config(nominal_period_s="0.01", min_samples=1, gap_factor=10.0, cadence_rel_tolerance=1.0)
        result = spc.window_file(times, [[1.0] * 7, [0.0] * 7, [0.0] * 7], cfg)
        self.assertEqual(result["file_status"], "valid")
        self.assertEqual([w["n_samples"] for w in result["windows"]], [3, 2])
        self.assertEqual(result["partial_tail"]["n_samples"], 2)

    def test_exact_binary_value_decides_and_near_boundary_is_counted(self):
        # The stored float 0.15 is 0.1499999999999999944..., i.e. below 3/20.
        times = [round(i * 0.01, 2) for i in range(21)]
        n = len(times)
        cfg = config(nominal_period_s="0.01", min_samples=1, gap_factor=10.0)
        result = spc.window_file(times, [[1.0] * n, [0.0] * n, [0.0] * n], cfg)
        self.assertEqual([w["n_samples"] for w in result["windows"]], [5, 5, 6, 4])
        self.assertGreater(result["near_boundary_samples"], 0)

    def test_partial_tail_not_scored_but_recorded(self):
        times, values = series(130)  # 0.000 .. 0.129 s
        result = spc.window_file(times, values, config())
        self.assertEqual(len(result["windows"]), 2)
        self.assertEqual(result["partial_tail"]["n_samples"], 30)
        self.assertAlmostEqual(result["partial_tail"]["duration_s"], 0.029)

    def test_vector_and_axis_rms(self):
        times = [i * PERIOD for i in range(101)]
        x = [3.0] * 101
        y = [4.0] * 101
        z = [0.0] * 101
        vec = spc.window_file(times, [x, y, z], config())["windows"][0]
        self.assertAlmostEqual(vec["value"], 5.0)
        ax = spc.window_file(times, [x, y, z], config(rms_mode="axis_y"))["windows"][0]
        self.assertAlmostEqual(ax["value"], 4.0)

    def test_nonfinite_value_marks_window_not_evaluable(self):
        times, values = series(160)
        values[2][60] = float("nan")
        result = spc.window_file(times, values, config())
        statuses = [w["status"] for w in result["windows"]]
        self.assertEqual(statuses, ["ok", "not_evaluable", "ok"])
        self.assertIn("nonfinite_value", result["windows"][1]["reasons"])
        self.assertIsNone(result["windows"][1]["value"])

    def test_time_reversal_and_duplicate_invalidate_file(self):
        times, values = series(120)
        times[50] = times[49]
        self.assertIn("time_not_strictly_increasing",
                      spc.window_file(times, values, config())["file_reasons"])
        times, values = series(120)
        times[50], times[51] = times[51], times[50]
        self.assertEqual(spc.window_file(times, values, config())["file_status"], "invalid")

    def test_gap_is_flagged_not_interpolated(self):
        times, values = series(300)
        times = times[:100] + [t + 0.02 for t in times[100:]]  # 20 ms hole at 0.1 s
        result = spc.window_file(times, values, config())
        gap_windows = [w for w in result["windows"] if "timestamp_gap" in w["reasons"]]
        self.assertEqual(len(gap_windows), 1)
        self.assertEqual(gap_windows[0]["status"], "not_evaluable")
        self.assertEqual(result["n_gaps"], 1)

    def test_cadence_mismatch_invalidates_file(self):
        times, values = series(200, period=0.002)
        self.assertIn("cadence_mismatch", spc.window_file(times, values, config())["file_reasons"])

    def test_insufficient_samples(self):
        times = [i * PERIOD for i in range(120) if not (10 <= i < 20)]
        n = len(times)
        result = spc.window_file(times, [[1.0] * n, [0.0] * n, [0.0] * n], config(gap_factor=20.0))
        self.assertIn("insufficient_samples", result["windows"][0]["reasons"])


class Detectors(unittest.TestCase):
    def test_ewma_and_cusum_recurrences(self):
        values = [0.0, 2.0, 2.0, -1.0]
        ewma = spc.run_detector(values, 0.0, 1.0, "ewma", 99.0, config())
        e1 = 0.0
        expected = []
        for z in values:
            e1 = 0.2 * z + 0.8 * e1
            expected.append(abs(e1) / math.sqrt(0.2 / 1.8))
        self.assertEqual([round(r["statistic"], 12) for r in ewma["rows"]], [round(v, 12) for v in expected])
        cusum = spc.run_detector(values, 0.0, 1.0, "cusum", 99.0, config())
        self.assertEqual([r["statistic"] for r in cusum["rows"]], [0.0, 1.5, 3.0, 1.5])

    def test_not_evaluable_window_resets_state_and_keeps_index(self):
        out = spc.run_detector([2.0, 2.0, None, 2.0], 0.0, 1.0, "cusum", 99.0, config())
        self.assertEqual([r["window_index"] for r in out["rows"]], [0, 1, 2, 3])
        self.assertEqual(out["rows"][2]["status"], "not_evaluable")
        self.assertEqual(out["rows"][3]["statistic"], 1.5)
        self.assertEqual(out["resets"], {"not_evaluable_window": 1})

    def test_each_file_starts_with_fresh_state(self):
        high = [3.0] * 10
        fresh = spc.run_detector([0.0], 0.0, 1.0, "cusum", 99.0, config())
        spc.run_detector(high, 0.0, 1.0, "cusum", 99.0, config())
        again = spc.run_detector([0.0], 0.0, 1.0, "cusum", 99.0, config())
        self.assertEqual(fresh, again)

    def test_raw_alarms_and_episodes_are_separate(self):
        values = [0, 5, 5, 5, 0, 5, None, 5]
        out = spc.run_detector(values, 0.0, 1.0, "shewhart", 3.0, config())
        self.assertEqual(out["raw_alarms"], 5)
        self.assertEqual(out["episodes"], 3)

    def test_reset_after_alarm_is_a_declared_policy(self):
        out = spc.run_detector([5.0, 0.0], 0.0, 1.0, "cusum", 3.0, config(reset_after_alarm=True))
        self.assertEqual(out["rows"][1]["statistic"], 0.0)
        self.assertEqual(out["resets"], {"after_alarm": 1})
        kept = spc.run_detector([5.0, 0.0], 0.0, 1.0, "cusum", 3.0, config())
        self.assertEqual(kept["rows"][1]["statistic"], 4.0)


def windowed(role, file_id, group, n_windows, value=1.0, wiggle=0.01):
    times, values = series(n_windows * 50 + 1, value=value, wiggle=wiggle)
    result = spc.window_file(times, values, config())
    result.update(file_id=file_id, recording_group=group, role=role)
    return result


class ReferenceAndCalibration(unittest.TestCase):
    def test_zero_variance_reference_rejected(self):
        ref = windowed("reference", "refA_dataLog_1", "refA", 20, wiggle=0.0)
        with self.assertRaisesRegex(spc.ProtocolFailure, "reference_scale_invalid"):
            spc.fit_reference([ref], config())

    def test_too_few_reference_windows(self):
        ref = windowed("reference", "refA_dataLog_1", "refA", 3)
        with self.assertRaisesRegex(spc.ProtocolFailure, "reference_windows_insufficient"):
            spc.fit_reference([ref], config())

    def test_role_guards(self):
        ev = windowed("evaluation", "evC_dataLog_1", "evC", 20)
        with self.assertRaisesRegex(spc.ProtocolFailure, "role_violation"):
            spc.fit_reference([ev], config())
        with self.assertRaisesRegex(spc.ProtocolFailure, "role_violation"):
            spc.calibrate([ev], 1.0, 0.01, config())

    def test_calibration_picks_first_passing_grid_value(self):
        cal = windowed("calibration", "calB_dataLog_1", "calB", 40)
        out = spc.calibrate([cal], 1.0, 0.01, config())
        self.assertEqual(out["shewhart"]["status"], "calibrated")
        self.assertIn(out["shewhart"]["threshold"], config()["grids"]["shewhart"])
        self.assertEqual(out["shewhart"]["grid"], config()["grids"]["shewhart"])

    def test_calibration_failure_is_explicit_and_grid_not_expanded(self):
        cal = windowed("calibration", "calB_dataLog_1", "calB", 40, value=50.0)
        out = spc.calibrate([cal], 1.0, 0.01, config())
        for method in spc.METHODS:
            self.assertEqual(out[method]["status"], "calibration_failed")
            self.assertIsNone(out[method]["threshold"])
            self.assertEqual(out[method]["grid"], config()["grids"][method])


class Stability(unittest.TestCase):
    def test_missing_evidence_is_unverified(self):
        self.assertEqual(spc.assess_stability(None)["status"], "stability_unverified")

    def test_single_p_value_not_accepted(self):
        out = spc.assess_stability({"trend": {"p_value": 0.4}})
        self.assertEqual(out["status"], "stability_unverified")
        self.assertIn("p_value_only_not_accepted:trend", out["reasons"])

    def test_complete_annotation_is_still_annotation(self):
        evidence = {k: {"status": "supported", "basis": "operator log", "assessed_by": "custodian"}
                    for k in spc.STABILITY_CATEGORIES}
        self.assertEqual(spc.assess_stability(evidence)["status"], "stability_supported_by_annotation")


def full_inputs(eval_value=1.0, cal_value=1.0):
    cfg = config()
    m = manifest(cfg)
    arrays = {}
    for f in m["files"]:
        value = {"reference": 1.0, "calibration": cal_value, "evaluation": eval_value}[f["role"]]
        arrays[f["file_id"]] = series(40 * 50 + 1, value=value, wiggle=0.01)
    sources = {f["file_id"]: f["file_id"].encode() for f in m["files"]}
    return cfg, m, arrays, sources


class EndToEnd(unittest.TestCase):
    def test_exploratory_run_reports_activity_not_performance(self):
        cfg, m, arrays, sources = full_inputs()
        report = spc.run_protocol(m, cfg, arrays, sources)
        self.assertEqual(report["run_status"], "exploratory_alarm_activity_only")
        self.assertIn("stability_unverified", report["flags"])
        self.assertNotIn("success", str(report["run_status"]))
        perf = report["performance"]
        for key in ("detection_delay", "anomaly_recall", "miss_rate", "false_alarm_rate"):
            self.assertIsNone(perf[key])
        self.assertEqual(report["independent_units"]["evaluation_recording_groups"], 2)
        self.assertFalse(report["independent_units"]["windows_are_independent_sessions"])
        self.assertIn("reused_development_data", report["flags"])
        self.assertIn("condition_labels_do_not_establish_motion_speed_or_session_equivalence",
                      report["notes"])

    def test_methods_share_window_mask_and_resets(self):
        cfg, m, arrays, sources = full_inputs()
        times, values = arrays["evC_dataLog_1"]
        values[0][500] = float("inf")
        report = spc.run_protocol(m, cfg, arrays, sources)
        per_file = {f["file_id"]: f for f in report["evaluation_files"]}["evC_dataLog_1"]
        masks = {method: per_file["methods"][method]["evaluable_mask_rle_sha256"] for method in spc.METHODS}
        self.assertEqual(len(set(masks.values())), 1)
        self.assertEqual(per_file["windows_excluded"], {"nonfinite_value": 1})

    def test_accounting_denominators(self):
        cfg, m, arrays, sources = full_inputs()
        report = spc.run_protocol(m, cfg, arrays, sources)
        f = report["evaluation_files"][0]
        for key in ("duration_total_s", "duration_evaluable_s", "windows_complete",
                    "windows_evaluable", "exclusion_fraction", "partial_tail"):
            self.assertIn(key, f)
        self.assertIn("any_raw_alarm", f["methods"]["ewma"])
        self.assertIn("alarm_activity_per_evaluable_window", f["methods"]["ewma"])

    def test_source_failure_stops_before_windowing(self):
        cfg, m, arrays, sources = full_inputs()
        sources["refA_dataLog_1"] = b"other"
        report = spc.run_protocol(m, cfg, arrays, sources)
        self.assertEqual(report["run_status"], "source_verification_failed")
        self.assertEqual(report["evaluation_files"], [])

    def test_unverified_sources_are_not_success(self):
        cfg, m, arrays, _ = full_inputs()
        report = spc.run_protocol(m, cfg, arrays, None)
        self.assertEqual(report["run_status"], "source_verification_failed")
        self.assertIn("source_bytes_not_provided", report["reasons"])

    def test_calibration_failure_withholds_evaluation(self):
        cfg, m, arrays, sources = full_inputs(cal_value=50.0)
        report = spc.run_protocol(m, cfg, arrays, sources)
        self.assertEqual(report["run_status"], "calibration_failed")
        self.assertEqual(report["evaluation_files"], [])

    def test_posthoc_reference_is_flagged(self):
        cfg, m, arrays, sources = full_inputs()
        m["protocol_status"] = "exploratory_posthoc"
        report = spc.run_protocol(m, cfg, arrays, sources)
        self.assertIn("exploratory_posthoc_reference_selection", report["flags"])

    def test_evaluation_values_never_change_thresholds(self):
        cfg, m, arrays, sources = full_inputs()
        a = spc.run_protocol(m, cfg, arrays, sources)
        cfg2, m2, arrays2, sources2 = full_inputs(eval_value=9.0)
        b = spc.run_protocol(m2, cfg2, arrays2, sources2)
        self.assertEqual(a["reference"], b["reference"])
        self.assertEqual(a["calibration"], b["calibration"])

    def test_invalid_evaluation_file_reported_not_dropped(self):
        cfg, m, arrays, sources = full_inputs()
        times, values = arrays["evD_dataLog_1"]
        times[10] = times[9]
        report = spc.run_protocol(m, cfg, arrays, sources)
        statuses = {f["file_id"]: f["file_status"] for f in report["evaluation_files"]}
        self.assertEqual(statuses["evD_dataLog_1"], "invalid")
        self.assertEqual(len(report["evaluation_files"]), 2)


class NumericGuardsAndSparseWindows(unittest.TestCase):
    """Regression tests for the two independent-audit must-fix findings (backend v2)."""

    def test_huge_finite_values_fail_closed_without_exception(self):
        for big in (1e200, 1.7e308, -1e200):
            times, values = series(160)
            values[0] = [big] * 160
            result = spc.window_file(times, values, config())
            self.assertEqual(result["file_status"], "valid")
            for w in result["windows"]:
                self.assertEqual(w["status"], "not_evaluable")
                self.assertEqual(w["reasons"], ["value_out_of_range"])
                self.assertIsNone(w["value"])

    def test_range_limit_is_inclusive_and_axis_specific(self):
        times, values = series(60)
        values[0] = [spc.MAX_ABS_SAMPLE_G] * 60
        self.assertEqual(spc.window_file(times, values, config())["windows"][0]["status"], "ok")
        values[2][10] = -spc.MAX_ABS_SAMPLE_G * 1.0000001
        w = spc.window_file(times, values, config(rms_mode="axis_x"))["windows"][0]
        self.assertEqual(w["reasons"], ["value_out_of_range"])  # any axis, even when RMS uses one axis

    def test_out_of_range_reference_and_evaluation_never_succeed_with_nonfinite(self):
        cfg, m, arrays, sources = full_inputs()
        arrays["refA_dataLog_1"][1][0][:] = [1e200] * len(arrays["refA_dataLog_1"][1][0])
        report = spc.run_protocol(m, cfg, arrays, sources)
        self.assertEqual(report["run_status"], "reference_invalid")
        self.assertEqual(report["reasons"], ["reference_windows_insufficient"])
        cfg, m, arrays, sources = full_inputs()
        arrays["evC_dataLog_1"][1][1][:] = [1e200] * len(arrays["evC_dataLog_1"][1][1])
        report = spc.run_protocol(m, cfg, arrays, sources)
        self.assertEqual(report["run_status"], "exploratory_alarm_activity_only")
        ev = {f["file_id"]: f for f in report["evaluation_files"]}["evC_dataLog_1"]
        self.assertEqual(ev["windows_evaluable"], 0)
        self.assertEqual(ev["windows_excluded"], {"value_out_of_range": 40})
        json_text = __import__("json").dumps(report, allow_nan=False)  # raises on NaN/Inf
        self.assertNotIn("Infinity", json_text)

    def test_reference_scale_floor(self):
        times, values = series(20 * 50 + 1)
        values[0] = [1.0 + (1e-13 if i % 2 else 0.0) for i in range(len(times))]
        ref = spc.window_file(times, values, config())
        ref.update(file_id="refA_dataLog_1", recording_group="refA", role="reference")
        with self.assertRaisesRegex(spc.ProtocolFailure, "reference_scale_below_floor|reference_scale_invalid"):
            spc.fit_reference([ref], config())

    def test_huge_gap_is_sparse_bounded_and_flagged(self):
        import time
        import tracemalloc
        for span in (10000.0, 1e9):
            times = [0.0, 0.001, 0.002, span]
            tracemalloc.start()
            started = time.perf_counter()
            result = spc.window_file(times, [[1.0] * 4, [0.0] * 4, [0.0] * 4], config(min_samples=1, cadence_rel_tolerance=1.0))
            elapsed = time.perf_counter() - started
            peak = tracemalloc.get_traced_memory()[1]
            tracemalloc.stop()
            expected_complete = int(span / 0.05)
            self.assertEqual(result["windows_complete"], expected_complete)
            self.assertLessEqual(len(result["windows"]), 4)          # one entry per window that has samples
            self.assertEqual(sum(r["count"] for r in result["empty_window_runs"]) + len(result["windows"]),
                             expected_complete)
            self.assertTrue(all("timestamp_gap" in r["reasons"] for r in result["empty_window_runs"]))
            self.assertEqual(result["n_gaps"], 1)
            self.assertLess(elapsed, 1.0, f"span {span}s took {elapsed:.3f}s")
            self.assertLess(peak, 2_000_000, f"span {span}s peak {peak} bytes")

    def test_empty_run_detector_matches_expanded_none_sequence(self):
        for method in spc.METHODS:
            for reset in (False, True):
                cfg = config(reset_after_alarm=reset)
                compact = spc.run_detector([5.0, spc.EmptyRun(1, 4), 5.0, 5.0], 0.0, 1.0, method, 3.0, cfg)
                expanded = spc.run_detector([5.0, None, None, None, None, 5.0, 5.0], 0.0, 1.0, method, 3.0, cfg)
                for key in ("raw_alarms", "episodes", "resets", "evaluable_windows", "evaluable_mask_rle_sha256"):
                    self.assertEqual(compact[key], expanded[key], (method, reset, key))

    def test_end_to_end_with_huge_gap_evaluation_file(self):
        cfg, m, arrays, sources = full_inputs()
        times, values = arrays["evD_dataLog_1"]
        arrays["evD_dataLog_1"] = (times[:1000] + [t + 10000.0 for t in times[1000:]], values)
        report = spc.run_protocol(m, cfg, arrays, sources)
        self.assertEqual(report["run_status"], "exploratory_alarm_activity_only")
        ev = {f["file_id"]: f for f in report["evaluation_files"]}["evD_dataLog_1"]
        self.assertGreater(ev["windows_complete"], 200000)
        self.assertEqual(ev["windows_evaluable"], 38)
        self.assertGreater(ev["windows_excluded"]["timestamp_gap"], 200000)
        masks = {ev["methods"][mth]["evaluable_mask_rle_sha256"] for mth in spc.METHODS}
        self.assertEqual(len(masks), 1)

    def test_nonfinite_statistic_raises_instead_of_reporting(self):
        with self.assertRaisesRegex(spc.ProtocolFailure, "detector_statistic_nonfinite"):
            spc.run_detector([1e308, 1e308], -1e308, 1e-300, "cusum", 3.0, config())


def csv_bytes(times, values):
    lines = ["Time,A_x [g],A_y [g],A_z [g]"]
    lines += [f"{t!r},{x!r},{y!r},{z!r}" for t, x, y, z in zip(times, *values)]
    return ("\n".join(lines) + "\n").encode()


class SourceByteBinding(unittest.TestCase):
    def bytes_inputs(self):
        cfg = config()
        files = {}
        specs = (("refA_dataLog_1", "refA", "reference"), ("calB_dataLog_1", "calB", "calibration"),
                 ("evC_dataLog_1", "evC", "evaluation"), ("evD_dataLog_1", "evD", "evaluation"))
        for offset, (name, group, role) in enumerate(specs):  # distinct bytes per file
            files[name] = (group, role, csv_bytes(*series(40 * 50 + 1, value=1.0 + offset * 1e-4, wiggle=0.01)))
        entries = [{"file_id": k, "recording_group": g, "role": r, "source_sha256": hashlib.sha256(b).hexdigest(),
                    "condition": {"op": "weight15", "env": "BckgA"}} for k, (g, r, b) in files.items()]
        m = manifest(cfg, files=entries)
        return cfg, m, {k: b for k, (_, _, b) in files.items()}

    def test_bound_run_decodes_the_verified_bytes(self):
        cfg, m, source = self.bytes_inputs()
        report = spc.run_protocol_from_bytes(m, cfg, source, "csv")
        self.assertEqual(report["run_status"], "exploratory_alarm_activity_only")
        self.assertEqual(report["input_binding"], "decoded_from_verified_source_bytes:csv")
        self.assertNotIn("arrays_not_bound_to_verified_bytes", report["flags"])
        self.assertIn("source_sha256_proves_bytes_only_not_provenance_or_trusted_decoding", report["notes"])

    def test_unbound_arrays_are_flagged(self):
        cfg, m, arrays, sources = full_inputs()
        report = spc.run_protocol(m, cfg, arrays, sources)
        self.assertEqual(report["input_binding"], "caller_supplied_arrays_not_bound_to_source_bytes")
        self.assertIn("arrays_not_bound_to_verified_bytes", report["flags"])

    def test_tampered_bytes_stop_before_decoding(self):
        cfg, m, source = self.bytes_inputs()
        source["evC_dataLog_1"] = source["evC_dataLog_1"].replace(b"0.0", b"9.0", 1)
        report = spc.run_protocol_from_bytes(m, cfg, source, "csv")
        self.assertEqual(report["run_status"], "source_verification_failed")
        self.assertEqual(report["evaluation_files"], [])

    def test_undecodable_verified_bytes_make_the_file_invalid(self):
        cfg, m, source = self.bytes_inputs()
        bad = b"time,x,y,z\n0,1,0,0\n"
        source["evD_dataLog_1"] = bad
        for entry in m["files"]:
            if entry["file_id"] == "evD_dataLog_1":
                entry["source_sha256"] = hashlib.sha256(bad).hexdigest()
        report = spc.run_protocol_from_bytes(m, cfg, source, "csv")
        ev = {f["file_id"]: f for f in report["evaluation_files"]}["evD_dataLog_1"]
        self.assertEqual(ev["file_status"], "invalid")
        self.assertEqual(ev["file_reasons"], ["decode_failed:ValueError:column_schema_mismatch"])

    def test_unknown_decoder_rejected(self):
        cfg, m, source = self.bytes_inputs()
        with self.assertRaises(ValueError):
            spc.run_protocol_from_bytes(m, cfg, source, "pickle")

    def test_csv_decoder_strictness(self):
        cfg = config()
        with self.assertRaisesRegex(ValueError, "value_nonnumeric"):
            spc.decode_csv_bytes(b"Time,A_x [g],A_y [g],A_z [g]\n0,abc,0,0\n", cfg)
        with self.assertRaisesRegex(ValueError, "time_nonfinite"):
            spc.decode_csv_bytes(b"Time,A_x [g],A_y [g],A_z [g]\nnan,1,0,0\n", cfg)
        times, axes = spc.decode_csv_bytes(b"Time,A_x [g],A_y [g],A_z [g]\n0,NaN,0,0\n", cfg)
        self.assertTrue(math.isnan(axes[0][0]))


# ---- Optional dependency strategy (backend v3) ----
# Core CI installs `pip install .` without the optional robot extra (no pyarrow). Core tests
# below must pass there and check the dependency contract itself. Real Parquet tests run
# only when pyarrow is present; in the separate robot-extra CI job FABGUARD_REQUIRE_ROBOT_EXTRA=1
# turns a missing engine into a failure, so those tests cannot be skipped silently there.
REQUIRE_ROBOT_EXTRA = os.environ.get("FABGUARD_REQUIRE_ROBOT_EXTRA") == "1"
HAS_PYARROW = spc.parquet_engine_available()


class ParquetDependencyContract(unittest.TestCase):
    """Runs in every environment (core and robot extra)."""

    def test_missing_engine_gives_clear_dependency_error(self):
        with mock.patch.object(spc.importlib.util, "find_spec", return_value=None):
            self.assertFalse(spc.parquet_engine_available())
            with self.assertRaisesRegex(spc.RobotDependencyError, r"fabguard-ai\[robot\]"):
                spc.decode_parquet_bytes(b"not parquet", config())
            with self.assertRaises(ImportError):  # RobotDependencyError is an ImportError
                spc.load_axes_parquet(Path("unused.parquet"), config())

    def test_missing_engine_stops_bound_parquet_run_before_any_work(self):
        cfg = config()
        with mock.patch.object(spc.importlib.util, "find_spec", return_value=None):
            with self.assertRaises(spc.RobotDependencyError):
                spc.run_protocol_from_bytes(manifest(cfg), cfg, {}, "parquet")

    def test_csv_path_needs_no_optional_engine(self):
        cfg = config()
        with mock.patch.object(spc.importlib.util, "find_spec", return_value=None):
            times, axes = spc.decode_csv_bytes(b"Time,A_x [g],A_y [g],A_z [g]\n0,1,0,0\n0.001,1,0,0\n", cfg)
        self.assertEqual(times, [0.0, 0.001])

    def test_engine_probe_matches_import_machinery(self):
        import importlib.util as util
        self.assertEqual(spc.parquet_engine_available(), util.find_spec("pyarrow") is not None)

    def test_optional_tests_cannot_be_skipped_when_required(self):
        if REQUIRE_ROBOT_EXTRA:
            self.assertTrue(HAS_PYARROW, "FABGUARD_REQUIRE_ROBOT_EXTRA=1 but pyarrow is not installed")


@unittest.skipUnless(HAS_PYARROW or REQUIRE_ROBOT_EXTRA,
                     "optional robot extra (pyarrow) not installed; covered by the robot-extra CI job")
class ParquetLoaderRobotExtra(unittest.TestCase):
    """Real Parquet regressions. Executed in the robot-extra environment."""

    def frame_bytes(self, frame):
        import io
        buffer = io.BytesIO()
        frame.to_parquet(buffer)
        return buffer.getvalue()

    def test_loader_requires_exact_columns(self):
        import pandas as pd
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "ism330dhcx_acc_x_dataLog_1.parquet"
            pd.DataFrame({"Time": [0.0, 0.001], "A_x [g]": [1.0, 1.0],
                          "A_y [g]": [0.0, 0.0], "A_z [g]": [0.0, 0.0]}).to_parquet(path)
            times, values = spc.load_axes_parquet(path, config())
            self.assertEqual(times, [0.0, 0.001])
            self.assertEqual(len(values), 3)
            pd.DataFrame({"Time": [0.0], "A_x [g]": [1.0]}).to_parquet(path)
            with self.assertRaisesRegex(ValueError, "column_schema_mismatch"):
                spc.load_axes_parquet(path, config())

    def test_bound_parquet_run_end_to_end(self):
        import pandas as pd
        cfg = config()
        specs = (("refA_dataLog_1", "refA", "reference"), ("calB_dataLog_1", "calB", "calibration"),
                 ("evC_dataLog_1", "evC", "evaluation"), ("evD_dataLog_1", "evD", "evaluation"))
        source, entries = {}, []
        for offset, (name, group, role) in enumerate(specs):
            times, values = series(40 * 50 + 1, value=1.0 + offset * 1e-4, wiggle=0.01)
            data = self.frame_bytes(pd.DataFrame({"Time": times, "A_x [g]": values[0], "A_y [g]": values[1], "A_z [g]": values[2]}))
            source[name] = data
            entries.append({"file_id": name, "recording_group": group, "role": role,
                            "source_sha256": hashlib.sha256(data).hexdigest(), "condition": {"op": "weight15", "env": "BckgA"}})
        report = spc.run_protocol_from_bytes(manifest(cfg, files=entries), cfg, source, "parquet")
        self.assertEqual(report["run_status"], "exploratory_alarm_activity_only")
        self.assertEqual(report["input_binding"], "decoded_from_verified_source_bytes:parquet")
        for key in ("detection_delay", "anomaly_recall", "miss_rate", "false_alarm_rate"):
            self.assertIsNone(report["performance"][key])

    def test_corrupt_verified_parquet_bytes_make_file_invalid_not_crash(self):
        import pandas as pd
        cfg = config()
        specs = (("refA_dataLog_1", "refA", "reference"), ("calB_dataLog_1", "calB", "calibration"),
                 ("evC_dataLog_1", "evC", "evaluation"), ("evD_dataLog_1", "evD", "evaluation"))
        source, entries = {}, []
        for offset, (name, group, role) in enumerate(specs):
            times, values = series(40 * 50 + 1, value=1.0 + offset * 1e-4, wiggle=0.01)
            data = (b"PAR1-corrupt" if name == "evD_dataLog_1" else
                    self.frame_bytes(pd.DataFrame({"Time": times, "A_x [g]": values[0], "A_y [g]": values[1], "A_z [g]": values[2]})))
            source[name] = data
            entries.append({"file_id": name, "recording_group": group, "role": role,
                            "source_sha256": hashlib.sha256(data).hexdigest(), "condition": {"op": "weight15", "env": "BckgA"}})
        report = spc.run_protocol_from_bytes(manifest(cfg, files=entries), cfg, source, "parquet")
        self.assertEqual(report["run_status"], "exploratory_alarm_activity_only")
        ev = {f["file_id"]: f for f in report["evaluation_files"]}["evD_dataLog_1"]
        self.assertEqual(ev["file_status"], "invalid")
        self.assertTrue(ev["file_reasons"][0].startswith("decode_failed:"))


class WindowIndexLimit(unittest.TestCase):
    """Backend v3: spans whose window index is not exactly representable are rejected."""

    def window(self, end, **overrides):
        times = [0.0, 0.001, 0.002, 0.003, 0.004, end]
        return spc.window_file(times, [[1.0] * 6, [0.0] * 6, [0.0] * 6],
                               config(min_samples=1, **overrides))

    def test_extreme_finite_spans_fail_closed(self):
        for end in (1e100, 1e308, 450359962737049.625):
            w = self.window(end)
            self.assertEqual(w["file_status"], "invalid", end)
            self.assertEqual(w["file_reasons"], ["time_span_exceeds_window_index_limit"])
            json.dumps(w, allow_nan=False)

    def test_limit_boundary_is_exact(self):
        ok = self.window(450359962737049.5625)        # floor(t/0.05) == 2**53 - 1
        self.assertEqual(ok["file_status"], "valid")
        self.assertEqual(ok["windows_complete"], spc.MAX_WINDOWS_PER_FILE)
        total = len(ok["windows"]) + sum(r["count"] for r in ok["empty_window_runs"])
        self.assertEqual(total, spc.MAX_WINDOWS_PER_FILE)
        last = ok["empty_window_runs"][-1]
        self.assertEqual(last["last_index"], spc.MAX_WINDOWS_PER_FILE - 1)
        self.assertTrue(0 <= ok["partial_tail"]["duration_s"] < 0.05)
        self.assertTrue(math.isfinite(ok["duration_total_s"]))
        json.dumps(ok, allow_nan=False)
        bad = self.window(450359962737049.625)        # floor(t/0.05) == 2**53
        self.assertEqual(bad["file_reasons"], ["time_span_exceeds_window_index_limit"])

    def test_boundary_file_in_full_protocol_serializes_with_finite_denominators(self):
        cfg, m, arrays, sources = full_inputs()
        times, values = arrays["evD_dataLog_1"]
        # 1000 normal samples, then one sample whose window index is exactly 2**53 - 1.
        # (Shifting many samples near 4.5e14 s would collide: doubles there are 0.0625 s apart.)
        arrays["evD_dataLog_1"] = (times[:1000] + [450359962737049.5625], [axis[:1001] for axis in values])
        report = spc.run_protocol(m, cfg, arrays, sources)
        ev = {f["file_id"]: f for f in report["evaluation_files"]}["evD_dataLog_1"]
        self.assertEqual(ev["file_status"], "valid")
        self.assertLessEqual(ev["windows_complete"], spc.MAX_WINDOWS_PER_FILE)
        self.assertTrue(math.isfinite(ev["exclusion_fraction"]) and math.isfinite(ev["duration_evaluable_s"]))
        json.dumps(report, allow_nan=False)


if __name__ == "__main__":
    unittest.main()
