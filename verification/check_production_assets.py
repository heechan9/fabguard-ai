"""Compare public production static bytes with this checked-out release; read only."""
import hashlib
import json
from pathlib import Path
import subprocess
import time
import urllib.error
import urllib.request

BASE = 'https://fabguard-ai.vercel.app/'
FILES = [
    'index.html', 'silver.css', 'secom/index.html',
    'smt/context-review-model.mjs', 'smt/context-review.mjs',
    'smt/index.html', 'smt/app.mjs', 'smt/style.css', 'smt/simulation.mjs',
    'smt/robot-cell-model.mjs', 'smt/robot-cell-view.mjs', 'smt/terms.mjs',
    'equipment/index.html', 'equipment/context-review.html',
    'equipment/context-review.css', 'equipment/context-review.mjs',
    'equipment/context-review-model.mjs', 'equipment/data/maintenance-synthetic.json',
    'robot/index.html', 'robot/window-core.mjs', 'research/index.html',
]


def main():
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    deadline = time.monotonic() + 240
    expected = {p: hashlib.sha256((Path('web') / p).read_bytes()).hexdigest() for p in FILES}
    attempts = 0
    while True:
        attempts += 1
        records = []
        for path in FILES:
            entry = {'path': path, 'expected_sha256': expected[path]}
            try:
                request = urllib.request.Request(BASE + path, headers={'Cache-Control': 'no-cache'})
                with urllib.request.urlopen(request, timeout=10) as response:
                    raw = response.read(5 * 1024 * 1024 + 1)
                    entry.update(status=response.status, actual_sha256=hashlib.sha256(raw).hexdigest())
                entry['matches'] = entry['actual_sha256'] == expected[path]
            except (OSError, urllib.error.URLError) as error:
                entry.update(matches=False, error=str(error))
            records.append(entry)
            if not entry['matches']:
                break
        passed = len(records) == len(FILES) and all(r['matches'] for r in records)
        if passed or time.monotonic() >= deadline:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(json.dumps({
                'checked_commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip(),
                'base_url': BASE, 'status': 'pass' if passed else 'fail',
                'attempts': attempts, 'assets': records,
                'scope': 'Static bytes and honest-limit text versions only; browser checks run separately',
            }, indent=2) + '\n')
            if not passed:
                raise SystemExit('Production bytes did not converge to the checked-out release')
            print(f'Production static files match release: {len(records)} assets')
            return
        time.sleep(5)


if __name__ == '__main__':
    main()
