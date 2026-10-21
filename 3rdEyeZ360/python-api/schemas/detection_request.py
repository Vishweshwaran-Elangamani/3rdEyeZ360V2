from pydantic import BaseModel


class FrameRequest(BaseModel):
    frame: str
    candidate_id: str | None = None
    exam_id: str | None = None


class FaceContinuityRequest(BaseModel):
    reference_frame: str
    current_frame: str
    candidate_id: str | None = None
    exam_id: str | None = None


class AudioRequest(BaseModel):
    audio_chunk: str
    candidate_id: str | None = None
    exam_id: str | None = None
