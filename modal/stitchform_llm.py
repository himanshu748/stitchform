"""Optional owner-deployed inference. Never run automatically.

Adapted from https://modal.com/docs/examples/vllm_inference (MIT,
modal-labs/modal-examples). vLLM is Apache-2.0; Qwen is Apache-2.0.
API checked 2026-11-17. Local validation: python3 -m py_compile only.
"""
import json
import os
from urllib.parse import urlsplit

import modal

MODEL = "Qwen/Qwen3-4B-Instruct-2507"
REVISION = "cdbee75f17c01a7cc42f958dc650907174af0554"
# This JSON is local configuration, converted to separate vLLM argv items below.
origins = json.loads(os.environ.get("STITCHFORM_ALLOWED_ORIGINS", '["http://localhost:5173","http://localhost:4173"]'))
if not isinstance(origins, list) or not origins or any(
    not isinstance(o, str) or urlsplit(o).scheme not in ("http", "https")
    or not urlsplit(o).hostname or urlsplit(o).path not in ("", "/")
    or urlsplit(o).query or urlsplit(o).fragment or urlsplit(o).username
    for o in origins
):
    raise ValueError("STITCHFORM_ALLOWED_ORIGINS must be a nonempty JSON list of origins")

image = (
    modal.Image.from_registry("nvidia/cuda:12.9.0-devel-ubuntu22.04", add_python="3.12")
    .entrypoint([])
    .uv_pip_install("vllm==0.21.0", "transformers==5.8.1")
)
app = modal.App("stitchform-llm")

@app.server(
    image=image,
    gpu="L4",
    port=8000,
    routing_region="us-east",
    scaledown_window=120,
    startup_timeout=600,
    # No target_concurrency means singleton per the Modal Servers docs.
    unauthenticated=False,
    env={"STITCHFORM_ALLOWED_ORIGINS": json.dumps(origins)},
    volumes={
        "/root/.cache/huggingface": modal.Volume.from_name("stitchform-hf-cache", create_if_missing=True),
        "/root/.cache/vllm": modal.Volume.from_name("stitchform-vllm-cache", create_if_missing=True),
    },
)
class Server:
    @modal.enter()
    def start(self):
        import subprocess
        # v0.21.0 FrontendArgs.allowed_origins is list[str], whose parser uses nargs='+'.
        # Sources: vllm/entrypoints/openai/cli_args.py and engine/arg_utils.py.
        self.process = subprocess.Popen([
            "vllm", "serve", MODEL, "--revision", REVISION,
            "--served-model-name", "stitchform-llm", "--host", "0.0.0.0",
            "--port", "8000", "--max-model-len", "8192", "--enforce-eager",
            "--no-enable-log-requests", "--disable-uvicorn-access-log",
            "--allowed-origins", *json.loads(os.environ["STITCHFORM_ALLOWED_ORIGINS"]),
        ])

    @modal.exit()
    def stop(self):
        self.process.terminate()
