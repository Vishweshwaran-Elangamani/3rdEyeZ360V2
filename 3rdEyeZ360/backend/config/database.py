from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv(override=False)

_client = None
_db = None


async def connect_db():
    global _client, _db

    mongo_url = os.getenv("MONGO_URL") or os.getenv("MONGODB_URL") or "mongodb://127.0.0.1:27017"
    db_name = os.getenv("MONGO_DB") or os.getenv("MONGODB_DB") or "samp_db"

    _client = AsyncIOMotorClient(mongo_url)
    _db = _client[db_name]

    existing_indexes = await _db.users.index_information()

    if "userid_1" in existing_indexes:
        await _db.users.drop_index("userid_1")

    if "keycloak_id_1" in existing_indexes:
        await _db.users.drop_index("keycloak_id_1")

    await _db.users.create_index("user_id", unique=True)
    await _db.users.create_index("keycloak_id", unique=True, sparse=True)
    await _db.users.create_index("email", unique=True)

    await _db.exams.create_index("exam_id", unique=True)
    await _db.assessments.create_index("assessment_id", unique=True)
    await _db.projects.create_index("project_id", unique=True)

    # Keep project names unique only for active/non-deleted projects.
    # A soft-deleted project remains available for historical audit/reporting,
    # while its former name can be reused by a newly created project.
    project_indexes = await _db.projects.index_information()
    normalized_index = project_indexes.get("normalized_name_1")
    expected_partial_filter = {"is_deleted": False}
    if normalized_index and (
        not normalized_index.get("unique")
        or normalized_index.get("partialFilterExpression") != expected_partial_filter
    ):
        await _db.projects.drop_index("normalized_name_1")

    await _db.projects.create_index(
        "normalized_name",
        unique=True,
        partialFilterExpression=expected_partial_filter,
    )
    await _db.project_user_mappings.create_index([("project_id", 1), ("user_id", 1), ("role", 1)], unique=True)
    await _db.project_user_mappings.create_index([("user_id", 1), ("is_active", 1)])

    print(f"MongoDB connected - {db_name}")


async def close_db():
    global _client, _db
    if _client is not None:
        _client.close()
        _client = None
        _db = None


def get_db():
    if _db is None:
        raise RuntimeError("Database not initialized. Call connect_db() first.")
    return _db


connectdb = connect_db
closedb = close_db
getdb = get_db
