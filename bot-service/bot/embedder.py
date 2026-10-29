from pathlib import Path

import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer

MODEL_DIR = Path(__file__).resolve().parent.parent / "artifacts" / "minilm"
MAX_TOKENS = 256

# splits text into word pieces and turns them into numbers
tokenizer = Tokenizer.from_file(str(MODEL_DIR / "tokenizer.json"))
tokenizer.enable_truncation(max_length=MAX_TOKENS)
tokenizer.enable_padding(pad_id=0, pad_token="[PAD]")

# loaded once when the server starts
session = ort.InferenceSession(
    str(MODEL_DIR / "onnx" / "model.onnx"),
    providers=["CPUExecutionProvider"],
)
INPUT_NAMES = {i.name for i in session.get_inputs()}


def embed_texts(texts):
    # turns a list of texts into normalized 384-number vectors
    encodings = tokenizer.encode_batch(list(texts))
    ids = np.array([e.ids for e in encodings], dtype=np.int64)
    mask = np.array([e.attention_mask for e in encodings], dtype=np.int64)

    feed = {"input_ids": ids, "attention_mask": mask}
    if "token_type_ids" in INPUT_NAMES:
        feed["token_type_ids"] = np.zeros_like(ids)

    output = session.run(None, feed)[0]

    if output.ndim == 3:
        # mean pooling: average the word vectors, ignoring the padding
        m = mask[..., None].astype(np.float32)
        pooled = (output * m).sum(axis=1) / np.clip(m.sum(axis=1), 1e-9, None)
    else:
        pooled = output  # the model already pooled it

    # scale each vector to length 1, so cosine similarity is a simple dot product
    norms = np.linalg.norm(pooled, axis=1, keepdims=True)
    return (pooled / np.clip(norms, 1e-12, None)).astype(np.float32)