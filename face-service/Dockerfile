FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    UNIFACE_CACHE_DIR=/models \
    OMP_NUM_THREADS=1 \
    FACE_ORT_THREADS=1

WORKDIR /app

COPY requirements.txt .
RUN grep -v '^uniface' requirements.txt > /tmp/req.txt \
    && pip install -r /tmp/req.txt \
    && pip install --no-deps "$(grep '^uniface' requirements.txt)"

COPY app ./app
COPY scripts ./scripts

# Pesos baixados no build (verificados por SHA-256 pelo uniface); runtime não acessa a internet.
RUN python -m scripts.download_models && chmod -R a+rX /models

RUN useradd --system --uid 10001 face
USER face

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4).status == 200 else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--no-access-log"]
