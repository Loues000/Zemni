"""LLM judge with multi-model consensus evaluation."""
import asyncio
import hashlib
import json
import os
from pathlib import Path
from typing import Dict, Any, List, Optional
import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from benchmark.models.client import ModelClient


JUDGE_CACHE_DIR = Path(__file__).parent.parent / "results" / "judge_cache"
JUDGE_CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Cost optimization: Reduced source text length for judges (1500 instead of 2000)
JUDGE_SOURCE_TEXT_MAX_CHARS = 1500


def get_judge_source_text(source_text: str, max_chars: int = JUDGE_SOURCE_TEXT_MAX_CHARS) -> str:
    """
    Get truncated source text for judge evaluation with intelligent sentence boundary detection.
    
    Args:
        source_text: Full source text
        max_chars: Maximum characters to include (default: 1500)
    
    Returns:
        Truncated source text, ideally cut at sentence boundary
    """
    if len(source_text) <= max_chars:
        return source_text
    
    truncated = source_text[:max_chars]
    # Try to cut at sentence boundary (period or newline)
    last_period = truncated.rfind('.')
    last_newline = truncated.rfind('\n')
    cut_point = max(last_period, last_newline)
    
    # Only use cut point if it's at least 80% of desired length (to avoid too short truncation)
    if cut_point > max_chars * 0.8:
        return source_text[:cut_point + 1]
    
    return truncated + "..."


def normalize_text_for_cache(text: str) -> str:
    """
    Normalize text for better cache hits by removing excessive whitespace.
    
    Args:
        text: Text to normalize
    
    Returns:
        Normalized text with single spaces and trimmed
    """
    import re
    # Replace multiple whitespace with single space
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def get_output_hash(output_text: str, task_type: str, source_text: str) -> str:
    """Generate hash for caching judge evaluations."""
    # Normalize texts for better cache hits (same content = same hash)
    output_text = normalize_text_for_cache(output_text)
    source_text = normalize_text_for_cache(source_text)
    
    # Use full text for better uniqueness, hash if too long
    if len(output_text) > 10000:
        output_hash = hashlib.sha256(output_text.encode()).hexdigest()
        output_text = output_hash
    if len(source_text) > 10000:
        source_hash = hashlib.sha256(source_text.encode()).hexdigest()
        source_text = source_hash
    content = f"{task_type}:{output_text}:{source_text}"
    return hashlib.sha256(content.encode()).hexdigest()


def load_cached_judgment(hash_key: str) -> Optional[Dict[str, Any]]:
    """Load cached judgment if available."""
    cache_file = JUDGE_CACHE_DIR / f"{hash_key}.json"
    if cache_file.exists():
        try:
            return json.loads(cache_file.read_text())
        except Exception:
            return None
    return None


def save_cached_judgment(hash_key: str, judgment: Dict[str, Any]):
    """Save judgment to cache."""
    cache_file = JUDGE_CACHE_DIR / f"{hash_key}.json"
    cache_file.write_text(json.dumps(judgment, indent=2))


def build_judge_prompt(
    task_type: str,
    source_text: str,
    output_text: str,
    output_json: Optional[Dict[str, Any]] = None
) -> str:
    """Build prompt for judge model."""
    
    # Optimize source text length for judges (cost optimization)
    judge_source = get_judge_source_text(source_text)
    
    if task_type == "summary":
        prompt = f"""Bewerte eine KI-generierte Zusammenfassung von Vorlesungsmaterial.

Quelle: {judge_source}

Zusammenfassung: {output_text}

Bewertungsgrundlage: Quelltext ist EINZIGE Referenz. Prüfe nur Übereinstimmung, nicht absolute Korrektheit.

Bewerte auf Skala 1-100:
1. **Source Fidelity**: Entspricht Ausgabe dem Quelltext? Halluzinationen? (1=many errors, 100=perfect match)
2. **Completeness**: Werden wichtige Konzepte abgedeckt? (1=incomplete, 100=complete)
3. **Quality**: Nützlich für Prüfungsvorbereitung? Klar strukturiert? (1=unusable, 100=excellent)
4. **LaTeX Correctness**: Formeln korrekt escaped? ($...$ oder \\(...\\) inline, $$...$$ oder \\[...\\] display) (1=errors, 100=perfect)

Leere Ausgabe = alle Scores 1.

Antworte NUR mit JSON:
{{
  "factual_accuracy": <1-100>,
  "completeness": <1-100>,
  "quality": <1-100>,
  "latex_correctness": <1-100>,
  "reasoning": "Kurze Begründung"
}}"""
    
    elif task_type == "quiz":
        questions = output_json.get("questions", []) if output_json else []
        questions_text = json.dumps(questions, indent=2, ensure_ascii=False)
        
        prompt = f"""Bewerte KI-generierte Quiz-Fragen zu Vorlesungsmaterial.

Quelle: {judge_source}

Quiz-Fragen: {questions_text}

Bewertungsgrundlage: Quelltext ist EINZIGE Referenz. Prüfe nur Übereinstimmung, nicht absolute Korrektheit.

Bewerte auf Skala 1-100:
1. **Source Fidelity**: Entsprechen Fragen/Antworten dem Quelltext? Halluzinationen? (1=many errors, 100=perfect match)
2. **Completeness**: Werden wichtige Konzepte abgedeckt? (1=incomplete, 100=complete)
3. **Question Quality**: Fragen klar, relevant, prüfungsorientiert? (1=bad, 100=excellent)
4. **Distractor Quality**: Distraktoren plausibel? (1=obviously wrong, 100=very plausible)
5. **Pedagogical Usefulness**: Erklärungen so hilfreich, dass Student Fehler ohne Google versteht? (1=not helpful, 100=very helpful)

Leere Fragen = alle Scores 1.

Antworte NUR mit JSON:
{{
  "factual_accuracy": <1-100>,
  "completeness": <1-100>,
  "question_quality": <1-100>,
  "distractor_quality": <1-100>,
  "pedagogical_usefulness": <1-100>,
  "reasoning": "Kurze Begründung"
}}"""
    
    elif task_type == "flashcards":
        flashcards = output_json.get("flashcards", []) if output_json else []
        flashcards_text = json.dumps(flashcards, indent=2, ensure_ascii=False)
        
        prompt = f"""Bewerte KI-generierte Flashcards zu Vorlesungsmaterial.

Quelle: {judge_source}

Flashcards: {flashcards_text}

Bewertungsgrundlage: Quelltext ist EINZIGE Referenz. Prüfe nur Übereinstimmung, nicht absolute Korrektheit.

Bewerte auf Skala 1-100:
1. **Source Fidelity**: Entsprechen Flashcards dem Quelltext? Halluzinationen? (1=many errors, 100=perfect match)
2. **Completeness**: Werden wichtige Konzepte abgedeckt? (1=incomplete, 100=complete)
3. **Clarity**: Fragen/Aufgaben klar und verständlich? (1=unclear, 100=very clear)
4. **Memorability**: Gut zum Lernen geeignet? (1=bad, 100=excellent)
5. **Appropriate Detail**: Detailniveau angemessen? (1=inappropriate, 100=perfect)

Leere Flashcards = alle Scores 1.

Antworte NUR mit JSON:
{{
  "factual_accuracy": <1-100>,
  "completeness": <1-100>,
  "clarity": <1-100>,
  "memorability": <1-100>,
  "appropriate_detail": <1-100>,
  "reasoning": "Kurze Begründung"
}}"""
    
    else:
        raise ValueError(f"Unknown task type: {task_type}")
    
    return prompt


async def judge_with_model(
    client: ModelClient,
    model_id: str,
    task_type: str,
    source_text: str,
    output_text: str,
    output_json: Optional[Dict[str, Any]] = None,
    model_config: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Judge output using a single judge model."""
    prompt = build_judge_prompt(task_type, source_text, output_text, output_json)
    
    system_prompt = """Du bist ein Experte für die Bewertung von KI-generierten Lernmaterialien. 
Bewerte objektiv und konsistent. Nutze die volle Skala von 1-100."""
    
    result = await client.generate(
        model_id=model_id,
        system_prompt=system_prompt,
        user_prompt=prompt,
        max_tokens=500,
        temperature=0.1
    )
    
    # Update cost calculation with actual pricing if model_config provided
    if model_config and result.get("usage") and not result.get("error"):
        pricing = model_config.get("pricing", {})
        actual_cost = client._calculate_cost(
            model_id,
            result["usage"].get("prompt_tokens", 0),
            result["usage"].get("completion_tokens", 0),
            pricing
        )
        result["cost"] = actual_cost
    
    if result.get("error"):
        return {
            "model_id": model_id,
            "error": result["error"],
            "scores": {},
            "cost": 0.0
        }
    
    # Track judge cost
    judge_cost = result.get("cost", 0.0)
    
    # Check if response is empty
    if not result.get("text") or not result["text"].strip():
        return {
            "model_id": model_id,
            "error": "Empty response from judge model",
            "scores": {},
            "cost": judge_cost
        }
    
    # Try to parse JSON from response
    try:
        # Extract JSON from response (might have markdown code fences)
        text = result["text"].strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        
        if not text:
            return {
                "model_id": model_id,
                "error": "Empty JSON content after extraction",
                "scores": {},
                "raw_response": result["text"],
                "cost": judge_cost
            }
        
        scores = json.loads(text)
        
        # Ensure scores are in 1-100 range (clamp only, no conversion needed as prompts use 1-100)
        for key, value in scores.items():
            if key != "reasoning" and isinstance(value, (int, float)):
                # Clamp to 1-100
                scores[key] = max(1.0, min(100.0, float(scores[key])))
        
        return {
            "model_id": model_id,
            "error": None,
            "scores": scores,
            "reasoning": scores.get("reasoning", ""),
            "cost": judge_cost
        }
    except json.JSONDecodeError as e:
        return {
            "model_id": model_id,
            "error": f"Failed to parse JSON: {str(e)}",
            "scores": {},
            "raw_response": result["text"],
            "cost": judge_cost
        }


async def evaluate_with_consensus(
    judge_models: List[str],
    task_type: str,
    source_text: str,
    output_text: str,
    output_json: Optional[Dict[str, Any]] = None,
    client: Optional[ModelClient] = None,
    use_cache: bool = True,
    models_dict: Optional[Dict[str, Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Evaluate output using multiple judge models and aggregate scores.
    
    Returns:
        Dict with aggregated scores, individual judgments, consensus metrics
    """
    # Check if output is empty
    if not output_text or not output_text.strip():
        return {
            "error": "Empty output",
            "aggregated_scores": {
                "factual_accuracy": {"mean": 1.0, "median": 1.0, "min": 1.0, "max": 1.0, "std_dev": 0.0, "count": 0},
                "completeness": {"mean": 1.0, "median": 1.0, "min": 1.0, "max": 1.0, "std_dev": 0.0, "count": 0},
                "quality": {"mean": 1.0, "median": 1.0, "min": 1.0, "max": 1.0, "std_dev": 0.0, "count": 0}
            },
            "individual_judgments": [],
            "consensus_metrics": {},
            "judge_count": 0,
            "available_models": [],
            "total_judge_cost": 0.0
        }
    
    # Check cache
    hash_key = get_output_hash(output_text, task_type, source_text)
    if use_cache:
        cached = load_cached_judgment(hash_key)
        if cached:
            return cached
    
    # Use provided client or create new one
    if client is None:
        async with ModelClient() as client:
            return await _evaluate_consensus_internal(
                client, judge_models, task_type, source_text, output_text, output_json, hash_key, use_cache, models_dict
            )
    else:
        return await _evaluate_consensus_internal(
            client, judge_models, task_type, source_text, output_text, output_json, hash_key, use_cache, models_dict
        )


async def _evaluate_consensus_internal(
    client: ModelClient,
    judge_models: List[str],
    task_type: str,
    source_text: str,
    output_text: str,
    output_json: Optional[Dict[str, Any]],
    hash_key: str,
    use_cache: bool,
    models_dict: Optional[Dict[str, Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """Internal function to run consensus evaluation."""
    
    # Check model availability
    availability = await client.check_models_availability(judge_models)
    available_models = [m for m in judge_models if availability.get(m, False)]
    
    if not available_models:
        return {
            "error": "No judge models available",
            "scores": {},
            "judgments": [],
            "total_judge_cost": 0.0
        }
    
    # Run judgments in parallel
    tasks = [
        judge_with_model(
            client, 
            model_id, 
            task_type, 
            source_text, 
            output_text, 
            output_json,
            model_config=models_dict.get(model_id) if models_dict else None
        )
        for model_id in available_models
    ]
    judgments = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Filter out exceptions and track total judge cost
    valid_judgments = []
    total_judge_cost = 0.0
    for j in judgments:
        if isinstance(j, Exception):
            continue
        if j.get("error"):
            # Still count cost even if there was an error
            total_judge_cost += j.get("cost", 0.0)
            continue
        valid_judgments.append(j)
        total_judge_cost += j.get("cost", 0.0)
    
    if not valid_judgments:
        return {
            "error": "All judge models failed",
            "scores": {},
            "judgments": [],
            "total_judge_cost": total_judge_cost
        }
    
    # Aggregate scores
    all_score_keys = set()
    for j in valid_judgments:
        all_score_keys.update(j.get("scores", {}).keys())
    
    aggregated = {}
    individual_scores = {}
    
    for key in all_score_keys:
        if key == "reasoning":
            continue
        
        values = []
        for j in valid_judgments:
            score = j.get("scores", {}).get(key)
            if score is not None and isinstance(score, (int, float)):
                values.append(float(score))
        
        if values:
            individual_scores[key] = values
            aggregated[key] = {
                "mean": sum(values) / len(values),
                "median": sorted(values)[len(values) // 2],
                "min": min(values),
                "max": max(values),
                "std_dev": (
                    (sum((x - sum(values) / len(values)) ** 2 for x in values) / len(values)) ** 0.5
                    if len(values) > 1 else 0.0
                ),
                "count": len(values)
            }
    
    # Calculate consensus metrics
    consensus_metrics = {}
    if len(valid_judgments) > 1:
        # Calculate variance across judges for each score
        for key, values in individual_scores.items():
            if len(values) > 1:
                mean = sum(values) / len(values)
                variance = sum((x - mean) ** 2 for x in values) / len(values)
                consensus_metrics[f"{key}_variance"] = variance
                consensus_metrics[f"{key}_agreement"] = 1.0 / (1.0 + variance)  # Higher = more agreement
    
    result = {
        "aggregated_scores": aggregated,
        "individual_judgments": valid_judgments,
        "consensus_metrics": consensus_metrics,
        "judge_count": len(valid_judgments),
        "available_models": available_models,
        "total_judge_cost": total_judge_cost
    }
    
    # Cache result
    if use_cache:
        save_cached_judgment(hash_key, result)
    
    return result
