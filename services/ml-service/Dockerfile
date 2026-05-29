FROM python:3.11-slim

WORKDIR /app

# System dependencies for OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 libsm6 libxext6 libxrender-dev libgl1 wget \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies (CPU-only PyTorch)
COPY requirements.txt ./
RUN pip install --no-cache-dir \
    --extra-index-url https://download.pytorch.org/whl/cpu \
    -r requirements.txt

# Download MiniFASNet anti-spoofing model weights at build time
RUN mkdir -p /app/weights && \
    wget -q https://github.com/minivision-ai/Silent-Face-Anti-Spoofing/raw/master/resources/anti_spoof_models/2.7_80x80_MiniFASNetV2.pth \
         -O /app/weights/MiniFASNetV2.pth && \
    wget -q https://github.com/minivision-ai/Silent-Face-Anti-Spoofing/raw/master/resources/anti_spoof_models/4_0_0_80x80_MiniFASNetV1SE.pth \
         -O /app/weights/MiniFASNetV1SE.pth

COPY app ./app

# Pre-download FaceNet-512 weights (baked into the image — no first-request latency)
RUN python -c "from facenet_pytorch import InceptionResnetV1; InceptionResnetV1(pretrained='vggface2')"

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
