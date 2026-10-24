import random

from bot.llm import prepare_answer
from bot.preprocess import MAX_INPUT_CHARS, is_filipino
from bot.responses import (ALL_GREETING_TEXTS, CLARIFY_MESSAGE,
                           GREETING_RESPONSES, REFUSAL_MESSAGE)
from bot.router import route_message

MAX_HISTORY_TURNS = 6  # how many earlier turns the model sees

def previous_turn_was_answer(history_msgs):
    # true if the last bot message was a real answer (not a refusal, clarification or greeting)
    last = next((m["content"] for m in reversed(history_msgs) if m["role"] == "assistant"), "")
    if not last:
        return False
    if last.startswith(REFUSAL_MESSAGE[:30]) or last.startswith(CLARIFY_MESSAGE[:25]):
        return False
    return last not in ALL_GREETING_TEXTS


def respond(history, message):
    # returns (decision, pieces). decision["action"] is the final route
    message = (message or "")[:MAX_INPUT_CHARS]
    history_msgs = history[-2 * MAX_HISTORY_TURNS:]
    d = route_message(message, in_conversation=previous_turn_was_answer(history_msgs))

    if d["action"] == "greeting":
        options = GREETING_RESPONSES[d["greeting_kind"]]
        if not is_filipino(message):
            options = [o for o in options if not o.startswith(("Kumusta", "Walang anuman", "Ingat"))] or options
        pieces = iter([random.choice(options)])
    elif d["action"] == "refuse":
        pieces = iter([REFUSAL_MESSAGE])
    elif d["action"] == "clarify":
        pieces = iter([CLARIFY_MESSAGE])
    else:
        d["action"], pieces = prepare_answer(d, message, history_msgs)

    return d, pieces