# Locked independent scoring contract

Status: **implemented runner; no real independent evaluation result is included**

This runner is the only step allowed to deserialize and score a frozen FabGuard V1 bundle. Before doing so,
it reruns the readiness gate and then hashes the exact dataset, validation report, model manifest, and model
artifact bytes it will consume. This second binding check prevents a path from being changed between readiness
verification and scoring.

```bash
fabguard-locked-score \
  --dataset path/to/external.csv \
  --validation-report path/to/validation_report.json \
  --model-manifest results/locked-model-v1/model_manifest.json \
  --approval path/to/evaluation_approval.json \
  --output-dir results/independent-evaluation-v1 \
  --bootstrap 2000 \
  --trust-model-artifact
```

`--trust-model-artifact` is mandatory because joblib uses pickle semantics and deserialization can execute
code. SHA-256 proves that the approved bytes did not change; it does **not** make an untrusted source safe.
The runner also requires exact scikit-learn and joblib versions from the export manifest.

## Fixed evaluation

- no `fit`, model selection, tuning, threshold search, or calibration
- fixed threshold `0.5` and Top-K budgets `5%`, `10%`, and `20%`, preserving V1 definitions
- Average Precision, classification metrics, Brier score, ECE, Top-K capture/lift, and paired bootstrap
  intervals with a recorded seed
- ranked row-level predictions plus JSON, CSV, and Markdown evidence
- immutable output directory assembled before one atomic rename

The approval record names a reviewer but is not an authenticated digital signature. Results apply only to the
exact bound independent dataset. They do not prove factory deployment, yield, cost, uptime, general performance
across fabs, or causal process impact. Nothing under canonical `results/v1` is modified.
