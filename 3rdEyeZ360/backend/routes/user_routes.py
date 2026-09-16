from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from typing import Optional
import base64
import csv
import io
import re
import zipfile
import xml.etree.ElementTree as ET

from controllers.user_controller import (
    create_user_in_keycloak,
    disable_user,
    enable_user,
    get_all_users,
    get_user_by_id,
    send_password_setup_email,
)
from middleware.auth import require_role

router = APIRouter(prefix="/api/users", tags=["Users"])


class CreateUserRequest(BaseModel):
    name: str
    email: EmailStr
    role: str
    password: Optional[str] = None


class BulkUserFileRequest(BaseModel):
    filename: str
    content_base64: str


_BULK_COLUMNS = ["first_name", "last_name", "email", "role"]
_EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def _clean_header(value) -> str:
    return re.sub(r"[^a-z0-9]+", "_", str(value or "").strip().lower()).strip("_")


def _parse_csv_rows(raw: bytes) -> list[dict]:
    text = raw.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="The uploaded file has no header row")
    reader.fieldnames = [_clean_header(value) for value in reader.fieldnames]
    return [{_clean_header(key): str(value or "").strip() for key, value in row.items()} for row in reader]


def _xlsx_cell_text(cell, shared_strings: list[str], namespace: dict) -> str:
    cell_type = cell.attrib.get("t")
    value = cell.find("main:v", namespace)
    if value is None:
        inline = cell.find("main:is/main:t", namespace)
        return (inline.text or "").strip() if inline is not None else ""
    raw = value.text or ""
    if cell_type == "s":
        try:
            return shared_strings[int(raw)].strip()
        except (ValueError, IndexError):
            return ""
    return raw.strip()


def _parse_xlsx_rows(raw: bytes) -> list[dict]:
    namespace = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        shared_strings = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in root.findall("main:si", namespace):
                shared_strings.append("".join(node.text or "" for node in item.findall(".//main:t", namespace)))
        worksheet_names = sorted(name for name in archive.namelist() if name.startswith("xl/worksheets/sheet") and name.endswith(".xml"))
        if not worksheet_names:
            raise HTTPException(status_code=400, detail="The Excel file contains no worksheet")
        root = ET.fromstring(archive.read(worksheet_names[0]))
        rows = []
        for row in root.findall(".//main:sheetData/main:row", namespace):
            values = {}
            for cell in row.findall("main:c", namespace):
                reference = cell.attrib.get("r", "")
                column_letters = "".join(character for character in reference if character.isalpha())
                column_index = 0
                for character in column_letters.upper():
                    column_index = column_index * 26 + ord(character) - 64
                if column_index:
                    values[column_index - 1] = _xlsx_cell_text(cell, shared_strings, namespace)
            if values:
                rows.append([values.get(index, "") for index in range(max(values) + 1)])
        if not rows:
            raise HTTPException(status_code=400, detail="The Excel file is empty")
        headers = [_clean_header(value) for value in rows[0]]
        return [{headers[index]: str(value or "").strip() for index, value in enumerate(row) if index < len(headers) and headers[index]} for row in rows[1:]]


def _decode_bulk_file(request: BulkUserFileRequest) -> list[dict]:
    try:
        raw = base64.b64decode(request.content_base64, validate=True)
    except Exception as error:
        raise HTTPException(status_code=400, detail="The uploaded file content is invalid") from error
    if not raw:
        raise HTTPException(status_code=400, detail="The uploaded file is empty")
    extension = request.filename.lower().rsplit(".", 1)[-1] if "." in request.filename else ""
    try:
        if extension == "csv":
            return _parse_csv_rows(raw)
        if extension == "xlsx":
            return _parse_xlsx_rows(raw)
    except (UnicodeDecodeError, zipfile.BadZipFile, ET.ParseError) as error:
        raise HTTPException(status_code=400, detail="The uploaded file could not be read") from error
    raise HTTPException(status_code=400, detail="Only CSV and XLSX files are supported")


def _validate_bulk_rows(rows: list[dict]) -> list[dict]:
    results = []
    encountered_emails = set()
    for index, row in enumerate(rows, start=2):
        first_name = str(row.get("first_name") or row.get("firstname") or "").strip()
        last_name = str(row.get("last_name") or row.get("lastname") or "").strip()
        email = str(row.get("email") or "").strip().lower()
        raw_role = str(row.get("role") or "").strip().lower()
        role = "Candidate" if raw_role == "candidate" else "Examiner" if raw_role == "examiner" else ""
        errors = []
        if not first_name: errors.append("First name is required")
        if not last_name: errors.append("Last name is required")
        if not email: errors.append("Email is required")
        elif not _EMAIL_PATTERN.match(email): errors.append("Email is invalid")
        elif email in encountered_emails: errors.append("Duplicate email in file")
        if not role: errors.append("Role must be Candidate or Examiner")
        if email: encountered_emails.add(email)
        results.append({
            "row": index,
            "first_name": first_name,
            "last_name": last_name,
            "name": f"{first_name} {last_name}".strip(),
            "email": email,
            "role": role or str(row.get("role") or "").strip(),
            "valid": not errors,
            "errors": errors,
        })
    if not results:
        raise HTTPException(status_code=400, detail="The uploaded file has no user rows")
    return results


@router.get("")
async def list_users(
    role: str | None = None,
    current_user=Depends(require_role("Admin", "Examiner")),
):
    if current_user["role"] == "Examiner" and role != "Candidate":
        raise HTTPException(status_code=403, detail="Access denied")

    return await get_all_users(role)


@router.post("/bulk/validate")
async def validate_bulk_users(
    req: BulkUserFileRequest,
    current_user=Depends(require_role("Admin")),
):
    rows = _validate_bulk_rows(_decode_bulk_file(req))
    return {
        "rows": rows,
        "total": len(rows),
        "valid": sum(1 for row in rows if row["valid"]),
        "invalid": sum(1 for row in rows if not row["valid"]),
    }


@router.post("/bulk/create")
async def create_bulk_users(
    req: BulkUserFileRequest,
    current_user=Depends(require_role("Admin")),
):
    rows = _validate_bulk_rows(_decode_bulk_file(req))
    results = []
    for row in rows:
        if not row["valid"]:
            results.append({**row, "status": "failed", "message": "; ".join(row["errors"])})
            continue
        try:
            response = await create_user_in_keycloak(row["name"], row["email"], row["role"], None)
            results.append({**row, "status": "created", "message": response.get("message", "User created") if isinstance(response, dict) else "User created"})
        except HTTPException as error:
            results.append({**row, "status": "failed", "message": str(error.detail)})
        except Exception:
            results.append({**row, "status": "failed", "message": "Account provisioning failed"})
    return {
        "results": results,
        "total": len(results),
        "created": sum(1 for row in results if row["status"] == "created"),
        "failed": sum(1 for row in results if row["status"] != "created"),
    }


@router.get("/{user_id}")
async def get_user(
    user_id: str,
    current_user=Depends(require_role("Admin", "Examiner")),
):
    user = await get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if current_user["role"] == "Examiner" and user.get("role") != "Candidate":
        raise HTTPException(status_code=403, detail="Access denied")

    return user


@router.post("")
async def create_user(
    req: CreateUserRequest,
    current_user=Depends(require_role("Admin")),
):
    return await create_user_in_keycloak(req.name, req.email, req.role, req.password)


@router.post("/{user_id}/disable")
async def disable_user_route(
    user_id: str,
    current_user=Depends(require_role("Admin")),
):
    return await disable_user(user_id)


@router.post("/{user_id}/enable")
async def enable_user_route(
    user_id: str,
    current_user=Depends(require_role("Admin")),
):
    return await enable_user(user_id)


@router.post("/{user_id}/send-password-email")
async def send_password_email_route(
    user_id: str,
    current_user=Depends(require_role("Admin")),
):
    return await send_password_setup_email(user_id)