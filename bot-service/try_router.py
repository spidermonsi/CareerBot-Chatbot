from bot.router import route_message

tests = [
    "hellow",
    "what skills do i need to be a data scientist",
    "architecture student jobs",
    "how much does a nurse earn",
    "asdfgh qwerty"
]


for t in tests:
    d = route_message(t)
    print(f"{t!r:50} -> {d['action']:9} {d['intent']} {d['score']:.2f} ({d['reason']})")