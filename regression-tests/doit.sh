#!/bin/bash

cd ~/github/astryx/regression-tests
source .venv/bin/activate

python3 run_regression.py \
  --src-dir ../src/js \
  --corpus-dir TestLogs \
  --manifest corpus_manifest.json

deactivate

# ----------------------------------------------------------------------
# ----------------------------------------------------------------------
# ----------------------------------------------------------------------
