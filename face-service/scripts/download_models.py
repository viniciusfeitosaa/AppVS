"""Baixa os pesos no build da imagem. Inclui variantes usadas no benchmark."""

import os

os.environ.setdefault("FACE_SERVICE_TOKEN", "build")

from uniface.constants import MiniFASNetWeights, MobileFaceWeights, RetinaFaceWeights  # noqa: E402
from uniface.detection import RetinaFace  # noqa: E402
from uniface.recognition import MobileFace  # noqa: E402
from uniface.spoofing import MiniFASNet  # noqa: E402

CPU = ["CPUExecutionProvider"]

for w in (RetinaFaceWeights.MNET_V2, RetinaFaceWeights.MNET_025):
    RetinaFace(model_name=w, providers=CPU)
for w in (MobileFaceWeights.MNET_V2,):
    MobileFace(model_name=w, providers=CPU)
for w in (MiniFASNetWeights.V2, MiniFASNetWeights.V1SE):
    MiniFASNet(model_name=w, providers=CPU)

print("modelos prontos em", os.environ.get("UNIFACE_CACHE_DIR"))
