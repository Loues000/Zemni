"""Generate synthetic test cases using free OpenRouter models."""
import argparse
import asyncio
import json
import random
from pathlib import Path
from typing import List, Dict, Any
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from benchmark.models.client import ModelClient


CONFIG_PATH = Path(__file__).parent / "config" / "benchmark_config.json"
TEMPLATES_PATH = Path(__file__).parent / "config" / "test_case_templates.json"


def load_config() -> Dict[str, Any]:
    """Load benchmark configuration."""
    with open(CONFIG_PATH, encoding="utf-8") as f:
        return json.load(f)


def load_templates() -> Dict[str, Any]:
    """Load test case templates."""
    with open(TEMPLATES_PATH, encoding="utf-8") as f:
        return json.load(f)


def build_generation_prompt(
    topic: str,
    format_type: str,
    templates: Dict[str, Any],
    target_length: int = 2000
) -> str:
    """Build prompt for test case generation."""
    topic_info = templates["topics"].get(topic, {})
    keywords = topic_info.get("keywords", [])
    formulas = topic_info.get("formulas", [])
    
    format_prompt = templates["format_prompts"].get(format_type, "")
    
    prompt = f"""Erstelle einen akademischen Text zum Thema "{topic}" für eine Vorlesung.

Anforderungen:
- Länge: ca. {target_length} Zeichen
- Thema: {topic}
- Verwende Fachbegriffe: {', '.join(keywords[:5])}
{f'- Enthalte mathematische Formeln: {", ".join(formulas[:3])}' if formulas else ''}

Format-Anforderung:
{format_prompt}

Der Text sollte:
- Einzelnes Thema umfassend behandeln (nicht oberflächlich)
- Technische Konzepte, Definitionen, Prozesse enthalten
- Strukturiert sein (Absätze, ggf. Listen)
- Für Prüfungsvorbereitung geeignet sein

Gib NUR den Text aus, keine Metadaten, keine Einleitung."""
    
    return prompt


async def generate_test_case(
    client: ModelClient,
    model_id: str,
    topic: str,
    format_type: str,
    templates: Dict[str, Any],
    test_id: int
) -> Dict[str, Any]:
    """Generate a single test case."""
    target_length = random.randint(1500, 3000)
    
    system_prompt = """Du erstellst akademische Vorlesungstexte für Benchmarking-Zwecke. 
Erstelle realistische, prüfungsrelevante Inhalte."""
    
    user_prompt = build_generation_prompt(topic, format_type, templates, target_length)
    
    result = await client.generate(
        model_id=model_id,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        max_tokens=4000,
        temperature=0.7
    )
    
    if result.get("error"):
        return {
            "id": f"test_{test_id:04d}",
            "error": result["error"],
            "text": "",
            "topic_category": topic,
            "format_type": format_type
        }
    
    text = result["text"].strip()
    
    return {
        "id": f"test_{test_id:04d}",
        "title": f"{topic.replace('_', ' ').title()} - {format_type.replace('_', ' ').title()}",
        "text": text,
        "topic_category": topic,
        "format_type": format_type,
        "length": len(text),
        "generated_by": model_id,
        "error": None
    }


async def generate_test_cases(
    count: int,
    models: List[str],
    config: Dict[str, Any],
    templates: Dict[str, Any],
    output_path: Path
):
    """Generate multiple test cases using free models."""
    topics = config["topics"]
    formats = config["test_case_formats"]
    free_models = models or config["free_generation_models"]
    
    # Check model availability
    async with ModelClient() as client:
        print(f"Checking availability of {len(free_models)} models...")
        availability = await client.check_models_availability(free_models)
        available_models = [m for m in free_models if availability.get(m, False)]
        
        if not available_models:
            print("ERROR: No free models are available!")
            return
        
        print(f"Available models: {len(available_models)}/{len(free_models)}")
        for model in available_models:
            print(f"  ✓ {model}")
        for model in free_models:
            if model not in available_models:
                print(f"  ✗ {model} (unavailable)")
        
        # Generate test cases
        test_cases = []
        model_rotation = 0
        
        print(f"\nGenerating {count} test cases...")
        
        for i in range(count):
            # Rotate through models
            model_id = available_models[model_rotation % len(available_models)]
            model_rotation += 1
            
            # Random topic and format
            topic = random.choice(topics)
            format_type = random.choice(formats)
            
            print(f"  [{i+1}/{count}] Generating {topic} ({format_type}) with {model_id}...")
            
            test_case = await generate_test_case(
                client, model_id, topic, format_type, templates, i + 1
            )
            
            if test_case.get("error"):
                print(f"    ERROR: {test_case['error']}")
            else:
                print(f"    ✓ Generated {test_case['length']} chars")
            
            test_cases.append(test_case)
            
            # Small delay to avoid rate limits
            await asyncio.sleep(0.5)
    
    # Save test cases
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Load existing test cases if file exists to preserve generated text
    existing_cases = {}
    if output_path.exists():
        try:
            with open(output_path, "r", encoding="utf-8") as f:
                existing = json.load(f)
                existing_cases = {tc.get("id"): tc for tc in existing if isinstance(tc, dict)}
        except Exception:
            pass
    
    # Merge with existing, preserving generated text
    for tc in test_cases:
        existing_id = existing_cases.get(tc.get("id"))
        if existing_id and existing_id.get("text") and not tc.get("error"):
            # Preserve existing text if new generation failed
            if not tc.get("text"):
                tc["text"] = existing_id["text"]
                tc["generated_by"] = existing_id.get("generated_by", "previous")
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(test_cases, f, indent=2, ensure_ascii=False)
    
    successful = sum(1 for tc in test_cases if not tc.get("error") and tc.get("text"))
    print(f"\n✓ Generated {successful}/{count} test cases")
    print(f"  Saved to: {output_path}")
    print(f"  Note: Generated text is preserved for future test case reuse")


def main():
    parser = argparse.ArgumentParser(description="Generate synthetic test cases for benchmarking")
    parser.add_argument("--count", type=int, default=10, help="Number of test cases to generate")
    parser.add_argument(
        "--models",
        type=str,
        help="Comma-separated list of model IDs (default: from config)"
    )
    parser.add_argument(
        "--output",
        type=str,
        default="benchmark/results/test_cases.json",
        help="Output path for test cases JSON"
    )
    
    args = parser.parse_args()
    
    models = None
    if args.models:
        models = [m.strip() for m in args.models.split(",")]
    
    config = load_config()
    templates = load_templates()
    output_path = Path(args.output)
    
    asyncio.run(generate_test_cases(
        args.count,
        models,
        config,
        templates,
        output_path
    ))


if __name__ == "__main__":
    main()
