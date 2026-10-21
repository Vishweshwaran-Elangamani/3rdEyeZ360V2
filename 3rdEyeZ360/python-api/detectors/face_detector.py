import cv2
import mediapipe as mp
import numpy as np

mp_face = mp.solutions.face_detection

# Keep the original detector unchanged for active-exam monitoring.
face_detector = mp_face.FaceDetection(
    model_selection=0,
    min_detection_confidence=0.6,
)

# Full-range face detection is used only for precheck reference validation so a
# smaller second face farther from the camera is less likely to be ignored.
reference_face_detector = mp_face.FaceDetection(
    model_selection=1,
    min_detection_confidence=0.55,
)

# FaceMesh supplies stable five-point landmarks for SFace alignment.
_continuity_face_mesh = mp.solutions.face_mesh.FaceMesh(
    static_image_mode=True,
    max_num_faces=1,
    refine_landmarks=False,
    min_detection_confidence=0.60,
)

# Canonical 112x112 alignment points used before SFace feature extraction.
_SFACE_CANONICAL_LANDMARKS = np.array(
    [
        [38.2946, 51.6963],  # left eye
        [73.5318, 51.5014],  # right eye
        [56.0252, 71.7366],  # nose tip
        [41.5493, 92.3655],  # left mouth corner
        [70.7299, 92.2041],  # right mouth corner
    ],
    dtype=np.float32,
)


def _result(
    detected: bool,
    count: int,
    detail: str,
    confidence: float,
    message: str,
    candidate_action: str | None,
):
    return {
        "detected": detected,
        "count": count,
        "face_count": count,
        "detail": detail,
        "confidence": confidence,
        "category": "face",
        "issue": None if detail == "ok" else detail,
        "message": message,
        "candidate_action": candidate_action,
        "typing_sensitive": False,
    }


def detect_faces(frame):
    """Existing active-exam face-presence and multiple-face detector."""
    try:
        print("[FACE] Checking face")
        if frame is None or not hasattr(frame, "shape"):
            return _result(
                True,
                0,
                "face_missing",
                0.0,
                "Please remain visible in the camera frame.",
                "Sit in front of the camera and keep your face visible.",
            )

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = face_detector.process(rgb)
        if not results.detections:
            return _result(
                True,
                0,
                "face_missing",
                0.99,
                "Please remain visible in the camera frame.",
                "Sit in front of the camera and keep your face visible.",
            )

        count = len(results.detections)
        if count > 1:
            return _result(
                True,
                count,
                "multiple_faces",
                0.95,
                "Another person appears to be visible. Only the candidate should be in view.",
                "Ensure only you are visible in the camera frame.",
            )

        return _result(False, 1, "ok", 1.0, "Face monitoring check passed.", None)
    except Exception as error:
        print(f"[FACE] Detector error: {error}")
        return _result(
            False,
            0,
            "face_error",
            0.0,
            "Face detection could not be completed.",
            "Keep your face clearly visible to the camera.",
        )


def _reference_result(
    accepted: bool,
    detail: str,
    message: str,
    action: str | None,
    *,
    count: int = 0,
    confidence: float = 0.0,
    quality: dict | None = None,
    face_box: dict | None = None,
):
    return {
        "accepted": accepted,
        "detected": not accepted,
        "count": count,
        "face_count": count,
        "detail": detail,
        "confidence": round(float(confidence), 4),
        "category": "face_reference",
        "issue": None if accepted else detail,
        "message": message,
        "candidate_action": action,
        "quality": quality or {},
        "face_box": face_box,
        "typing_sensitive": False,
    }


def validate_reference_face(frame):
    """Strict precheck-only validation for the reference identity photo."""
    try:
        if frame is None or not isinstance(frame, np.ndarray) or frame.size == 0:
            return _reference_result(
                False,
                "invalid_frame",
                "The camera image is unavailable.",
                "Close the capture window, retry the camera check, and capture again.",
            )

        height, width = frame.shape[:2]
        if height < 120 or width < 160:
            return _reference_result(
                False,
                "invalid_frame",
                "The camera image resolution is too low.",
                "Use a camera image with a clearer resolution.",
            )

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        brightness = float(np.mean(gray))
        contrast = float(np.std(gray))
        sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        overexposed_ratio = float(np.count_nonzero(gray >= 245) / gray.size)
        underexposed_ratio = float(np.count_nonzero(gray <= 12) / gray.size)

        quality = {
            "brightness": round(brightness, 2),
            "contrast": round(contrast, 2),
            "sharpness": round(sharpness, 2),
            "overexposed_ratio": round(overexposed_ratio, 4),
            "underexposed_ratio": round(underexposed_ratio, 4),
        }

        if brightness < 35 or underexposed_ratio > 0.7:
            return _reference_result(
                False,
                "image_too_dark",
                "The face is not sufficiently visible because the image is too dark.",
                "Increase the room lighting and avoid sitting with the light behind you.",
                quality=quality,
            )

        if brightness > 225 or overexposed_ratio > 0.35:
            return _reference_result(
                False,
                "image_overexposed",
                "The image is too bright for a reliable reference photo.",
                "Reduce direct light on the face and move away from bright windows.",
                quality=quality,
            )

        if contrast < 18:
            return _reference_result(
                False,
                "image_low_contrast",
                "The face is not clearly distinguishable from the background.",
                "Improve the lighting and use a plain, contrasting background.",
                quality=quality,
            )

        if sharpness < 22:
            return _reference_result(
                False,
                "image_blurred",
                "The camera image is not clear enough for a reference photo.",
                "Hold still, clean the camera lens, and wait for the image to become clear.",
                quality=quality,
            )

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = reference_face_detector.process(rgb)
        detections = list(results.detections or [])
        count = len(detections)

        if count == 0:
            return _reference_result(
                False,
                "face_missing",
                "No complete face was detected.",
                "Move the complete face inside the oval and look at the camera.",
                count=0,
                quality=quality,
            )

        if count > 1:
            return _reference_result(
                False,
                "multiple_faces",
                "More than one face is visible in the complete camera frame.",
                "Ensure only one person is visible before the photo is captured.",
                count=count,
                confidence=max(float(d.score[0]) for d in detections if d.score),
                quality=quality,
            )

        detection = detections[0]
        confidence = float(detection.score[0]) if detection.score else 0.0
        relative_box = detection.location_data.relative_bounding_box

        x = max(0.0, float(relative_box.xmin))
        y = max(0.0, float(relative_box.ymin))
        box_width = min(1.0 - x, float(relative_box.width))
        box_height = min(1.0 - y, float(relative_box.height))
        center_x = x + box_width / 2.0
        center_y = y + box_height / 2.0
        face_area_ratio = max(0.0, box_width * box_height)
        offset_x = center_x - 0.5
        offset_y = center_y - 0.48

        face_box = {
            "x": round(x, 4),
            "y": round(y, 4),
            "width": round(box_width, 4),
            "height": round(box_height, 4),
            "center_x": round(center_x, 4),
            "center_y": round(center_y, 4),
            "area_ratio": round(face_area_ratio, 4),
            "center_offset_x": round(offset_x, 4),
            "center_offset_y": round(offset_y, 4),
        }
        quality.update(face_box)
        quality["detection_confidence"] = round(confidence, 4)

        if confidence < 0.68:
            return _reference_result(
                False,
                "face_unclear",
                "The face is not clear enough for a reliable reference photo.",
                "Face the camera directly, improve the lighting, and remove any obstruction.",
                count=1,
                confidence=confidence,
                quality=quality,
                face_box=face_box,
            )

        if face_area_ratio < 0.075 or box_height < 0.30:
            return _reference_result(
                False,
                "face_too_small",
                "The face is too far from the camera.",
                "Move closer until the complete face fits comfortably inside the oval.",
                count=1,
                confidence=confidence,
                quality=quality,
                face_box=face_box,
            )

        if face_area_ratio > 0.42 or box_height > 0.82:
            return _reference_result(
                False,
                "face_too_large",
                "The face is too close to the camera.",
                "Move slightly away while keeping the complete face inside the oval.",
                count=1,
                confidence=confidence,
                quality=quality,
                face_box=face_box,
            )

        if abs(offset_x) > 0.13:
            direction = "right" if offset_x < 0 else "left"
            return _reference_result(
                False,
                "face_not_centered",
                "The face is outside the centre of the oval.",
                f"Move slightly {direction} and keep the face inside the oval.",
                count=1,
                confidence=confidence,
                quality=quality,
                face_box=face_box,
            )

        if offset_y < -0.16:
            return _reference_result(
                False,
                "face_not_centered",
                "The face is too high in the capture area.",
                "Move slightly down and keep the complete face inside the oval.",
                count=1,
                confidence=confidence,
                quality=quality,
                face_box=face_box,
            )

        if offset_y > 0.15:
            return _reference_result(
                False,
                "face_not_centered",
                "The face is too low in the capture area.",
                "Move slightly up and keep the complete face inside the oval.",
                count=1,
                confidence=confidence,
                quality=quality,
                face_box=face_box,
            )

        # Keep a safe margin around the face so the complete face is retained.
        if x < 0.025 or y < 0.02 or x + box_width > 0.975 or y + box_height > 0.985:
            return _reference_result(
                False,
                "face_incomplete",
                "Part of the face is too close to the edge of the image.",
                "Move the complete face inside the oval without cropping the forehead or chin.",
                count=1,
                confidence=confidence,
                quality=quality,
                face_box=face_box,
            )

        return _reference_result(
            True,
            "reference_face_ok",
            "The reference photo is suitable.",
            None,
            count=1,
            confidence=confidence,
            quality=quality,
            face_box=face_box,
        )
    except Exception as error:
        print(f"[FACE REFERENCE] Validation error: {error}")
        return _reference_result(
            False,
            "reference_face_error",
            "Reference-photo validation could not be completed.",
            "Keep the face visible and retry the capture.",
        )

# -----------------------------------------------------------------------------
# Optional candidate-continuity comparison
# -----------------------------------------------------------------------------
# This path is deliberately separate from detect_faces() and
# validate_reference_face(). A comparison failure must never interrupt the
# existing face, phone, pose, eye, camera, or audio monitoring pipeline.

import os
from pathlib import Path

_SFACE_RECOGNIZER = None
_SFACE_MODEL_ERROR = None
SFACE_SAME_THRESHOLD = float(os.getenv("SFACE_SAME_THRESHOLD", "0.42"))
SFACE_REVIEW_THRESHOLD = float(
    os.getenv("SFACE_REVIEW_THRESHOLD", os.getenv("SFACE_SAME_THRESHOLD", "0.42"))
)


def _continuity_result(
    decision: str,
    *,
    similarity: float | None = None,
    confidence: float = 0.0,
    detail: str,
    message: str,
    candidate_action: str | None = None,
    reference_quality: dict | None = None,
    current_quality: dict | None = None,
):
    review_required = decision in {"DIFFERENT_PERSON", "CONTINUITY_REVIEW_REQUIRED"}
    return {
        "type": "identity_continuity",
        "detected": review_required,
        "decision": decision,
        "detail": detail,
        "similarity": None if similarity is None else round(float(similarity), 6),
        "confidence": round(float(confidence), 4),
        "category": "identity_continuity",
        "issue": detail if review_required else None,
        "message": message,
        "candidate_action": candidate_action,
        "typing_sensitive": False,
        "reference_quality": reference_quality or {},
        "current_quality": current_quality or {},
        "thresholds": {
            "same_person": SFACE_SAME_THRESHOLD,
            "review_required": SFACE_REVIEW_THRESHOLD,
        },
    }


def _get_sface_recognizer():
    global _SFACE_RECOGNIZER, _SFACE_MODEL_ERROR

    if _SFACE_RECOGNIZER is not None:
        return _SFACE_RECOGNIZER
    if _SFACE_MODEL_ERROR is not None:
        raise RuntimeError(_SFACE_MODEL_ERROR)

    configured = os.getenv("SFACE_MODEL_PATH", "").strip()
    fallback = (
        Path(__file__).resolve().parents[1]
        / "models"
        / "face_recognition_sface_2021dec.onnx"
    )
    model_path = Path(configured) if configured else fallback

    if not model_path.is_file():
        _SFACE_MODEL_ERROR = f"SFace model was not found: {model_path}"
        raise FileNotFoundError(_SFACE_MODEL_ERROR)

    try:
        _SFACE_RECOGNIZER = cv2.FaceRecognizerSF.create(str(model_path), "")
    except Exception as error:
        _SFACE_MODEL_ERROR = f"SFace model could not be loaded: {error}"
        raise RuntimeError(_SFACE_MODEL_ERROR) from error

    if _SFACE_RECOGNIZER is None:
        _SFACE_MODEL_ERROR = "OpenCV returned an empty SFace recognizer."
        raise RuntimeError(_SFACE_MODEL_ERROR)

    print(f"[FACE CONTINUITY] SFace model loaded: {model_path}")
    return _SFACE_RECOGNIZER


def _landmark_xy(landmarks, index, width, height):
    point = landmarks[index]
    return [float(point.x * width), float(point.y * height)]


def _extract_single_aligned_face(frame):
    """Return an aligned 112x112 face and quality metadata for SFace."""
    if frame is None or not isinstance(frame, np.ndarray) or frame.size == 0:
        return None, {}, "invalid_frame"

    height, width = frame.shape[:2]
    if height < 120 or width < 160:
        return None, {}, "invalid_frame"

    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    detection_results = reference_face_detector.process(rgb)
    detections = list(detection_results.detections or [])

    if len(detections) == 0:
        return None, {"face_count": 0}, "face_missing"
    if len(detections) > 1:
        return None, {"face_count": len(detections)}, "multiple_faces"

    detection = detections[0]
    score = float(detection.score[0]) if detection.score else 0.0
    box = detection.location_data.relative_bounding_box
    x1 = max(0, int(box.xmin * width))
    y1 = max(0, int(box.ymin * height))
    x2 = min(width, int((box.xmin + box.width) * width))
    y2 = min(height, int((box.ymin + box.height) * height))
    face_width = max(0, x2 - x1)
    face_height = max(0, y2 - y1)

    quality = {
        "face_count": 1,
        "detection_confidence": round(score, 4),
        "box": {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
        "alignment": "mediapipe_five_point_affine",
    }

    if face_width < 40 or face_height < 40:
        return None, quality, "face_too_small"
    if score < 0.60:
        return None, quality, "face_unclear"

    mesh_results = _continuity_face_mesh.process(rgb)
    if not mesh_results.multi_face_landmarks:
        return None, quality, "face_landmarks_missing"

    landmarks = mesh_results.multi_face_landmarks[0].landmark

    # Average the visible eye-corner landmarks for stable eye centres.
    left_eye_outer = np.array(_landmark_xy(landmarks, 33, width, height))
    left_eye_inner = np.array(_landmark_xy(landmarks, 133, width, height))
    right_eye_inner = np.array(_landmark_xy(landmarks, 362, width, height))
    right_eye_outer = np.array(_landmark_xy(landmarks, 263, width, height))
    left_eye = (left_eye_outer + left_eye_inner) / 2.0
    right_eye = (right_eye_inner + right_eye_outer) / 2.0

    source_landmarks = np.array(
        [
            left_eye,
            right_eye,
            _landmark_xy(landmarks, 1, width, height),
            _landmark_xy(landmarks, 61, width, height),
            _landmark_xy(landmarks, 291, width, height),
        ],
        dtype=np.float32,
    )

    transform, inliers = cv2.estimateAffinePartial2D(
        source_landmarks,
        _SFACE_CANONICAL_LANDMARKS,
        method=cv2.LMEDS,
    )
    if transform is None:
        return None, quality, "face_alignment_failed"

    aligned = cv2.warpAffine(
        frame,
        transform,
        (112, 112),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_REPLICATE,
    )
    if aligned is None or aligned.size == 0:
        return None, quality, "face_alignment_failed"

    gray = cv2.cvtColor(aligned, cv2.COLOR_BGR2GRAY)
    brightness = float(np.mean(gray))
    sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    quality.update(
        {
            "brightness": round(brightness, 2),
            "sharpness": round(sharpness, 2),
            "landmark_inliers": int(np.sum(inliers)) if inliers is not None else 0,
        }
    )

    if brightness < 30:
        return None, quality, "image_too_dark"
    if brightness > 230:
        return None, quality, "image_overexposed"
    if sharpness < 18:
        return None, quality, "image_blurred"

    return aligned, quality, None


def _extract_sface_feature(frame):
    aligned_face, quality, error = _extract_single_aligned_face(frame)
    if error:
        return None, quality, error

    recognizer = _get_sface_recognizer()
    try:
        feature = recognizer.feature(aligned_face)
    except Exception as error:
        print(f"[FACE CONTINUITY] Feature extraction failed: {error}")
        return None, quality, "feature_extraction_failed"

    if feature is None or np.asarray(feature).size == 0:
        return None, quality, "feature_extraction_failed"

    feature = np.asarray(feature, dtype=np.float32).copy()
    norm = float(np.linalg.norm(feature))
    if norm <= 1e-8:
        return None, quality, "feature_extraction_failed"

    return feature / norm, quality, None

def compare_face_continuity(reference_frame, current_frame):
    """Compare a validated precheck photo with one active-exam frame.

    This function never modifies the existing active-exam face detector. It
    returns SAME_PERSON, DIFFERENT_PERSON, or INCONCLUSIVE. Callers
    should require repeated review-required results before creating evidence.
    """
    try:
        reference_feature, reference_quality, reference_error = _extract_sface_feature(
            reference_frame
        )
        if reference_error:
            return _continuity_result(
                "INCONCLUSIVE",
                detail=f"reference_{reference_error}",
                message="The stored reference photo could not be compared reliably.",
                reference_quality=reference_quality,
            )

        current_feature, current_quality, current_error = _extract_sface_feature(
            current_frame
        )
        if current_error:
            action = {
                "face_missing": "Remain clearly visible in the camera frame.",
                "multiple_faces": "Ensure only the candidate is visible.",
                "image_too_dark": "Improve the room lighting.",
                "image_overexposed": "Reduce direct light on the face.",
                "image_blurred": "Face the camera and hold still.",
            }.get(current_error, "Keep the complete face clearly visible.")
            return _continuity_result(
                "INCONCLUSIVE",
                detail=current_error,
                message="Candidate continuity could not be checked from this frame.",
                candidate_action=action,
                reference_quality=reference_quality,
                current_quality=current_quality,
            )

        recognizer = _get_sface_recognizer()
        similarity = float(
            recognizer.match(
                reference_feature,
                current_feature,
                cv2.FaceRecognizerSF_FR_COSINE,
            )
        )
        print(
            "[FACE CONTINUITY] SFace comparison",
            {
                "similarity": round(similarity, 6),
                "same_threshold": SFACE_SAME_THRESHOLD,
                "review_threshold": SFACE_REVIEW_THRESHOLD,
            },
        )

        if similarity >= SFACE_SAME_THRESHOLD:
            return _continuity_result(
                "SAME_PERSON",
                similarity=similarity,
                confidence=min(1.0, similarity),
                detail="same_person",
                message="Candidate continuity check passed.",
                reference_quality=reference_quality,
                current_quality=current_quality,
            )

        if similarity < SFACE_REVIEW_THRESHOLD:
            confidence = min(1.0, max(0.0, (SFACE_REVIEW_THRESHOLD - similarity) / max(SFACE_REVIEW_THRESHOLD, 0.001)))
            return _continuity_result(
                "DIFFERENT_PERSON",
                similarity=similarity,
                confidence=confidence,
                detail="different_person",
                message="Person looks different from the validated PreCheck photo.",
                candidate_action="Please ensure the registered candidate is present in front of the camera.",
                reference_quality=reference_quality,
                current_quality=current_quality,
            )

        return _continuity_result(
            "INCONCLUSIVE",
            similarity=similarity,
            confidence=0.0,
            detail="continuity_inconclusive",
            message="Candidate continuity comparison was inconclusive.",
            candidate_action="Face the camera directly and remain still.",
            reference_quality=reference_quality,
            current_quality=current_quality,
        )
    except Exception as error:
        print(f"[FACE CONTINUITY] Comparison error: {error}")
        return _continuity_result(
            "INCONCLUSIVE",
            detail="continuity_service_error",
            message="Candidate continuity comparison could not be completed.",
        )
