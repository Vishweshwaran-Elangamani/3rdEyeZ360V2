from datetime import datetime, timedelta
import uuid

from config.database import get_db

VIOLATION_SCORES = {
    "phone_detected": 5,
    "multiple_face": 8,
    "multiple_faces": 8,
    "face_missing": 2,
    "looking_away": 2,
    "looking_left": 2,
    "looking_right": 2,
    "looking_down": 2,
    "noise_violation": 2,
    "background_speech": 2,
    "loud_noise": 2,
    "restricted_app": 6,
    "multiple_monitor": 4,
    "charger_removed": 1,
    "mic_silent": 1,
}


async def log_warning(assessment_id: str, candidate_id: str, exam_id: str, detail: str):
    db = get_db()
    existing = await db.warnings.find_one({
        "assessment_id": assessment_id,
        "detail": detail
    })
    if existing:
        await db.warnings.update_one(
            {"_id": existing["_id"]},
            {"$inc": {"count": 1}, "$set": {"timestamp": datetime.utcnow()}}
        )
        return existing["count"] + 1

    warning = {
        "warning_id": f"WRN-{uuid.uuid4().hex[:8].upper()}",
        "assessment_id": assessment_id,
        "candidate_id": candidate_id,
        "exam_id": exam_id,
        "type": detail,
        "detail": detail,
        "count": 1,
        "timestamp": datetime.utcnow()
    }
    await db.warnings.insert_one(warning)
    return 1


async def log_violation(
    assessment_id: str,
    candidate_id: str,
    exam_id: str,
    vtype: str,
    detail: str,
    confidence: float,
    screenshot_path: str = None,
    clip_path: str = None
):
    db = get_db()
    risk = VIOLATION_SCORES.get(vtype, 5)

    violation = {
        "violation_id": f"VIO-{uuid.uuid4().hex[:8].upper()}",
        "assessment_id": assessment_id,
        "candidate_id": candidate_id,
        "exam_id": exam_id,
        "type": vtype,
        "detail": detail,
        "confidence": confidence,
        "risk_score": risk,
        "screenshot_path": screenshot_path,
        "clip_path": clip_path,
        "timestamp": datetime.utcnow(),
        "reviewed": False
    }
    await db.violations.insert_one(violation)

    await db.assessments.update_one(
        {"assessment_id": assessment_id},
        {
            "$inc": {
                "violation_count": 1,
                "risk_score": risk,
                "credibility_score": -risk
            },
            "$set": {"updated_at": datetime.utcnow()}
        }
    )

    assessment = await db.assessments.find_one({"assessment_id": assessment_id})
    exam = await db.exams.find_one({"exam_id": exam_id})
    current_count = int(
        (assessment or {}).get("violation_count", (assessment or {}).get("violationcount", 0)) or 0
    )
    allowed_limit = int(
        (exam or {}).get(
            "violation_threshold",
            (exam or {}).get(
                "violationthreshold",
                (assessment or {}).get(
                    "violation_threshold",
                    (assessment or {}).get("violationthreshold", 10),
                ),
            ),
        )
        or 10
    )
    current_risk = int((assessment or {}).get("risk_score", 0) or 0)
    now = datetime.utcnow()

    if current_count >= allowed_limit:
        await db.assessments.update_one(
            {"assessment_id": assessment_id},
            {"$set": {
                "status": "LOCKED",
                "threshold_reached": True,
                "thresholdreached": True,
                "violation_threshold": allowed_limit,
                "violationthreshold": allowed_limit,
                "updated_at": now,
            }},
        )
        return {
            "locked": True,
            "threshold_reached": True,
            "warning_level": "REMOVAL",
            "violation_count": current_count,
            "allowed_limit": allowed_limit,
            "risk_score": current_risk,
            "violation": violation,
        }

    if current_count == max(1, allowed_limit - 1):
        grace_until = now + timedelta(seconds=15)
        await db.assessments.update_one(
            {"assessment_id": assessment_id},
            {"$set": {
                "final_violation_warning_issued": True,
                "violation_grace_until": grace_until,
                "updated_at": now,
            }},
        )
        return {
            "locked": False,
            "final_warning": True,
            "warning_level": "FINAL",
            "grace_seconds": 15,
            "grace_until": grace_until,
            "violation_count": current_count,
            "allowed_limit": allowed_limit,
            "risk_score": current_risk,
            "violation": violation,
        }

    high_warning_from = max(1, allowed_limit - 2)
    warning_level = "HIGH" if current_count >= high_warning_from else "STANDARD"
    return {
        "locked": False,
        "warning_level": warning_level,
        "violation_count": current_count,
        "allowed_limit": allowed_limit,
        "risk_score": current_risk,
        "violation": violation,
    }

async def get_warning_count(assessment_id: str, detail: str) -> int:
    db = get_db()
    result = await db.warnings.find_one({"assessment_id": assessment_id, "detail": detail})
    return result["count"] if result else 0