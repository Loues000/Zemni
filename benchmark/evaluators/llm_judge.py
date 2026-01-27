"""LLM judge with multi-model consensus evaluation."""
import asyncio
import hashlib
import json
import os
from pathlib import Path
from typing import Dict, Any, List, Optional
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from benchmark.models.client import ModelClient


JUDGE_CACHE_DIR = Path(__file__).parent.parent / "results" / "judge_cache"
JUDGE_CACHE_DIR.mkdir(parents=True, exist_ok=True)


def get_output_hash(output_text: str, task_type: str, source_text: str) -> str:
    """Generate hash for caching judge evaluations."""
    content = f"{task_type}:{output_text}:{source_text[:500]}"
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
    
    if task_type == "summary":
        prompt = f"""Du bewertest eine KI-generierte Zusammenfassung von Vorlesungsmaterial.

Quelle (Originaltext):
{source_text[:2000]}

Generierte Zusammenfassung:
{output_text}

Bewerte die Zusammenfassung auf einer Skala von 1-100 für folgende Kriterien:

1. **Factual Accuracy (Faktische Genauigkeit)**: Entspricht die Ausgabe dem Quellmaterial? Gibt es Halluzinationen oder Fehler? (1 = viele Fehler, 100 = perfekt)
2. **Completeness (Vollständigkeit)**: Werden alle wichtigen Konzepte aus der Quelle abgedeckt? Fehlt etwas Wichtiges? (1 = unvollständig, 100 = vollständig)
3. **Quality (Qualität)**: Wie nützlich ist die Zusammenfassung für die Prüfungsvorbereitung? Ist sie klar strukturiert und verständlich? (1 = unbrauchbar, 100 = ausgezeichnet)
4. **LaTeX Correctness**: Sind mathematische Formeln korrekt escaped (inline: $...$ oder \\(...\\), Display: $$...$$ oder \\[...\\]) und renderbar? (1 = fehlerhaft, 100 = perfekt)

WICHTIG: Wenn die Zusammenfassung leer ist oder keine Inhalte hat, gib für alle Scores 1 (nicht 0).

Antworte NUR mit einem JSON-Objekt im folgenden Format:
{{
  "factual_accuracy": <1-100>,
  "completeness": <1-100>,
  "quality": <1-100>,
  "latex_correctness": <1-100>,
  "reasoning": "Kurze Begründung für die Scores"
}}"""
    
    elif task_type == "quiz":
        questions = output_json.get("questions", []) if output_json else []
        questions_text = json.dumps(questions, indent=2, ensure_ascii=False)
        
        prompt = f"""Du bewertest KI-generierte Quiz-Fragen zu Vorlesungsmaterial.

Quelle (Originaltext):
{source_text[:2000]}

Generierte Quiz-Fragen:
{questions_text}

Bewerte die Quiz-Fragen auf einer Skala von 1-100 für folgende Kriterien:

1. **Factual Accuracy**: Entsprechen die Fragen und Antworten dem Quellmaterial? Gibt es Halluzinationen? (1 = viele Fehler, 100 = perfekt)
2. **Completeness**: Werden wichtige Konzepte aus der Quelle abgedeckt? (1 = unvollständig, 100 = vollständig)
3. **Question Quality**: Sind die Fragen klar, relevant und prüfungsorientiert? (1 = schlecht, 100 = ausgezeichnet)
4. **Distractor Quality**: Sind die Distraktoren plausibel und nicht offensichtlich falsch? (1 = offensichtlich falsch, 100 = sehr plausibel)
5. **Pedagogical Usefulness**: "Ist die Erklärung in den Quiz-Antworten so hilfreich, dass ein Student den Fehler versteht, ohne Google zu nutzen?" (1 = nicht hilfreich, 100 = sehr hilfreich)

WICHTIG: Wenn die Quiz-Fragen leer sind oder keine Inhalte haben, gib für alle Scores 1 (nicht 0).

Antworte NUR mit einem JSON-Objekt im folgenden Format:
{{
  "factual_accuracy": <1-100>,
  "completeness": <1-100>,
  "question_quality": <1-100>,
  "distractor_quality": <1-100>,
  "pedagogical_usefulness": <1-100>,
  "reasoning": "Kurze Begründung für die Scores"
}}"""
    
    elif task_type == "flashcards":
        flashcards = output_json.get("flashcards", []) if output_json else []
        flashcards_text = json.dumps(flashcards, indent=2, ensure_ascii=False)
        
        prompt = f"""Du bewertest KI-generierte Flashcards zu Vorlesungsmaterial.

Quelle (Originaltext):
{source_text[:2000]}

Generierte Flashcards:
{flashcards_text}

Bewerte die Flashcards auf einer Skala von 1-100 für folgende Kriterien:

1. **Factual Accuracy**: Entsprechen die Flashcards dem Quellmaterial? Gibt es Halluzinationen? (1 = viele Fehler, 100 = perfekt)
2. **Completeness**: Werden wichtige Konzepte abgedeckt? (1 = unvollständig, 100 = vollständig)
3. **Clarity**: Sind die Fragen/Aufgaben klar und verständlich? (1 = unklar, 100 = sehr klar)
4. **Memorability**: Sind die Flashcards gut zum Lernen geeignet? (1 = schlecht, 100 = ausgezeichnet)
5. **Appropriate Detail**: Ist das Detailniveau angemessen (nicht zu oberflächlich, nicht zu detailliert)? (1 = unangemessen, 100 = perfekt)

WICHTIG: Wenn die Flashcards leer sind oder keine Inhalte haben, gib für alle Scores 1 (nicht 0).

Antworte NUR mit einem JSON-Objekt im folgenden Format:
{{
  "factual_accuracy": <1-100>,
  "completeness": <1-100>,
  "clarity": <1-100>,
  "memorability": <1-100>,
  "appropriate_detail": <1-100>,
  "reasoning": "Kurze Begründung für die Scores"
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
Bewerte objektiv und konsistent. Nutze die volle Skala von 0-10."""
    
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
    
    # Try to parse JSON from response
    try:
        # Extract JSON from response (might have markdown code fences)
        text = result["text"].strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        
        scores = json.loads(text)
        
        # Ensure scores are in 1-100 range and convert from 0-10 if needed
        for key, value in scores.items():
            if key != "reasoning" and isinstance(value, (int, float)):
                # If score is 0-10, convert to 1-100
                if 0 <= value <= 10:
                    if value == 0:
                        scores[key] = 1.0  # Minimum is 1, not 0
                    else:
                        scores[key] = (value / 10.0) * 100.0
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
