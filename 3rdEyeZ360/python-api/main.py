import os

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load environment variables before importing routers/detectors.
load_dotenv()

from routers import audio, eye, face, phone, pose


app = FastAPI(
    title="3rdEyeZ360 Detection API",
    version="1.0.0",
)

# Allow requests from the local Vite/Electron renderer during development.
# Credentials are disabled because wildcard origins cannot be combined with
# credentialed CORS requests.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "null",
    ],
    allow_origin_regex=r"^(file://.*|http://(localhost|127\.0\.0\.1)(:\d+)?)$",
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(face.router)
app.include_router(phone.router)
app.include_router(pose.router)
app.include_router(audio.router)
app.include_router(eye.router)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "3rdEyeZ360 Detection API",
    }


@app.get("/health/detectors")
async def detector_health():
    return {
        "status": "ok",
        "detectors": {
            "face": "/detect/face",
            "phone": "/detect/phone",
            "pose": "/detect/pose",
            "audio": "/detect/audio",
            "eye": "/detect/eye",
        },
    }


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=int(os.getenv("PORT", 5001)),
        reload=False,
    )
