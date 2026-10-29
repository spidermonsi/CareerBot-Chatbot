import json
from pathlib import Path

import numpy as np
import re

from bot.lexicons import find_non_cs_fields, has_cs_signal
from bot.preprocess import MAX_INPUT_CHARS, normalize_query
from bot.responses import greeting_kind
from bot.embedder import embed_texts

THRESHOLD = 0.35          # below this similarity, the classifier is unsure
MAX_FOLLOWUP_WORDS = 10   # short messages mid-conversation count as follow ups
KEYWORD_BOOST = 0.15      # a small nudge for messages containing intent keywords

CENTROIDS_PATH = Path(__file__).resolve().parent.parent / "artifacts" / "centroids.json"


_raw = json.loads(CENTROIDS_PATH.read_text(encoding="utf-8"))
centroids = {name: np.array(vec, dtype=np.float32) for name, vec in _raw.items()}
INTENT_NAMES = list(centroids.keys())
CENTROID_MATRIX = np.stack([centroids[n] for n in INTENT_NAMES])
CAREER_INTENTS = [i for i in INTENT_NAMES if i not in ("greeting_smalltalk", "out_of_scope")]


KEYWORD_PATTERNS = {name: re.compile(p) for name, p in {
    "salary_compensation": r"\b(sahod|sweldo|suweldo|magkano|salary|salaries|earn|earning|earnings|compensation|kita|pay)\b",
    "internship_job_search": r"\b(internship|internships|intern|ojt|hiring|job openings?|job boards?|recruiters?)\b",
    "resume_portfolio_guidance": r"\b(resume|cv|portfolio|cover letter)\b",
    "interview_preparation": r"\b(interview|interviews|interviewer|whiteboard)\b",
    "further_studies": r"\b(master'?s|masters|phd|grad school|graduate school|scholarship|scholarships|postgraduate)\b",
    "role_comparison": r"\b(vs|versus|difference between|differ|differs|compare|comparison|pagkakaiba)\b",
    "skill_recommendation": r"\b(skills?|roadmap|pag-aralan|aralin|certifications?|frameworks?)\b",
}.items()}



def rank_intents(text):
    # similarity to every intent centroid plus small keyword boost, best first
    emb = embed_texts([text])
    sims = (emb @ CENTROID_MATRIX.T)[0].copy()
    for i, name in enumerate(INTENT_NAMES):
        pattern = KEYWORD_PATTERNS.get(name)
        if pattern and pattern.search(text):
            sims[i] += KEYWORD_BOOST
    order = np.argsort(sims)[::-1]
    return [(INTENT_NAMES[i], float(sims[i])) for i in order]


def route_message(message, in_conversation=False):
    # returns a dict whose "action" is: greeting, refuse, clarify, or answer
    raw = (message or "").strip()[:MAX_INPUT_CHARS]
    normalized, corrected = normalize_query(raw)
    result = {"action": "clarify", "intent": None, "intent_hint": None, "score": 0.0,
              "greeting_kind": None, "normalized": normalized, "corrected": corrected, "reason": ""}
    if not normalized:
        result["reason"] = "empty"
        return result

    kind = greeting_kind(normalized)
    cs = has_cs_signal(raw, normalized)
    non_cs = find_non_cs_fields(normalized)


    # rule 1: short pure greetings skip the model entirely
    short_enough = len(normalized.split()) <= (8 if kind == "help" else 4)
    if kind and short_enough and not cs and not non_cs:
        result.update(action="greeting", intent="greeting_smalltalk", greeting_kind=kind,
                      score=1.0, reason="greeting_fast_path")
        return result

    ranked = rank_intents(normalized)
    top_intent, top_score = ranked[0]
    career_hint = next((n for n, _ in ranked if n in CAREER_INTENTS), None)
    result.update(intent=top_intent, score=top_score)


    # rule 2: another field is named and no computing term is present
    if non_cs and not cs:
        result.update(action="refuse", reason="non_cs_field: " + ", ".join(non_cs))
        return result

    if not cs:
        # rule 3: the classifier says it's a greeting
        if top_intent == "greeting_smalltalk" and top_score >= THRESHOLD:
            result.update(action="greeting", greeting_kind=kind or "hello", reason="greeting_intent")
            return result
        
        # rule 4: the classifier says it's out of scope
        if top_intent == "out_of_scope" and top_score >= THRESHOLD:
            result.update(action="refuse", reason="out_of_scope_intent")
            return result

        # rule 5: the classifier is unsure
        if top_score < THRESHOLD:
            if in_conversation and len(normalized.split()) <= MAX_FOLLOWUP_WORDS:
                result.update(action="answer", intent_hint="follow_up", reason="follow_up")
            elif top_intent == "out_of_scope":
                result.update(action="refuse", reason="out_of_scope_low_score")
            else:
                result.update(action="clarify", reason="low_confidence")
            return result

        # rule 6: everything else gets an answer
    hint = top_intent if top_intent in CAREER_INTENTS else career_hint
    result.update(action="answer", intent_hint=hint, reason="cs_term" if cs else "career_intent")
    return result