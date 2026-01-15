from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional


@dataclass(frozen=True)
class Pricing:
    currency: str
    input_per_1m: Optional[float]
    output_per_1m: Optional[float]


@dataclass(frozen=True)
class ModelSpec:
    name: str
    provider: str
    tokenizer_encoding: str
    pricing: Pricing


DEFAULT_MODELS: list[ModelSpec] = [
    ModelSpec(
        name="gpt-5.2-instant",
        provider="openai",
        tokenizer_encoding="o200k_base",
        pricing=Pricing(currency="USD", input_per_1m=None, output_per_1m=None),
    ),
    ModelSpec(
        name="gpt-5.2-thinking",
        provider="openai",
        tokenizer_encoding="o200k_base",
        pricing=Pricing(currency="USD", input_per_1m=None, output_per_1m=None),
    ),
    ModelSpec(
        name="gpt-5.1-instant",
        provider="openai",
        tokenizer_encoding="o200k_base",
        pricing=Pricing(currency="USD", input_per_1m=None, output_per_1m=None),
    ),
    ModelSpec(
        name="gpt-5.1-thinking",
        provider="openai",
        tokenizer_encoding="o200k_base",
        pricing=Pricing(currency="USD", input_per_1m=None, output_per_1m=None),
    ),
    ModelSpec(
        name="gpt-5-mini",
        provider="openai",
        tokenizer_encoding="o200k_base",
        pricing=Pricing(currency="USD", input_per_1m=None, output_per_1m=None),
    ),
    ModelSpec(
        name="gpt-5-nano",
        provider="openai",
        tokenizer_encoding="o200k_base",
        pricing=Pricing(currency="USD", input_per_1m=None, output_per_1m=None),
    ),
    ModelSpec(
        name="gpt-oss-120b",
        provider="openai",
        tokenizer_encoding="o200k_base",
        pricing=Pricing(currency="USD", input_per_1m=None, output_per_1m=None),
    ),
    ModelSpec(
        name="gpt-oss-20b",
        provider="openai",
        tokenizer_encoding="o200k_base",
        pricing=Pricing(currency="USD", input_per_1m=None, output_per_1m=None),
    ),
    ModelSpec(
        name="gemini-3-flash",
        provider="google",
        tokenizer_encoding="cl100k_base",
        pricing=Pricing(currency="USD", input_per_1m=None, output_per_1m=None),
    ),
    ModelSpec(
        name="gemini-3-pro",
        provider="google",
        tokenizer_encoding="cl100k_base",
        pricing=Pricing(currency="USD", input_per_1m=None, output_per_1m=None),
    ),
    ModelSpec(
        name="claude-sonnet-4.5",
        provider="anthropic",
        tokenizer_encoding="cl100k_base",
        pricing=Pricing(currency="USD", input_per_1m=None, output_per_1m=None),
    ),
    ModelSpec(
        name="claude-opus-4.5",
        provider="anthropic",
        tokenizer_encoding="cl100k_base",
        pricing=Pricing(currency="USD", input_per_1m=None, output_per_1m=None),
    ),
    ModelSpec(
        name="grok-4",
        provider="xai",
        tokenizer_encoding="cl100k_base",
        pricing=Pricing(currency="USD", input_per_1m=None, output_per_1m=None),
    ),
    ModelSpec(
        name="grok-4.1-fast",
        provider="xai",
        tokenizer_encoding="cl100k_base",
        pricing=Pricing(currency="USD", input_per_1m=None, output_per_1m=None),
    ),
    ModelSpec(
        name="kimi-k2-thinking",
        provider="moonshotai",
        tokenizer_encoding="cl100k_base",
        pricing=Pricing(currency="USD", input_per_1m=None, output_per_1m=None),
    ),
    ModelSpec(
        name="deepseek-v3.2",
        provider="deepseek",
        tokenizer_encoding="cl100k_base",
        pricing=Pricing(currency="USD", input_per_1m=None, output_per_1m=None),
    ),
    ModelSpec(
        name="glm-4.7",
        provider="zhipuai",
        tokenizer_encoding="cl100k_base",
        pricing=Pricing(currency="USD", input_per_1m=None, output_per_1m=None),
    ),
]


def _parse_models_json(data: Any) -> list[ModelSpec]:
    if not isinstance(data, list):
        raise ValueError("models JSON must be a list")

    models: list[ModelSpec] = []
    for i, raw in enumerate(data):
        if not isinstance(raw, dict):
            raise ValueError(f"models[{i}] must be an object")
        name = str(raw.get("name", "")).strip()
        provider = str(raw.get("provider", "")).strip() or "unknown"
        tokenizer = raw.get("tokenizer", {})
        if not isinstance(tokenizer, dict):
            raise ValueError(f"models[{i}].tokenizer must be an object")
        tokenizer_encoding = str(tokenizer.get("tiktoken_encoding", "")).strip() or "cl100k_base"

        pricing_raw = raw.get("pricing", {})
        if not isinstance(pricing_raw, dict):
            raise ValueError(f"models[{i}].pricing must be an object")
        currency = str(pricing_raw.get("currency", "USD")).strip() or "USD"

        def _maybe_float(v: Any) -> Optional[float]:
            if v is None:
                return None
            if v == "":
                return None
            return float(v)

        pricing = Pricing(
            currency=currency,
            input_per_1m=_maybe_float(pricing_raw.get("input_per_1m")),
            output_per_1m=_maybe_float(pricing_raw.get("output_per_1m")),
        )
        if not name:
            raise ValueError(f"models[{i}].name is required")
        models.append(
            ModelSpec(name=name, provider=provider, tokenizer_encoding=tokenizer_encoding, pricing=pricing)
        )

    return models


def load_models(models_file: Optional[Path]) -> list[ModelSpec]:
    def _auto_models_file() -> Optional[Path]:
        here = Path(__file__).resolve().parent
        for filename in ("models.json", "models.prices.json", "models.example.json"):
            candidate = here / filename
            if candidate.exists():
                return candidate
        return None

    chosen = models_file or _auto_models_file()
    if chosen is None:
        return DEFAULT_MODELS

    raw = json.loads(chosen.read_text(encoding="utf-8"))
    return _parse_models_json(raw)


def extract_text_from_pdf(pdf_path: Path) -> str:
    try:
        import PyPDF2  # type: ignore
    except ModuleNotFoundError as e:
        raise ModuleNotFoundError(
            "Missing dependency PyPDF2. Install with: pip install -r requirements.txt"
        ) from e
    with pdf_path.open("rb") as file:
        reader = PyPDF2.PdfReader(file)
        parts: list[str] = []
        for page in reader.pages:
            extracted = page.extract_text() or ""
            if extracted.strip():
                parts.append(extracted)
        return "\n\n".join(parts)


def load_text(input_path: Path) -> str:
    if input_path.suffix.lower() == ".pdf":
        return extract_text_from_pdf(input_path)
    return input_path.read_text(encoding="utf-8", errors="replace")


def count_tokens(text: str, tiktoken_encoding: str) -> int:
    try:
        import tiktoken  # type: ignore
    except ModuleNotFoundError as e:
        raise ModuleNotFoundError(
            "Missing dependency tiktoken. Install with: pip install -r requirements.txt"
        ) from e
    try:
        encoding = tiktoken.get_encoding(tiktoken_encoding)
    except Exception:
        encoding = tiktoken.get_encoding("cl100k_base")
    return len(encoding.encode(text))


def money(amount: Optional[float], currency: str) -> str:
    if amount is None:
        return "—"
    return f"{amount:,.4f} {currency}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Estimate token counts and costs for a PDF/text input.")
    parser.add_argument("path", nargs="?", help="Path to a .pdf or text file")
    parser.add_argument(
        "--models-file",
        type=Path,
        default=None,
        help="Optional JSON file describing models, tokenizers, and pricing (defaults to models.json/models.example.json in this folder).",
    )
    parser.add_argument(
        "--output-tokens",
        type=int,
        default=0,
        help="Estimated output tokens (added to cost if output pricing is set).",
    )
    parser.add_argument(
        "--list-models",
        action="store_true",
        help="Print loaded models and exit.",
    )
    args = parser.parse_args()

    models = load_models(args.models_file)
    if args.list_models:
        for m in models:
            print(f"{m.name} ({m.provider}) tokenizer={m.tokenizer_encoding}")
        return 0

    path_str = args.path or input("Path to a .pdf or text file: ").strip()
    input_path = Path(path_str).expanduser()
    if not input_path.exists():
        raise SystemExit(f"Not found: {input_path}")

    text = load_text(input_path)

    unique_encodings = sorted({m.tokenizer_encoding for m in models})
    token_cache: dict[str, int] = {}
    for enc in unique_encodings:
        token_cache[enc] = count_tokens(text, enc)

    rows: list[dict[str, str]] = []
    for m in models:
        tokens_in = token_cache[m.tokenizer_encoding]
        tokens_out = max(0, int(args.output_tokens))

        cost_in = None
        if m.pricing.input_per_1m is not None:
            cost_in = (tokens_in / 1_000_000) * m.pricing.input_per_1m

        cost_out = None
        if m.pricing.output_per_1m is not None:
            cost_out = (tokens_out / 1_000_000) * m.pricing.output_per_1m

        total = None
        if cost_in is not None or cost_out is not None:
            total = (cost_in or 0.0) + (cost_out or 0.0)

        rows.append(
            {
                "model": m.name,
                "provider": m.provider,
                "total": money(total, m.pricing.currency),
                "in_tokens": f"{tokens_in:,}",
                "in_cost": money(cost_in, m.pricing.currency),
                "out_tokens": f"{tokens_out:,}",
                "out_cost": money(cost_out, m.pricing.currency),
                "in_per_1m": money(m.pricing.input_per_1m, m.pricing.currency),
                "out_per_1m": money(m.pricing.output_per_1m, m.pricing.currency),
                "tokenizer": m.tokenizer_encoding,
            }
        )

    headers = [
        "model",
        "provider",
        "total",
        "in_tokens",
        "in_cost",
        "out_tokens",
        "out_cost",
        "in_per_1m",
        "out_per_1m",
        "tokenizer",
    ]
    widths = {h: max(len(h), *(len(r[h]) for r in rows)) for h in headers}
    print(" | ".join(h.ljust(widths[h]) for h in headers))
    print("-+-".join("-" * widths[h] for h in headers))
    for r in rows:
        print(" | ".join(r[h].ljust(widths[h]) for h in headers))

    if all(m.pricing.input_per_1m is None and m.pricing.output_per_1m is None for m in models):
        print(
            "\nNote: no pricing loaded (all —). Put per-1M rates into models.example.json or pass --models-file."
        )
    print(
        "Note: token counts are based on the listed tiktoken encoding and may not match non-OpenAI providers' native tokenizers."
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except BrokenPipeError:
        sys.exit(0)
    except OSError as e:
        if getattr(e, "errno", None) in (22, 32):
            sys.exit(0)
        raise
