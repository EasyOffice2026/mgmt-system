FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml .
RUN pip install --no-cache-dir .

COPY backend/ backend/
COPY frontend/dist/ frontend/dist/
COPY main.py .

RUN mkdir -p /data uploads

ENV DATABASE_URL=sqlite:////data/mudawwarah.db
ENV UPLOAD_DIR=/data/uploads

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
