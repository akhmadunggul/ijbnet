FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
    torch torchvision --index-url https://download.pytorch.org/whl/cpu

RUN pip install --no-cache-dir \
    "transformers>=4.36.0,<5.0.0" \
    "opencv-python-headless>=4.8.0" \
    "scikit-image" \
    "numpy" \
    "pillow" \
    "fastapi[standard]" \
    "uvicorn"

ENV HF_HOME=/opt/hf-cache

RUN python3 -c \
    "from transformers import pipeline; pipeline('image-segmentation', model='briaai/RMBG-1.4', trust_remote_code=True)" \
    || echo "RMBG-1.4 pre-download skipped — will fetch on first start"

COPY main.py /app/main.py
WORKDIR /app

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
