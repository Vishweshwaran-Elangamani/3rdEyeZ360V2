from config.database import get_db
from services.assessment_service import log_audit
from services.violation_service import log_warning, log_violation, get_warning_count
from services.evidence_service import upload_screenshot, upload_clip
from utils.constants import TOASTER_MESSAGES, ViolationType
from datetime import datetime
import uuid

WARNING_BEFORE_VIOLATION = 2

DETAIL_TO_VIOLATION_TYPE = {
    "face_missing": ViolationType.FACE_MISSING,
    "multiple_faces": ViolationType.MULTIPLE_FACES,
    "phone_detected": ViolationType.PHONE_DETECTED,
    "looking_left": ViolationType.LOOKING_AWAY,
    "looking_right": ViolationType.LOOKING_AWAY,
    "looking_down": ViolationType.LOOKING_AWAY,
    "background_speech": ViolationType.BACKGROUND_SPEECH,
    "loud_noise": ViolationType.LOUD_NOISE,
    "mic_silent": ViolationType.MIC_SILENT,
}

async def process_detection(assessment_id: str, candidate_id: str, exam_id: str,
                             detection_type: str, detail: str, confidence: float,
                             screenshot_b64: str = None):
    if detail == "ok" or detail == "no_face":
        return {"action": "none"}

    toaster = TOASTER_MESSAGES.get(detail)
    if not toaster:
        return {"action": "none"}

    message, level = toaster
    warning_count = await get_warning_count(assessment_id, detail)

    if warning_count < WARNING_BEFORE_VIOLATION:
        await log_warning(assessment_id, candidate_id, exam_id, detail)
        db = get_db()
        assessment = await db.assessments.find_one({"assessment_id": assessment_id}) or {}
        exam = await db.exams.find_one({"exam_id": exam_id}) or {}
        violation_count = int(
            assessment.get("violation_count", assessment.get("violationcount", 0)) or 0
        )
        allowed_limit = int(
            exam.get(
                "violation_threshold",
                exam.get(
                    "violationthreshold",
                    assessment.get(
                        "violation_threshold",
                        assessment.get("violationthreshold", 10),
                    ),
                ),
            )
            or 10
        )
        return {
            "action": "toast",
            "toast": True,
            "warning": True,
            "violation": False,
            "warning_level": "STANDARD",
            "level": level,
            "detail": detail,
            "message": message,
            "warning_count": warning_count + 1,
            "violation_count": violation_count,
            "allowed_limit": allowed_limit,
            "remaining_violations": max(0, allowed_limit - violation_count),
            "grace_active": False,
            "grace_seconds": 0,
        }
    else:
        vtype = DETAIL_TO_VIOLATION_TYPE.get(detail, detail)
        screenshot_path = None
        if screenshot_b64:
            screenshot_path = upload_screenshot(exam_id, candidate_id, vtype, screenshot_b64)

        result = await log_violation(
            assessment_id, candidate_id, exam_id,
            vtype, detail, confidence, screenshot_path
        )
        # Reset warning count for this detail
        db = get_db()
        await db.warnings.update_one(
            {"assessment_id": assessment_id, "detail": detail},
            {"$set": {"count": 0}}
        )
        locked = result.get("locked", False)
        final_warning = result.get("final_warning", False)
        grace_active = result.get("grace_active", False)
        warning_level = str(result.get("warning_level") or "STANDARD").upper()
        action = (
            "threshold_reached"
            if locked or warning_level == "REMOVAL"
            else "final_warning"
            if final_warning or warning_level == "FINAL"
            else "violation"
        )
        return {
            "action": action,
            "toast": True,
            "warning": not locked,
            "violation_detected": True,
            "locked": locked,
            "threshold_reached": result.get("threshold_reached", False),
            "final_warning": final_warning,
            "grace_active": grace_active,
            "grace_seconds": result.get("grace_seconds", 0),
            "grace_until": result.get("grace_until"),
            "warning_level": warning_level,
            "message": (
                f"You have been disqualified from this assessment after reaching {result.get('violation_count', 0)} of {result.get('allowed_limit', 0)} allowed violations. Re-entry requires examiner approval."
                if locked else
                f"Final warning: {result.get('violation_count', 0)} of {result.get('allowed_limit', 0)} violations. You are one confirmed violation away from disqualification. Correct the detected behavior during the grace period."
                if final_warning else
                f"High warning: {result.get('violation_count', 0)} of {result.get('allowed_limit', 0)} violations. You are close to disqualification."
                if warning_level == "HIGH" else
                f"Violation recorded: {vtype}"
            ),
            "violation_count": result.get("violation_count", 0),
            "allowed_limit": result.get("allowed_limit", 0),
            "remaining_violations": result.get("remaining_violations", 0),
            "risk_score": result.get("risk_score", 0),
            "violation": result.get("violation"),
        }

async def get_candidate_assessment(exam_id: str, candidate_id: str):
    db = get_db()
    a = await db.assessments.find_one({"exam_id": exam_id, "candidate_id": candidate_id})
    if not a:
        return None
    return {k: str(v) if k == "_id" else v for k, v in a.items() if k != "_id"}

async def update_assessment_status(assessment_id: str, status: str, extra: dict = None):
    db = get_db()
    update = {"status": status}
    if extra:
        update.update(extra)
    await db.assessments.update_one({"assessment_id": assessment_id}, {"$set": update})

async def examiner_action(assessment_id: str, action: str, reason: str, examiner_id: str):
    db = get_db()
    status_map = {
        "pause": "ACTIVE",
        "resume": "ACTIVE",
        "terminate": "TERMINATED"
    }
    new_status = status_map.get(action)
    if new_status:
        update = {"status": new_status}
        if action == "terminate":
            update["final_status"] = "TERMINATED"
            update["exit_time"] = datetime.utcnow()
        await db.assessments.update_one({"assessment_id": assessment_id}, {"$set": update})
    await log_audit(examiner_id, action.upper(), reason=reason, assessment_id=assessment_id)
    return {"message": f"Assessment {action}d"}