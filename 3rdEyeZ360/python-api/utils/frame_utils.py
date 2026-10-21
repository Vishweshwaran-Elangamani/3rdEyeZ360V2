import base64
import binascii

import cv2
import numpy as np


def decode_frame(base64_string: str) -> np.ndarray:
    """Decode a plain Base64 image or browser data URL into a BGR frame."""
    if not isinstance(base64_string, str) or not base64_string.strip():
        raise ValueError("Camera frame is empty")

    encoded = base64_string.strip()

    # Browser canvas.toDataURL() returns: data:image/jpeg;base64,<payload>
    if encoded.startswith("data:"):
        if "," not in encoded:
            raise ValueError("Invalid image data URL")
        header, encoded = encoded.split(",", 1)
        if ";base64" not in header.lower():
            raise ValueError("Image data URL is not Base64 encoded")

    # Remove whitespace/newlines that may be introduced in transport.
    encoded = "".join(encoded.split())

    try:
        img_bytes = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError) as error:
        raise ValueError("Invalid Base64 camera frame") from error

    if not img_bytes:
        raise ValueError("Decoded camera frame is empty")

    np_arr = np.frombuffer(img_bytes, dtype=np.uint8)
    frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    if frame is None or frame.size == 0:
        raise ValueError("OpenCV could not decode the camera image")

    return frame


def resize_frame(frame: np.ndarray, width: int = 640) -> np.ndarray:
    """Resize a valid BGR frame to the requested width, preserving ratio."""
    if frame is None or not isinstance(frame, np.ndarray) or frame.size == 0:
        raise ValueError("Cannot resize an empty camera frame")

    if frame.ndim < 2:
        raise ValueError("Camera frame has invalid dimensions")

    height, current_width = frame.shape[:2]
    if height <= 0 or current_width <= 0:
        raise ValueError("Camera frame has invalid dimensions")

    if not isinstance(width, int) or width <= 0:
        raise ValueError("Resize width must be a positive integer")

    if current_width == width:
        return frame

    ratio = width / float(current_width)
    target_height = max(1, int(round(height * ratio)))

    interpolation = cv2.INTER_AREA if ratio < 1.0 else cv2.INTER_LINEAR
    return cv2.resize(frame, (width, target_height), interpolation=interpolation)
