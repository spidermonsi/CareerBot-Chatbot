import re

GREETING_PATTERNS = [  # checked in this order, so "thanks, bye" counts as a goodbye
    ("bye", re.compile(r"\b(bye|goodbye|see you|see ya|talk to you later|nice talking|nice chatting|ingat|paalam)\b")),
    ("thanks", re.compile(r"\b(thanks?|thank you|salamat|appreciate|helpful|helped)\b")),
    ("hello", re.compile(r"^\W*(hi+|hello+|hey+|heya|yo|hola|kamusta|kumusta|good (morning|afternoon|evening|day)|magandang (umaga|hapon|gabi|araw)|nice to meet you)\b")),
    ("help", re.compile(r"\b(can you help|pwede mo ba ako tulungan|need (some )?(career )?(advice|help))\b")),
]


def greeting_kind(normalized):
    # returns "bye", "thanks, "hello", "help", or None
    for kind, pattern in GREETING_PATTERNS:
        if pattern.search(normalized):
            return kind
    return None


GREETING_RESPONSES = {
    "hello": [
        "Hi! I'm CareerBot, a career guide for Computer Studies students. Ask me about career paths, skills, resumes, internships, interviews, further studies, or salaries.",
        "Hello! What would you like to know about your computing career today?",
        "Kumusta! I can help with career questions for BSCS, BSIT, BSIS, and BSCpE students. What do you need?",
    ],
    "thanks": [
        "You're welcome! Let me know if you have more career questions.",
        "Walang anuman! Ask me anything else about your career path.",
        "Glad it helped. Anything else you want to go through?",
    ],
    "bye": [
        "Goodbye! Good luck with your career plans.",
        "See you! Come back anytime you need career advice.",
        "Ingat! Good luck with your applications.",
    ],
    "help": [
        "Sure. What do you need: career paths, skills to learn, resume tips, internships, interview prep, further studies, or salary info?",
        "Of course. Tell me what you're working on and I'll guide you.",
    ],
}
ALL_GREETING_TEXTS = {t for options in GREETING_RESPONSES.values() for t in options}

REFUSAL_MESSAGE = (
    "I'm sorry, but I can only help with career questions for Computer Studies students "
    "(BSCS, BSIT, BSIS, and BSCpE). I can't advise on other fields or unrelated topics. "
    "If you want to move into a computing career, tell me and I can help with that."
)

CLARIFY_MESSAGE = (
    "I didn't quite catch that. Could you rephrase it? I can help with career paths, skills to learn, "
    "resumes, internships, interviews, further studies, role comparisons, and salaries in computing."
)

GENERIC_FALLBACK = (
    "I can help with computing careers, including career paths, skills, resumes, internships, interviews, "
    "further studies, role comparisons, and salaries. Tell me a bit more about what you want to know."
)

FALLBACK_RESPONSES = {
    "career_path_exploration": (
        "Common paths for computing graduates include software development, data science and analytics, "
        "cybersecurity, cloud and DevOps, QA testing, and UI/UX. Pick the area you enjoy most (building apps, "
        "working with data, or securing systems) and try a small project in it. Tell me your interests and I can narrow the options."
    ),
    "skill_recommendation": (
        "Start with one programming language (Python or JavaScript are common picks), then learn data structures, "
        "Git, and databases. After that, add skills for your target role, such as SQL and statistics for data work "
        "or React and Node.js for web development. Tell me the role you want and I can suggest a roadmap."
    ),
    "resume_portfolio_guidance": (
        "Keep your resume to one page, lead with projects and skills, and describe each project by what you built, "
        "the tools you used, and the result. Put your best projects on GitHub with clear READMEs. "
        "Tell me which part you're stuck on and I can help you draft it."
    ),
    "internship_job_search": (
        "Check LinkedIn, JobStreet, Indeed, and your school's OJT office, and apply early to many openings. "
        "Tailor your resume for each one and reach out to recruiters directly. "
        "Tell me your target role and I can suggest how to approach it."
    ),
    "interview_preparation": (
        "Review data structures and algorithms, practice explaining your projects out loud, and prepare short answers "
        "for common behavioral questions like 'tell me about yourself'. Practice coding problems on a platform like LeetCode. "
        "Tell me the interview type and I can give you practice questions."
    ),
    "further_studies": (
        "A master's degree helps most for research, AI and ML specialization, or teaching, while many software roles "
        "value experience and projects more. If you're unsure, consider working first, and check for scholarships before applying. "
        "Tell me your goal and I can compare the options."
    ),
    "role_comparison": (
        "Roles differ mainly in focus. For example, data analysts work on reporting and insights, data scientists build "
        "predictive models, and ML engineers deploy models into products. Tell me which two roles you're comparing "
        "and I can go through the differences."
    ),
    "salary_compensation": (
        "Pay varies a lot by company, location, and skills, and I can't give exact figures without current data. "
        "Check recent job postings and salary reports for your target role and city, and compare total benefits, not only base pay. "
        "Tell me the role and I can help you prepare for a salary discussion."
    ),
}