from fastapi import APIRouter, HTTPException

from schemas.detection_request import FrameRequest, FaceContinuityRequest
from schemas.detection_response import DetectionResult
from detectors.face_detector import (
    compare_face_continuity,
    detect_faces,
    validate_reference_face,
)
from utils.frame_utils import decode_frame, resize_frame

router = APIRouter()


def _safe_result(result: dict | None) -> DetectionResult:
    result = result or {}
    detail = str(result.get("detail") or "unknown").strip().lower()
    metadata = {
        "ok": {
            "category": "face",
            "issue": None,
            "message": "Face monitoring check passed.",
            "candidate_action": None,
            "typing_sensitive": False,
        },
        "face_ok": {
            "category": "face",
            "issue": None,
            "message": "Face monitoring check passed.",
            "candidate_action": None,
            "typing_sensitive": False,
        },
        "face_missing": {
            "category": "face",
            "issue": "face_missing",
            "message": "Please remain visible in the camera frame.",
            "candidate_action": "Sit in front of the camera and keep your face visible.",
            "typing_sensitive": False,
        },
        "no_face": {
            "category": "face",
            "issue": "face_missing",
            "message": "Please remain visible in the camera frame.",
            "candidate_action": "Sit in front of the camera and keep your face visible.",
            "typing_sensitive": False,
        },
        "multiple_faces": {
            "category": "face",
            "issue": "multiple_faces",
            "message": "Another person appears to be visible. Only the candidate should be in view.",
            "candidate_action": "Ensure only you are visible in the camera frame.",
            "typing_sensitive": False,
        },
        "multiple_face": {
            "category": "face",
            "issue": "multiple_faces",
            "message": "Another person appears to be visible. Only the candidate should be in view.",
            "candidate_action": "Ensure only you are visible in the camera frame.",
            "typing_sensitive": False,
        },
    }
    fallback = {
        "category": "face",
        "issue": detail or "face_issue",
        "message": "Please follow the face monitoring instructions.",
        "candidate_action": "Correct the face monitoring issue shown on screen.",
        "typing_sensitive": False,
    }
    info = metadata.get(detail, fallback)
    normalised_detail = {
        "no_face": "face_missing",
        "multiple_face": "multiple_faces",
        "face_ok": "ok",
    }.get(detail, detail)
    return DetectionResult(
        type="face",
        detected=bool(result.get("detected", False)),
        confidence=float(result.get("confidence") or 0.0),
        detail=normalised_detail,
        category=result.get("category") or info["category"],
        issue=result.get("issue") if result.get("issue") is not None else info["issue"],
        message=result.get("message") or info["message"],
        candidate_action=(
            result.get("candidate_action")
            if result.get("candidate_action") is not None
            else info["candidate_action"]
        ),
        typing_sensitive=bool(result.get("typing_sensitive", info["typing_sensitive"])),
    )


@router.post("/detect/face", response_model=DetectionResult)
async def face_detection(req: FrameRequest):
    """Existing active-exam face monitoring endpoint."""
    if not req.frame:
        raise HTTPException(status_code=400, detail="frame is required")
    try:
        frame = resize_frame(decode_frame(req.frame))
        return _safe_result(detect_faces(frame))
    except ValueError as error:
        print("[FACE ROUTER] invalid frame:", error)
        raise HTTPException(status_code=400, detail="Invalid camera frame") from error
    except Exception as error:
        print("[FACE ROUTER] face detection failed:", error)
        raise HTTPException(status_code=500, detail="Face detection failed") from error


@router.post("/detect/face/reference/validate")
async def reference_face_validation(req: FrameRequest):
    """Strict precheck-only identity-photo suitability validation."""
    if not req.frame:
        raise HTTPException(status_code=400, detail="frame is required")
    try:
        # Preserve more detail for quality checks than the normal monitoring route.
        frame = resize_frame(decode_frame(req.frame), width=960)
        result = validate_reference_face(frame)
        return result
    except ValueError as error:
        print("[FACE REFERENCE ROUTER] invalid frame:", error)
        raise HTTPException(
            status_code=400,
            detail={
                "accepted": False,
                "detail": "invalid_frame",
                "message": "The captured camera image is invalid.",
                "candidate_action": "Close the capture window, retry the camera check, and capture again.",
            },
        ) from error
    except Exception as error:
        print("[FACE REFERENCE ROUTER] validation failed:", error)
        raise HTTPException(
            status_code=500,
            detail={
                "accepted": False,
                "detail": "reference_face_error",
                "message": "Reference-photo validation failed.",
                "candidate_action": "Keep the complete face visible and retry.",
            },
        ) from error

@router.post("/detect/face/continuity")
@router.post("/detect/face/identity/compare", include_in_schema=False)
async def face_continuity_detection(req: FaceContinuityRequest):
    """Compare the accepted precheck image with the current exam frame."""
    if not req.reference_frame or not req.current_frame:
        raise HTTPException(
            status_code=400,
            detail="reference_frame and current_frame are required",
        )

    try:
        reference_frame = resize_frame(decode_frame(req.reference_frame), width=960)
        current_frame = resize_frame(decode_frame(req.current_frame), width=960)
        return compare_face_continuity(reference_frame, current_frame)
    except ValueError as error:
        print("[FACE CONTINUITY ROUTER] invalid frame:", error)
        raise HTTPException(
            status_code=400,
            detail={
                "decision": "INCONCLUSIVE",
                "detail": "invalid_frame",
                "message": "The reference or current camera image is invalid.",
                "candidate_action": "Keep the complete face visible and retry.",
            },
        ) from error
    except Exception as error:
        print("[FACE CONTINUITY ROUTER] comparison failed:", error)
        raise HTTPException(
            status_code=500,
            detail={
                "decision": "INCONCLUSIVE",
                "detail": "continuity_service_error",
                "message": "Candidate continuity comparison could not be completed.",
                "candidate_action": "Keep the complete face visible and retry.",
            },
        ) from error

