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
    grace_until = (assessment or {}).get("violation_grace_until")
    final_warning_issued = bool((assessment or {}).get("final_violation_warning_issued"))

    # The final warning is issued exactly one confirmed violation before the
    # configured limit. The 15-second correction window is persisted so every
    # client and reconnect observes the same server-authoritative deadline.
    if current_count == max(1, allowed_limit - 1) and not final_warning_issued:
        grace_until = now + timedelta(seconds=15)
        await db.assessments.update_one(
            {"assessment_id": assessment_id},
            {"$set": {
                "final_violation_warning_issued": True,
                "violation_grace_until": grace_until,
                "violation_threshold": allowed_limit,
                "violationthreshold": allowed_limit,
                "updated_at": now,
            }},
        )
        return {
            "locked": False,
            "final_warning": True,
            "grace_active": True,
            "warning_level": "FINAL",
            "grace_seconds": 15,
            "grace_until": grace_until,
            "violation_count": current_count,
            "allowed_limit": allowed_limit,
            "remaining_violations": 1,
            "risk_score": current_risk,
            "violation": violation,
        }

    # A violation reaching the limit during the correction window does not
    # remove the candidate before the promised grace period has elapsed.
    if current_count >= allowed_limit and isinstance(grace_until, datetime) and now < grace_until:
        seconds_left = max(1, int((grace_until - now).total_seconds()))
        return {
            "locked": False,
            "final_warning": True,
            "grace_active": True,
            "warning_level": "FINAL",
            "grace_seconds": seconds_left,
            "grace_until": grace_until,
            "violation_count": current_count,
            "allowed_limit": allowed_limit,
            "remaining_violations": 0,
            "risk_score": current_risk,
            "violation": violation,
        }

    if current_count >= allowed_limit:
        await db.assessments.update_one(
            {"assessment_id": assessment_id},
            {"$set": {
                "status": "LOCKED",
                "assessment_status": "LOCKED",
                "final_status": "LOCKED",
                "threshold_reached": True,
                "thresholdreached": True,
                "requires_reentry_approval": True,
                "requiresreentryapproval": True,
                "violation_threshold": allowed_limit,
                "violationthreshold": allowed_limit,
                "violation_grace_until": None,
                "updated_at": now,
            }},
        )
        return {
            "locked": True,
            "threshold_reached": True,
            "warning_level": "REMOVAL",
            "violation_count": current_count,
            "allowed_limit": allowed_limit,
            "remaining_violations": 0,
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
        "remaining_violations": max(0, allowed_limit - current_count),
        "risk_score": current_risk,
        "violation": violation,
    }

async def get_warning_count(assessment_id: str, detail: str) -> int:
    db = get_db()
    result = await db.warnings.find_one({"assessment_id": assessment_id, "detail": detail})
    return result["count"] if result else 0

async def dismiss_violation(violation_id: str, examiner_id: str, reason: str = "False positive"):
    db = get_db()
    violation_query = {"$or": [{"violation_id": violation_id}, {"violationid": violation_id}]}
    violation = await db.violations.find_one(violation_query)
    if not violation:
        return None, None, "NOT_FOUND"
    if str(violation.get("status") or "").strip().upper() == "DISMISSED":
        assessment_id = violation.get("assessment_id") or violation.get("assessmentid")
        assessment = await db.assessments.find_one({"$or": [{"assessment_id": assessment_id}, {"assessmentid": assessment_id}]})
        return violation, assessment, "ALREADY_DISMISSED"
    now = datetime.utcnow()
    result = await db.violations.update_one(
        {"$and": [violation_query, {"status": {"$ne": "DISMISSED"}}]},
        {"$set": {
            "status": "DISMISSED",
            "reviewed": True,
            "reviewedby": examiner_id,
            "reviewed_by": examiner_id,
            "reviewnote": reason,
            "review_note": reason,
            "reviewedat": now,
            "reviewed_at": now,
            "dismissedby": examiner_id,
            "dismissed_by": examiner_id,
            "dismissedat": now,
            "dismissed_at": now,
            "dismissalreason": reason,
            "dismissal_reason": reason,
        }},
    )
    if result.modified_count != 1:
        latest = await db.violations.find_one(violation_query)
        assessment_id = (latest or violation).get("assessment_id") or (latest or violation).get("assessmentid")
        assessment = await db.assessments.find_one({"$or": [{"assessment_id": assessment_id}, {"assessmentid": assessment_id}]})
        return latest or violation, assessment, "ALREADY_DISMISSED"
    updated_violation = await db.violations.find_one(violation_query)
    assessment_id = updated_violation.get("assessment_id") or updated_violation.get("assessmentid")
    assessment_query = {"$or": [{"assessment_id": assessment_id}, {"assessmentid": assessment_id}]}
    active_query = {"$and": [assessment_query, {"status": {"$ne": "DISMISSED"}}]}
    active_violations = await db.violations.find(active_query).to_list(None)
    violation_count = len(active_violations)
    risk_score = sum(max(0, int(item.get("risk_score", item.get("riskscore", 0)) or 0)) for item in active_violations)
    assessment = await db.assessments.find_one(assessment_query) or {}
    threshold = int(assessment.get("violation_threshold", assessment.get("violationthreshold", 10)) or 10)
    update = {
        "violation_count": violation_count, "violationcount": violation_count,
        "risk_score": risk_score, "riskscore": risk_score,
        "credibility_score": max(0, min(100, 100 - risk_score)),
        "credibilityscore": max(0, min(100, 100 - risk_score)),
        "threshold_reached": violation_count >= threshold,
        "thresholdreached": violation_count >= threshold,
        "updated_at": now, "updatedat": now,
    }
    if violation_count < max(1, threshold - 1):
        update.update({
            "final_violation_warning_issued": False,
            "violation_grace_until": None,
        })
    current_status = str(assessment.get("status") or assessment.get("assessment_status") or "").upper()
    if current_status == "LOCKED" and violation_count < threshold:
        update.update({
            "status": "ACTIVE", "assessment_status": "ACTIVE", "assessmentstatus": "ACTIVE",
            "final_status": None, "finalstatus": None,
            "requires_reentry_approval": False, "requiresreentryapproval": False,
        })
    await db.assessments.update_one(assessment_query, {"$set": update})
    assessment = await db.assessments.find_one(assessment_query)
    return updated_violation, assessment, "DISMISSED"
