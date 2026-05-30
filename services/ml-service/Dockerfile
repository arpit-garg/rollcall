# syntax=docker/dockerfile:1.6
FROM python:3.11-slim

WORKDIR /app

# System dependencies for OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 libsm6 libxext6 libxrender-dev libgl1 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies (CPU-only PyTorch)
COPY requirements.txt ./
RUN pip install --no-cache-dir \
    --extra-index-url https://download.pytorch.org/whl/cpu \
    -r requirements.txt

# Download MiniFASNet anti-spoofing model weights from immutable revisions.
RUN mkdir -p /app/weights
ADD --checksum=sha256:a5eb02e1843f19b5386b953cc4c9f011c3f985d0ee2bb9819eea9a142099bec0 \
    https://huggingface.co/spaces/aaavvvrrr/face-anti-spoofing/resolve/d9b3330bc1c961613bf3904bd6bac0ca0411310f/weights/2.7_80x80_MiniFASNetV2.pth \
    /app/weights/MiniFASNetV2.pth
ADD --checksum=sha256:84ee1d37d96894d5e82de5a57df044ef80a58be2b218b5ed7cdfd875ec2f5990 \
    https://huggingface.co/spaces/aaavvvrrr/face-anti-spoofing/resolve/52d5df1a644e37e2fdc4b77b7e04bdc92bb973d5/weights/4_0_0_80x80_MiniFASNetV1SE.pth \
    /app/weights/MiniFASNetV1SE.pth

COPY app ./app

# Pre-download FaceNet-512 weights (baked into the image — no first-request latency)
RUN python -c "from facenet_pytorch import InceptionResnetV1; InceptionResnetV1(pretrained='vggface2')"

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
