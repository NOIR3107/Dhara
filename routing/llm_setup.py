"""
llm_setup.py — one-command setup check for the offline LLM briefing layer
=============================================================================
Run this on any machine that will use reasoning.explain_for_officer() to see
exactly what's missing and what to run next:

    python llm_setup.py

Nothing here runs automatically as part of the app, and nothing here is
REQUIRED for DHARA to work. Every part of the automation / field-report
pipeline runs exactly as before with zero setup on a brand-new machine —
this script only helps a human turn on the OPTIONAL "explain this decision
in plain language" briefing feature (reasoning.explain_for_officer(),
llm_backend.py) on their own machine.

Why this can't just be automatic: installing a ~1.3GB local model server on
someone's laptop without asking is not something this app should ever do
silently — especially on the low-resource field devices this project
targets (see the hardware note in main() below). A teammate, a field
officer's laptop, or a judge's machine that never runs this script keeps
working exactly as before: no LLM briefing, template reasoning only, which
is already fully human-readable (see reasoning.py's module docstring).
"""

from __future__ import annotations

import json
import platform
import shutil
import urllib.error
import urllib.request

import config
import llm_backend


def _ollama_binary_present() -> bool:
    """True if an `ollama` executable is on PATH for this shell/user."""
    return shutil.which("ollama") is not None


def _model_pulled() -> bool:
    """True if config.OLLAMA_MODEL (or a same-family tag) is already pulled."""
    if not llm_backend.is_available():
        return False
    try:
        with urllib.request.urlopen(f"{config.OLLAMA_HOST}/api/tags", timeout=2) as resp:
            tags = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, OSError, ValueError):
        return False
    names = [m.get("name", "") for m in tags.get("models", [])]
    base_name = config.OLLAMA_MODEL.split(":")[0]
    return any(n.startswith(base_name) for n in names)


def _install_instructions() -> list:
    system = platform.system()
    if system == "Windows":
        return [
            "winget install --id Ollama.Ollama -e",
            "(or download the installer from https://ollama.com/download/windows)",
            "If your C: drive is low on space, install to another drive with:",
            '  winget install --id Ollama.Ollama -e --location "D:\\Ollama"',
            "and set OLLAMA_MODELS to a folder on that same drive so pulled",
            "models don't land back on C: either.",
        ]
    if system == "Darwin":
        return [
            "brew install ollama",
            "(or download the .dmg from https://ollama.com/download/mac)",
        ]
    return [
        "curl -fsSL https://ollama.com/install.sh | sh",
        "(the official Linux install script, from https://ollama.com/download/linux)",
    ]


def check_setup() -> dict:
    """
    Return the current readiness of the local LLM briefing layer.

    Readiness is decided from the actual server reachability + model list,
    not from a PATH lookup for the `ollama` binary — PATH updates from an
    installer don't always reach every existing shell/process on every OS,
    and a server that responds is definitive proof it's installed regardless
    of what a PATH-based check finds. `ollama_installed` below is kept only
    as a best-effort hint for which instructions to print, not as a gate.
    """
    running = llm_backend.is_available()
    pulled = _model_pulled() if running else False
    installed = running or _ollama_binary_present()
    return {
        "ollama_installed": installed,
        "server_running": running,
        "model_pulled": pulled,
        "ready": running and pulled,
    }


def main() -> None:
    status = check_setup()

    print("DHARA offline LLM briefing layer — setup check")
    print("=" * 48)
    print(f"Ollama on PATH   : {'yes' if status['ollama_installed'] else 'no'}")
    print(f"Server reachable : {'yes' if status['server_running'] else 'no'} ({config.OLLAMA_HOST})")
    print(f"Model pulled     : {'yes' if status['model_pulled'] else 'no'} ({config.OLLAMA_MODEL})")
    print()

    if status["ready"]:
        print("Ready — reasoning.explain_for_officer() will use the local model on this machine.")
        return

    print("Not ready yet. DHARA works fully without this — every automated")
    print("decision and field report already gets a deterministic, human-")
    print("readable reasoning string with zero setup (see reasoning.py).")
    print("This only unlocks the optional plain-language briefing on top.\n")

    step = 1
    if not status["ollama_installed"]:
        print(f"{step}. Install Ollama:")
        for line in _install_instructions():
            print(f"   {line}")
        step += 1
    if not status["server_running"]:
        print(f"{step}. Start the server (it usually auto-starts after install/login;")
        print("   if not, run this in its own terminal): ollama serve")
        step += 1
    if not status["model_pulled"]:
        print(f"{step}. Pull the model (~1.3GB, one-time, needs internet once):")
        print(f"   ollama pull {config.OLLAMA_MODEL}")

    print(
        "\nHardware note: this is a 1B-parameter model chosen to run on CPU-only\n"
        "hardware, but on modest machines a warm call still takes several\n"
        "seconds (measured ~6-12s in this project's own testing) — see the\n"
        "timeout/latency note in config.py. On a device too weak or too\n"
        "storage-constrained even for this (e.g. an older field tablet),\n"
        "just don't run this setup — the deterministic template reasoning\n"
        "is the intended fallback there, not a degraded second-class mode."
    )


if __name__ == "__main__":
    main()
