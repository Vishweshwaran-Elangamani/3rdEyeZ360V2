from fastapi import APIRouter, Depends
from config.database import get_db
from middleware.auth import require_role

router = APIRouter(prefix="/api/admin", tags=["Admin"])


def _serialize(document: dict) -> dict:
    return {k: str(v) if k == "_id" else v for k, v in document.items() if k != "_id"}


@router.get("/stats")
async def get_stats(current_user=Depends(require_role("Admin"))):
    db = get_db()
    return {
        "total_candidates": await db.users.count_documents({"role": "Candidate"}),
        "total_examiners": await db.users.count_documents({"role": "Examiner"}),
        "total_exams": await db.exams.count_documents({}),
        "active_assessments": await db.assessments.count_documents({"status": "ACTIVE"}),
    }


@router.get("/audit-logs")
async def get_audit_logs(current_user=Depends(require_role("Admin"))):
    db = get_db()
    logs = await db.audit_logs.find().sort("timestamp", -1).limit(200).to_list(None)
    user_ids = {
        str(log.get("user_id") or log.get("userid") or "").strip()
        for log in logs
    }
    user_ids.discard("")
    users = await db.users.find(
        {"$or": [
            {"user_id": {"$in": list(user_ids)}},
            {"userid": {"$in": list(user_ids)}},
        ]},
        {"_id": 0, "user_id": 1, "userid": 1, "name": 1},
    ).to_list(None) if user_ids else []
    names_by_id = {
        str(user.get("user_id") or user.get("userid") or "").strip():
            str(user.get("name") or "").strip()
        for user in users
    }
    result = []
    for log in logs:
        payload = _serialize(log)
        user_id = str(log.get("user_id") or log.get("userid") or "").strip()
        user_name = names_by_id.get(user_id) or "Unknown User"
        payload["user_name"] = user_name
        payload["username"] = user_name
        result.append(payload)
    return result
