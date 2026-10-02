from __future__ import annotations

import os
import threading
import time
from dataclasses import dataclass

import cv2
import numpy as np
import onnxruntime as ort

_ORT_THREADS = max(1, int(os.environ.get("FACE_ORT_THREADS", "1")))
_OrigSessionOptions = ort.SessionOptions


def _limited_session_options() -> ort.SessionOptions:
    opts = _OrigSessionOptions()
    opts.intra_op_num_threads = _ORT_THREADS
    opts.inter_op_num_threads = 1
    opts.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
    return opts


# uniface cria as sessões sem controle de threads; sem isto o ORT usa todos os núcleos da VPS.
ort.SessionOptions = _limited_session_options  # type: ignore[assignment]

from uniface.constants import MiniFASNetWeights, MobileFaceWeights, RetinaFaceWeights  # noqa: E402
from uniface.detection import RetinaFace  # noqa: E402
from uniface.recognition import MobileFace  # noqa: E402
from uniface.spoofing import MiniFASNet  # noqa: E402

CPU = ["CPUExecutionProvider"]

DETECTOR_NAME = os.environ.get("FACE_DETECTOR", RetinaFaceWeights.MNET_V2.value)
RECOGNIZER_NAME = os.environ.get("FACE_RECOGNIZER", MobileFaceWeights.MNET_V2.value)
SPOOFER_NAMES = [
    s.strip()
    for s in os.environ.get(
        "FACE_SPOOFERS", f"{MiniFASNetWeights.V2.value},{MiniFASNetWeights.V1SE.value}"
    ).split(",")
    if s.strip()
]
DET_SIZE = int(os.environ.get("FACE_DET_SIZE", "320"))
MAX_SIDE = int(os.environ.get("FACE_MAX_SIDE", "640"))
DET_CONFIDENCE = float(os.environ.get("FACE_DET_CONFIDENCE", "0.6"))
# Rostos menores que esta fração do maior são tratados como fundo (ex.: pessoas passando atrás).
SECONDARY_FACE_RATIO = float(os.environ.get("FACE_SECONDARY_RATIO", "0.35"))

MODEL_ID = f"{RECOGNIZER_NAME}"


def build_models() -> tuple[RetinaFace, MobileFace, list[MiniFASNet]]:
    detector = RetinaFace(
        model_name=RetinaFaceWeights(DETECTOR_NAME),
        confidence_threshold=DET_CONFIDENCE,
        input_size=(DET_SIZE, DET_SIZE),
        providers=CPU,
    )
    recognizer = MobileFace(model_name=MobileFaceWeights(RECOGNIZER_NAME), providers=CPU)
    spoofers = [MiniFASNet(model_name=MiniFASNetWeights(n), providers=CPU) for n in SPOOFER_NAMES]
    return detector, recognizer, spoofers


class ImageError(ValueError):
    pass


def decode_image(data: bytes) -> np.ndarray:
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ImageError("imagem inválida ou formato não suportado")
    h, w = img.shape[:2]
    scale = MAX_SIDE / max(h, w)
    if scale < 1:
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    return img


@dataclass
class Analysis:
    faces: int
    bbox: list[float] | None
    det_score: float | None
    embedding: np.ndarray | None
    is_real: bool | None
    liveness: float | None
    quality: dict | None
    timings_ms: dict


def _quality(img: np.ndarray, bbox: np.ndarray) -> dict:
    h, w = img.shape[:2]
    x1, y1, x2, y2 = [int(v) for v in bbox]
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(w, x2), min(h, y2)
    crop = img[y1:y2, x1:x2]
    if crop.size == 0:
        return {"blur": 0.0, "brightness": 0.0, "faceRatio": 0.0}
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    return {
        "blur": round(float(cv2.Laplacian(gray, cv2.CV_64F).var()), 2),
        "brightness": round(float(gray.mean()), 2),
        "faceRatio": round(((x2 - x1) * (y2 - y1)) / float(w * h), 4),
    }


class FaceEngine:
    def __init__(self) -> None:
        self.detector, self.recognizer, self.spoofers = build_models()
        self._lock = threading.Lock()

    def acquire(self, timeout: float) -> bool:
        return self._lock.acquire(timeout=timeout)

    def release(self) -> None:
        self._lock.release()

    def analyze(self, img: np.ndarray) -> Analysis:
        t: dict[str, float] = {}
        t0 = time.perf_counter()
        detected = self.detector.detect(img)
        t["detect"] = (time.perf_counter() - t0) * 1000
        if not detected:
            return Analysis(0, None, None, None, None, None, None, _round(t))

        def area(f) -> float:
            b = f.bbox
            return float((b[2] - b[0]) * (b[3] - b[1]))

        detected = sorted(detected, key=area, reverse=True)
        main = detected[0]
        relevant = sum(1 for f in detected if area(f) >= area(main) * SECONDARY_FACE_RATIO)

        t1 = time.perf_counter()
        emb = np.asarray(self.recognizer.get_normalized_embedding(img, main.landmarks), dtype=np.float32).reshape(-1)
        t["embed"] = (time.perf_counter() - t1) * 1000

        t2 = time.perf_counter()
        scores = []
        for spoofer in self.spoofers:
            r = spoofer.predict(img, main.bbox)
            scores.append(float(r.confidence) if r.is_real else 1.0 - float(r.confidence))
        t["liveness"] = (time.perf_counter() - t2) * 1000
        liveness = sum(scores) / len(scores)

        return Analysis(
            faces=relevant,
            bbox=[round(float(v), 1) for v in main.bbox],
            det_score=round(float(main.confidence), 4),
            embedding=emb,
            is_real=liveness >= 0.5,
            liveness=round(liveness, 4),
            quality=_quality(img, main.bbox),
            timings_ms=_round(t),
        )


def _round(t: dict[str, float]) -> dict:
    return {k: round(v, 1) for k, v in t.items()}


def cosine(a: np.ndarray, b: np.ndarray) -> float:
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(a, b) / (na * nb))
