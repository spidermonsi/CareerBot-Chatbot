import os
import time

import psutil

proc = psutil.Process(os.getpid())


def mb():
    return proc.memory_info().rss / 1024**2


print(f"Python alone:                 {mb():5.0f} MB")

t = time.perf_counter()
import bot.preprocess  # builds the spellchecker

print(f"+ spellchecker:               {mb():5.0f} MB   ({time.perf_counter() - t:.1f} s)")

t = time.perf_counter()
import bot.embedder  # loads the ONNX model

print(f"+ ONNX model:                 {mb():5.0f} MB   ({time.perf_counter() - t:.1f} s)")

t = time.perf_counter()
import bot.chatbot  # router, centroids, Groq client

print(f"+ router and the rest:        {mb():5.0f} MB   ({time.perf_counter() - t:.1f} s)")