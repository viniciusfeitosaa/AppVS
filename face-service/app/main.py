from __future__ import annotations

import hmac
import json
import logging
import os
import time

import numpy as np
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile

from .engine import MODEL_ID, FaceEngine, ImageError, cosine, decode_image

logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("face-service")

TOKEN = os.environ.get("FACE_SERVICE_TOKEN", "")
MAX_BYTES = int(os.environ.get("FACE_MAX_UPLOAD_BYTES", str(5 * 1024 * 1024)))
QUEUE_WAIT_S = float(os.environ.get("FACE_QUEUE_WAIT_S", "8"))
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}

ENROLL_MIN_FACE_RATIO = float(os.environ.get("FACE_ENROLL_MIN_FACE_RATIO", "0.06"))
ENROLL_MIN_BLUR = float(os.environ.get("FACE_ENROLL_MIN_BLUR", "30"))
ENROLL_MIN_BRIGHTNESS = float(os.environ.get("FACE_ENROLL_MIN_BRIGHTNESS", "45"))
ENROLL_MAX_BRIGHTNESS = float(os.environ.get("FACE_ENROLL_MAX_BRIGHTNESS", "225"))
# Recusa só spoof evidente; faixa intermediária segue para o Master via score devolvido.
ENROLL_MIN_LIVENESS = float(os.environ.get("FACE_ENROLL_MIN_LIVENESS", "0.30"))

if not TOKEN:
    raise RuntimeError("FACE_SERVICE_TOKEN é obrigatório")

app = FastAPI(title="face-service", docs_url=None, redoc_url=None, openapi_url=None)
engine = FaceEngine()
log.info("modelos carregados (recognizer=%s)", MODEL_ID)


def require_token(x_face_token: str = Header(default="")) -> None:
    if not hmac.compare_digest(x_face_token.encode(), TOKEN.encode()):
        raise HTTPException(status_code=401, detail="token inválido")


async def _read_image(image: UploadFile) -> np.ndarray:
    if (image.content_type or "").lower() not in ALLOWED_MIME:
        raise HTTPException(status_code=415, detail="use JPEG, PNG ou WebP")
    data = await image.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="imagem acima do limite")
    try:
        return decode_image(data)
    except ImageError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


def _run(img: np.ndarray):
    if not engine.acquire(QUEUE_WAIT_S):
        raise HTTPException(status_code=503, detail="serviço ocupado, tente novamente")
    try:
        return engine.analyze(img)
    finally:
        engine.release()


def _motivo_enroll(a) -> str | None:
    if a.faces == 0:
        return "NENHUM_ROSTO"
    if a.faces > 1:
        return "MULTIPLOS_ROSTOS"
    q = a.quality or {}
    if q.get("faceRatio", 0) < ENROLL_MIN_FACE_RATIO:
        return "ROSTO_PEQUENO"
    if q.get("brightness", 0) < ENROLL_MIN_BRIGHTNESS:
        return "FOTO_ESCURA"
    if q.get("brightness", 0) > ENROLL_MAX_BRIGHTNESS:
        return "FOTO_CLARA_DEMAIS"
    if q.get("blur", 0) < ENROLL_MIN_BLUR:
        return "FOTO_BORRADA"
    if (a.liveness or 0) < ENROLL_MIN_LIVENESS:
        return "SPOOF_SUSPEITO"
    return None


@app.get("/health")
def health() -> dict:
    return {"ok": True, "modelo": MODEL_ID}


@app.post("/v1/enroll", dependencies=[Depends(require_token)])
async def enroll(image: UploadFile = File(...)) -> dict:
    img = await _read_image(image)
    t0 = time.perf_counter()
    a = _run(img)
    motivo = _motivo_enroll(a)
    return {
        "ok": motivo is None,
        "motivo": motivo,
        "modelo": MODEL_ID,
        "faces": a.faces,
        "bbox": a.bbox,
        "detScore": a.det_score,
        "embedding": a.embedding.tolist() if a.embedding is not None else None,
        "liveness": {"real": a.is_real, "score": a.liveness},
        "quality": a.quality,
        "timingsMs": {**a.timings_ms, "total": round((time.perf_counter() - t0) * 1000, 1)},
    }


@app.post("/v1/verify", dependencies=[Depends(require_token)])
async def verify(image: UploadFile = File(...), reference: str = Form(...), modelo: str = Form("")) -> dict:
    if modelo and modelo != MODEL_ID:
        raise HTTPException(status_code=409, detail=f"referência gerada com {modelo}; serviço usa {MODEL_ID}")
    try:
        ref = np.asarray(json.loads(reference), dtype=np.float32).reshape(-1)
    except (ValueError, TypeError) as e:
        raise HTTPException(status_code=400, detail="reference inválida") from e
    img = await _read_image(image)
    t0 = time.perf_counter()
    a = _run(img)
    if a.embedding is not None and ref.shape != a.embedding.shape:
        raise HTTPException(status_code=400, detail="dimensão da reference não confere")
    similarity = round(cosine(a.embedding, ref), 4) if a.embedding is not None else None
    motivo = "NENHUM_ROSTO" if a.faces == 0 else "MULTIPLOS_ROSTOS" if a.faces > 1 else None
    return {
        "ok": motivo is None,
        "motivo": motivo,
        "modelo": MODEL_ID,
        "faces": a.faces,
        "similarity": similarity,
        "liveness": {"real": a.is_real, "score": a.liveness},
        "quality": a.quality,
        "timingsMs": {**a.timings_ms, "total": round((time.perf_counter() - t0) * 1000, 1)},
    }
