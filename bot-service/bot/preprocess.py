import importlib.resources
import json
import re
from pathlib import Path

from symspellpy import SymSpell, Verbosity

from bot.lexicons import CS_TERMS, NON_CS_FIELDS

MAX_INPUT_CHARS = 600

CHAT_SHORTHAND = {
    "thx": "thanks", "tnx": "thanks", "ty": "thank you", "pls": "please", "plz": "please",
    "u": "you", "ur": "your", "abt": "about", "wat": "what", "wht": "what", "gud": "good",
    "mrng": "morning", "hru": "how are you", "idk": "i do not know",
    "helo": "hello", "hllo": "hello", "hellow": "hello", "hii": "hi", "heyy": "hey",
}

TAGALOG_WORDS = [
    "ako", "ikaw", "ang", "mga", "yung", "yun", "ito", "iyon", "para", "kung", "kapag",
    "kahit", "pero", "kasi", "naman", "lang", "din", "rin", "pwede", "puwede", "gusto", "ayaw",
    "dapat", "paano", "saan", "kailan", "bakit", "sino", "magkano", "ano", "ngayon", "bukas",
    "kanina", "salamat", "kamusta", "kumusta", "sige", "opo", "oo", "hindi", "wala", "meron",
    "mayroon", "tulong", "tulungan", "trabaho", "sahod", "sweldo", "maghanap", "hanap",
    "hanapin", "aral", "aaral", "pag-aralan", "magandang", "maganda", "tamang", "bagong", "bago",
    "malaman", "tignan", "tingnan", "ibigay", "makakuha", "kumita", "kita", "umaga", "hapon",
    "gabi", "ingat", "paalam", "walang", "anuman", "nga", "pala", "kayo", "kami",
    "tayo", "siya", "sila", "niya", "nila", "akin", "atin", "mag", "nag", "pag", "mas",
]

TECH_WORDS = [
    "cybersecurity", "devops", "mlops", "frontend", "backend", "fullstack", "sysadmin", "bscs",
    "bsit", "bsis", "bscpe", "ojt", "comsci", "compsci", "taglish", "linkedin", "jobstreet",
    "upwork", "fiverr", "github", "gitlab", "leetcode", "hackerrank", "tensorflow", "pytorch",
    "keras", "numpy", "pandas", "nodejs", "mongodb", "mysql", "postgresql", "nosql", "docker",
    "kubernetes", "django", "flask", "fastapi", "angular", "typescript", "javascript", "kotlin",
    "golang", "figma", "tableau", "powerbi", "chatgpt", "openai", "fintech", "blockchain",
    "freelancer", "upskill", "reskill", "roadmap", "bootcamp", "infosec", "pentest", "nlp",
]

FILIPINO_WORDS = {
    "po", "opo", "ano", "paano", "saan", "magkano", "pwede", "puwede", "gusto", "dapat", "bakit",
    "kasi", "naman", "lang", "para", "salamat", "kamusta", "kumusta", "sahod", "sweldo", "trabaho",
    "yung", "ng", "mga", "ako", "ko", "mo", "ba", "hindi", "sige", "tulong", "tulungan", "ngayon",
    "magandang", "umaga", "hapon", "gabi", "ang", "kung", "pag-aralan", "aralin", "malapit", "dito",
}
FILIPINO_PREFIX = re.compile(r"\b(?:mag|nag|pag)-[a-z]+")


# words from your training data, exported in step 1
VOCAB_PATH = Path(__file__).resolve().parent.parent / "artifacts" / "vocab.json"
DATASET_WORDS = json.loads(VOCAB_PATH.read_text(encoding="utf-8"))


def is_filipino(text):
    # true if the message as Filipion or Taglish words (also picks the reply language)
    lowered = text.lower()
    words = set(re.findall(r"[a-z]+(?:[-'][a-z]+)*", lowered))
    return bool(words & FILIPINO_WORDS) or bool(FILIPINO_PREFIX.search(lowered))

def _words(text):
    return re.findall(r"[a-z]+", text.lower())

def _build_spellchecker():
    # symspell finds the closest known word within 1 or 2 letter edits
    sym = SymSpell(max_dictionary_edit_distance=2, prefix_length=7)
    dict_path = str(importlib.resources.files("symspellpy").joinpath("frequency_dictionary_en_82_765.txt"))
    sym.load_dictionary(dict_path, term_index=0, count_index=1)

    # domain words get a huge count so they beat look-alike english words
    domain_words = set(TECH_WORDS)
    for term in CS_TERMS + NON_CS_FIELDS:
        domain_words.update(_words(term))
    for w in domain_words:
        if len(w) >= 4:
            sym.create_dictionary_entry(w, 10**10)

    # taglish and dataset words become valid, so they are never "corrected"
    for w in set(TAGALOG_WORDS) | set(DATASET_WORDS):
        if len(w) >= 4 and w not in sym.words:
            sym.create_dictionary_entry(w, 10**7)
    return sym


spell = _build_spellchecker()


def correct_word(word):
    lower = word.lower()
    # leave short words, acronyms (BSCS), contradictions, and hyphenated words alone
    if len(lower) < 4 or word.isupper() or "'" in lower or "-" in lower:
        return word
    max_edit = 1 if len(lower) <= 7 else 2
    suggestions = spell.lookup(lower, Verbosity.TOP, max_edit_distance=max_edit)
    return suggestions[0].term if suggestions else word


WORD_RE = re.compile(r"[A-Za-z]+(?:['\-][A-Za-z]+)*")


WORD_RE = re.compile(r"[A-Za-z]+(?:['\-][A-Za-z]+)*")


def normalize_query(text):
    # trim, expand shorthand, fix typos, lowercase. Returns (cleaned_text, was_changed)
    original = re.sub(r"\s+", " ", (text or "").strip())[:MAX_INPUT_CHARS]

    def fix(match):
        word = match.group(0)
        if word.lower() in CHAT_SHORTHAND:
            return CHAT_SHORTHAND[word.lower()]
        return correct_word(word)

    fixed = WORD_RE.sub(fix, original).lower()
    return fixed, fixed != original.lower()