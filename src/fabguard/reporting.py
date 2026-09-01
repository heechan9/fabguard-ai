"""Generate compact report figures, Markdown summary, and static web data."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd
from sklearn.metrics import PrecisionRecallDisplay, confusion_matrix

from .data import load_secom


def save_figures(data_dir: Path, result_dir: Path) -> None:
    figure_dir = result_dir / "figures"
    figure_dir.mkdir(parents=True, exist_ok=True)
    frame = load_secom(data_dir)
    priorities = pd.read_csv(result_dir / "priority_table.csv")
    topk = pd.read_csv(result_dir / "top_k_test.csv")
    stability = pd.read_csv(result_dir / "feature_stability.csv").head(15)

    monthly = frame.assign(month=frame["timestamp"].dt.to_period("M").astype(str)).groupby("month")["label"].agg(["count", "sum"])
    monthly.rename(columns={"sum": "fail"}).plot(kind="bar", y=["count", "fail"], color=["#64748b", "#ef4444"])
    plt.title("SECOM monthly samples and Fail labels")
    plt.xlabel("Month")
    plt.ylabel("Count")
    plt.xticks(rotation=0)
    plt.tight_layout()
    plt.savefig(figure_dir / "monthly_label_distribution.png", dpi=180)
    plt.close()

    PrecisionRecallDisplay.from_predictions(priorities["label"], priorities["risk_score"], name="Selected Random Forest")
    plt.title("Temporal holdout precision-recall curve")
    plt.tight_layout()
    plt.savefig(figure_dir / "test_precision_recall.png", dpi=180)
    plt.close()

    matrix = confusion_matrix(priorities["label"], priorities["prediction"], labels=[0, 1])
    fig, ax = plt.subplots(figsize=(5, 4))
    image = ax.imshow(matrix, cmap="Blues")
    for row in range(2):
        for column in range(2):
            ax.text(column, row, str(matrix[row, column]), ha="center", va="center", fontsize=14)
    ax.set_xticks([0, 1], ["Pred Pass", "Pred Fail"])
    ax.set_yticks([0, 1], ["Actual Pass", "Actual Fail"])
    ax.set_title("Temporal holdout confusion matrix (threshold=0.5)")
    fig.colorbar(image, ax=ax)
    fig.tight_layout()
    fig.savefig(figure_dir / "test_confusion_matrix.png", dpi=180)
    plt.close(fig)

    plt.figure(figsize=(6, 4))
    plt.plot(topk["inspection_burden"] * 100, topk["fail_capture_rate"] * 100, marker="o", color="#2563eb")
    for _, row in topk.iterrows():
        plt.annotate(f"{int(row['captured_fail'])}/{int(row['total_fail'])}", (row["inspection_burden"] * 100, row["fail_capture_rate"] * 100), xytext=(4, 5), textcoords="offset points")
    plt.xlabel("Inspection budget (%)")
    plt.ylabel("Fail capture (%)")
    plt.title("Temporal holdout Top-K risk capture")
    plt.grid(alpha=0.25)
    plt.tight_layout()
    plt.savefig(figure_dir / "top_k_capture.png", dpi=180)
    plt.close()

    plt.figure(figsize=(8, 5))
    ordered = stability.sort_values("top20_rate").tail(15)
    plt.barh(ordered["feature"], ordered["top20_rate"], color="#0f766e")
    plt.xlabel("Top-20 inclusion rate across CV fits")
    plt.title("Selected-model feature stability")
    plt.xlim(0, 1)
    plt.tight_layout()
    plt.savefig(figure_dir / "feature_stability.png", dpi=180)
    plt.close()


def write_summary(result_dir: Path) -> None:
    cv = pd.read_csv(result_dir / "cv_summary.csv")
    test = pd.read_csv(result_dir / "test_metrics.csv")
    topk = pd.read_csv(result_dir / "top_k_test.csv")
    manifest = json.loads((result_dir / "manifest.json").read_text(encoding="utf-8"))
    selected = manifest["selected_candidate_from_train_cv"]
    selected_cv = cv[cv["candidate"] == selected].iloc[0]
    selected_test = test[test["candidate"] == selected].iloc[0]
    top10 = topk.loc[(topk["k_fraction"] - 0.10).abs().idxmin()]
    summary = f"""# FabGuard AI V1 Results Summary

Status: **Provisional** - see `docs/TEST_EXPOSURE.md`.

## Decision result

Train-only 5×5 repeated CV selected `{selected}` by mean Average Precision. Its CV AP was `{selected_cv['pr_auc_average_precision_mean']:.4f} ± {selected_cv['pr_auc_average_precision_std']:.4f}`. On the later temporal holdout, AP fell to `{selected_test['pr_auc_average_precision']:.4f}`.

At the untuned 0.5 threshold the selected model produced TP={int(selected_test['tp'])}, FP={int(selected_test['fp'])}, FN={int(selected_test['fn'])}, TN={int(selected_test['tn'])}. The classifier therefore does not support an operational Fail/no-Fail claim.

## Constrained inspection result

With a Top-10% inspection budget, the model ranked {int(top10['inspection_count'])} of 392 production instances for review and captured {int(top10['captured_fail'])} of 24 Fail instances ({top10['fail_capture_rate']:.1%}). Precision was {top10['precision']:.1%} and lift over the holdout prevalence was {top10['lift']:.2f}×.

## Interpretation

The experiment found temporal degradation and weak but non-zero ranking signal. FabGuard V1 is best presented as a reproducible risk-prioritization study that exposes the limits of deploying a model trained on an earlier manufacturing period, not as a proven yield-improvement or root-cause system.

## Non-claims

- Anonymous variables are not interpreted as physical sensors or causal factors.
- No actual yield, cost, downtime, FDC, APC, or SPC improvement was demonstrated.
- The holdout is not pristine after the documented engineering smoke exposure.
"""
    (result_dir / "RESULTS_SUMMARY.md").write_text(summary, encoding="utf-8")


def write_web_data(result_dir: Path, web_data_dir: Path) -> None:
    web_data_dir.mkdir(parents=True, exist_ok=True)
    cv = pd.read_csv(result_dir / "cv_summary.csv")
    test = pd.read_csv(result_dir / "test_metrics.csv")
    topk = pd.read_csv(result_dir / "top_k_test.csv")
    priorities = pd.read_csv(result_dir / "priority_table.csv").head(50)
    manifest = json.loads((result_dir / "manifest.json").read_text(encoding="utf-8"))

    dataset_info = {}
    audit_file = result_dir / "data_audit.json"
    if audit_file.exists():
        audit_data = json.loads(audit_file.read_text(encoding="utf-8"))
        dataset_info = {
            "samples": audit_data.get("samples", 1567),
            "measurement_features": audit_data.get("measurement_features", 590),
            "pass_count": audit_data.get("pass_count", 1463),
            "fail_count": audit_data.get("fail_count", 104),
            "train_samples": audit_data.get("split", {}).get("train_samples", 1175),
            "train_fail": audit_data.get("split", {}).get("train_fail", 80),
            "test_samples": audit_data.get("split", {}).get("test_samples", 392),
            "test_fail": audit_data.get("split", {}).get("test_fail", 24),
        }
    else:
        dataset_info = {
            "samples": 1567,
            "measurement_features": 590,
            "pass_count": 1463,
            "fail_count": 104,
            "train_samples": 1175,
            "train_fail": 80,
            "test_samples": 392,
            "test_fail": 24,
        }

    payload = {
        "status": "provisional",
        "selected_model": manifest["selected_candidate_from_train_cv"],
        "dataset": dataset_info,
        "cv": cv.where(pd.notna(cv), None).to_dict(orient="records"),
        "test": test.where(pd.notna(test), None).to_dict(orient="records"),
        "top_k": topk.where(pd.notna(topk), None).to_dict(orient="records"),
        "warning": "Temporal holdout performance degraded; this is decision-support evidence, not a production claim.",
    }
    (web_data_dir / "summary.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    (web_data_dir / "priority_top50.json").write_text(priorities.to_json(orient="records", force_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, default=Path("data/raw"))
    parser.add_argument("--result-dir", type=Path, default=Path("results/v1"))
    parser.add_argument("--web-data-dir", type=Path, default=Path("web/data"))
    args = parser.parse_args()
    save_figures(args.data_dir, args.result_dir)
    write_summary(args.result_dir)
    write_web_data(args.result_dir, args.web_data_dir)
    print(f"report artifacts written under {args.result_dir} and {args.web_data_dir}")


if __name__ == "__main__":
    main()

