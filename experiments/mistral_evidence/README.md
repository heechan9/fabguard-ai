# Mistral grounded-answer smoke pilot

Status: **prepared; model inference not yet run**. This is an isolated experiment, not a web feature or a model-quality result.

## Why and scope

The user requested a Mistral suitability experiment. Codex prepared the runner and questions; the user has not reviewed model outputs. Existing SECOM models, official results, data splits, web design and equipment decisions are unchanged.

Start with CPU-compatible **Ministral-3-3B-Instruct-2512-Q4_K_M** because this execution environment has no GPU. This is not a benchmark of the previously discussed 8B model. The 12 questions are six Korean/English pairs: AP, true-positive count, review budget, and unsupported field-yield/cost/sensor claims. They cover only a small evidence-reading smoke test, not manufacturing review queues, broad retrieval, prompt injection or production reliability.

The only evidence is `results/v1/RESULTS_SUMMARY.md`, supplied in full. The runner records its SHA-256, prompt, settings, raw responses, per-request wall time and deterministic checks. No training, raw manufacturing data upload, external API call or paid inference is involved. JSON is requested by prompt, not forced with a grammar. A JSON formatting failure counts as a failure in this first protocol; do not silently repair responses.

## Runtime outside the repository

No project dependency is added. Download the model and a compatible llama.cpp release separately:

- Model: https://huggingface.co/mistralai/Ministral-3-3B-Instruct-2512-GGUF
- Pinned model revision: `eb599d408350ea2bb60452cb86be7c7b2fc28227`
- File: `Ministral-3-3B-Instruct-2512-Q4_K_M.gguf`
- Tested runtime executable: llama.cpp build `b11120`, commit `08b1d2aea`, Linux x86_64. Only executable startup/version has been tested so far.
- Runtime release: https://github.com/ggml-org/llama.cpp/releases/tag/b11120

Keep model weights and runtime binaries outside git. Verify the downloaded file against its published LFS SHA-256 before inference and record the observed hash with the run. A successful HEAD request does not verify the download.

Start the server bound to localhost only (adapt the binary and model paths):

```bash
/path/to/llama-server -m /path/to/Ministral-3-3B-Instruct-2512-Q4_K_M.gguf --host 127.0.0.1 --port 8089 -c 4096 -t 4 -ngl 0
```

Then, from the repository root:

```bash
python experiments/mistral_evidence/run.py --output /path/to/new-run.json
```

Preparation without model inference:

```bash
python experiments/mistral_evidence/run.py --prepare-only --output /path/to/new-prepared.json
```

The runner refuses to overwrite a run. It connects only to `127.0.0.1:8089`. Start and stop the local server yourself. Do not expose an unauthenticated server publicly.

## Reading results

`diagnostic_pass` checks exact numeric extraction (as a string), expected abstention, the supplied source path, and a nonempty answer. It does **not** establish that prose is faithful, translated correctly or useful. Read every raw answer: a correct value field could coexist with a misleading explanation. Paired questions are correlated and must not be presented as 12 independent evaluations.

All 12 diagnostic checks plus a manual factual/language review are a prerequisite to a larger pilot, not sufficient to deploy. Before adoption, compare against a deterministic source-excerpt/template baseline on diverse unseen questions, including contradictory and adversarial evidence. This pilot has not made that comparison. No latency, accuracy, economic benefit or superiority claim is permitted until actual responses exist.

## Environment attempt (2026-09-23 UTC)

- Repository base: `1c7979c3ce296db799afacc849f2d2bd57611961`; remote main CI passed at inspection.
- No NVIDIA device or existing model runtime was found. CPU memory was approximately 21 GiB.
- Model metadata and HEAD were accessible; expected model size was 2,147,023,008 bytes.
- Runtime version/startup succeeded. Model transfer was too slow to finish during the bounded 300-second attempt; partial weights are not usable inference evidence.
- `prepared.json` is a preparation manifest, **not model output**. Python compilation, 12-case/6-abstention checks and source-hash verification passed. No model score or latency has been measured.
- Existing application tests were not rerun: this isolated stdlib experiment and document link do not modify application code or dependencies. No web change, deployment, paid service or model training was performed.
