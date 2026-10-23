import re

# words that show a message is about computing
CS_TERMS = [
    # programs and fields
    "cs", "bscs", "bsit", "bsis", "bscpe", "comsci", "compsci", "computer science", "computer studies",
    "computer engineering", "information technology", "information systems", "computing", "computer",
    "tech", "software", "software engineering", "software engineer", "programming", "programmer",
    "coding", "coder", "code", "developer", "dev", "devops", "web development", "web dev",
    "mobile development", "app development", "data science", "data scientist", "data analyst",
    "data analytics", "data engineer", "machine learning", "deep learning", "ml", "ai",
    "artificial intelligence", "nlp", "cybersecurity", "cyber security", "cyber", "infosec",
    "ethical hacking", "penetration testing", "pentest", "it support", "network engineer",
    "network administrator", "sysadmin", "database", "cloud", "frontend", "front-end", "backend",
    "back-end", "fullstack", "full-stack", "full stack", "qa", "quality assurance", "ui", "ux",
    "ui/ux", "algorithm", "algorithms", "data structures", "leetcode", "scrum", "agile",
    # tools and languages
    "python", "java", "javascript", "typescript", "react", "nodejs", "sql", "mysql", "mongodb",
    "aws", "azure", "gcp", "docker", "kubernetes", "linux", "git", "github", "html", "css", "php",
    "android", "tensorflow", "pytorch", "kotlin", "golang",
]


# names of other fields (the router refuses these)
NON_CS_FIELDS = [
    "architecture", "architectural", "nursing", "nurse", "medicine", "medical", "doctor", "physician",
    "pharmacy", "pharmacist", "dentistry", "dentist", "veterinary", "law", "lawyer", "attorney",
    "accountancy", "accountant", "accounting", "bookkeeping", "marketing", "business administration",
    "hospitality", "hotel management", "tourism", "culinary", "chef", "teacher", "teaching",
    "psychology", "psychologist", "biology", "chemistry", "physics", "civil engineering",
    "mechanical engineering", "electrical engineering", "chemical engineering",
    "industrial engineering", "electronics engineering", "mining engineering", "agriculture",
    "farmer", "farming", "criminology", "fine arts", "fashion design", "interior design",
    "journalism", "mass communication", "political science", "economics", "banking", "finance",
    "real estate", "aviation", "pilot", "seaman", "maritime", "nutrition", "physical therapy",
    "midwifery", "social work", "theology", "literature",
]


def _term_pattern(terms):
    # longest terms first, so "computer science" matches before "computer"
    ordered = sorted(set(terms), key=len, reverse=True)

    # whole words only, so "it" does not match inside "architecture"
    return re.compile(r"(?<![\w])(?:" + "|".join(re.escape(t) for t in ordered) + r")(?![\w])")


CS_PATTERN = _term_pattern(CS_TERMS)
NON_CS_PATTERNS = _term_pattern(NON_CS_FIELDS)


def has_cs_signal(raw, normalized):
    # true if a computing term appears. uppercase "IT" is checked on the raw text
    return bool(CS_PATTERN.search(normalized)) or bool(re.search(r"\bIT\b", raw))


def find_non_cs_fields(normalized):
    # returns the non-computin fields mentioned, or an empty list
    return sorted({m.group(0) for m in NON_CS_PATTERNS.finditer(normalized)})