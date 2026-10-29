import time

import numpy as np
from sentence_transformers import SentenceTransformer

from bot.embedder import embed_texts

texts = [
    "hello",
    "what skills do i need to be a data scientist",
    "how much does a software engineer earn in the philippines",
    "pano mag-prepare para sa interview sa isang tech company",
    "architecture student jobs",
    "should i take a masters degree or work first",
    "asdfgh qwerty",
    "word " * 400,  # a very long text, gets truncated
]

old = SentenceTransformer("all-MiniLM-L6-v2").encode(texts, normalize_embeddings=True)
new = embed_texts(texts)

cosine = (old * new).sum(axis=1)
print("Lowest cosine between old and new:", float(cosine.min()))
print("Largest difference in any number: ", float(np.abs(old - new).max()))

start = time.perf_counter()
for _ in range(20):
    embed_texts(["what skills do i need to be a data scientist"])
print("ONNX time per message (ms):", round((time.perf_counter() - start) / 20 * 1000, 1))