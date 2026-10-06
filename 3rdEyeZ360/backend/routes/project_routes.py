from datetime import datetime
import re, uuid
from pymongo.errors import DuplicateKeyError
from fastapi import APIRouter, Depends, HTTPException
from config.database import get_db
from middleware.auth import require_role
from services.assessment_service import log_audit

router = APIRouter(prefix="/api/projects", tags=["Projects"])
NAME_RE = re.compile(r"^[A-Z0-9 _-]+$")

def uid(user): return str(user.get("user_id") or user.get("userid") or "")
def project_id(doc): return str(doc.get("project_id") or doc.get("projectid") or "")
def clean_name(value):
    name = " ".join(str(value or "").strip().upper().split())
    if not name: raise HTTPException(400, "Project name is required")
    if len(name) > 20: raise HTTPException(400, "Project name must not exceed 20 characters")
    if not NAME_RE.fullmatch(name): raise HTTPException(400, "Project name may contain only A-Z, 0-9, spaces, hyphens and underscores")
    return name

def serialize(doc):
    if not doc: return None
    return {k: str(v) if k == "_id" else v for k,v in doc.items() if k != "_id"}

async def active_project(db, pid):
    doc = await db.projects.find_one({"$and":[{"$or":[{"project_id":pid},{"projectid":pid}]},{"is_deleted":{"$ne":True}}]})
    if not doc: raise HTTPException(404,"Project not found")
    return doc

@router.get("")
async def list_projects(current_user=Depends(require_role("Admin","Examiner","Candidate"))):
    db=get_db(); user_id=uid(current_user); role=current_user.get("role")
    query={"is_deleted":{"$ne":True}}
    if role != "Admin":
        mappings=await db.project_user_mappings.find({"user_id":user_id,"is_active":True}).to_list(None)
        ids=[m["project_id"] for m in mappings]
        query={"project_id":{"$in":ids},"is_deleted":{"$ne":True}}
    rows=await db.projects.find(query).sort("project_name",1).to_list(None)
    result=[]
    for row in rows:
        pid=project_id(row)
        result.append({**serialize(row),
          "candidate_count":await db.project_user_mappings.count_documents({"project_id":pid,"role":"Candidate","is_active":True}),
          "examiner_count":await db.project_user_mappings.count_documents({"project_id":pid,"role":"Examiner","is_active":True})})
    return result

@router.get("/me")
async def my_projects(current_user=Depends(require_role("Admin","Examiner","Candidate"))):
    db=get_db(); ids=[m["project_id"] for m in await db.project_user_mappings.find({"user_id":uid(current_user),"is_active":True}).to_list(None)]
    return [serialize(x) for x in await db.projects.find({"project_id":{"$in":ids},"is_deleted":{"$ne":True}}).sort("project_name",1).to_list(None)]

@router.post("")
async def create_project(body:dict,current_user=Depends(require_role("Admin"))):
    db=get_db(); name=clean_name(body.get("project_name") or body.get("name")); now=datetime.utcnow()
    if await db.projects.find_one({"normalized_name": name, "is_deleted": False}):
        raise HTTPException(409, "A project with this name already exists")
    pid=f"PRJ-{uuid.uuid4().hex[:8].upper()}"; actor=uid(current_user)
    doc={"project_id":pid,"projectid":pid,"project_name":name,"projectname":name,"normalized_name":name,"is_active":True,"is_deleted":False,"created_by":actor,"created_at":now,"updated_at":now}
    try:
        await db.projects.insert_one(doc)
    except DuplicateKeyError as error:
        raise HTTPException(409, "A project with this name already exists") from error
    await log_audit(actor,"PROJECT_CREATED",f"Created project {name}",detail=f"project_id={pid}",metadata={"project_id":pid})
    return serialize(doc)

@router.patch("/{pid}")
async def rename_project(pid:str,body:dict,current_user=Depends(require_role("Admin"))):
    db=get_db(); old=await active_project(db,pid); name=clean_name(body.get("project_name") or body.get("name"))
    duplicate=await db.projects.find_one({"normalized_name": name, "project_id": {"$ne": pid}, "is_deleted": False})
    if duplicate: raise HTTPException(409,"A project with this name already exists")
    now=datetime.utcnow(); actor=uid(current_user)
    try:
        await db.projects.update_one({"_id":old["_id"]},{"$set":{"project_name":name,"projectname":name,"normalized_name":name,"updated_at":now,"updated_by":actor}})
    except DuplicateKeyError as error:
        raise HTTPException(409, "A project with this name already exists") from error
    await log_audit(actor,"PROJECT_RENAMED",f"Renamed {old.get('project_name')} to {name}",detail=f"project_id={pid}",metadata={"project_id":pid})
    return {"project_id":pid,"project_name":name}

@router.delete("/{pid}")
async def delete_project(pid:str,current_user=Depends(require_role("Admin"))):
    db=get_db(); project=await active_project(db,pid); now=datetime.utcnow(); actor=uid(current_user)
    unmapped=await db.project_user_mappings.count_documents({"project_id":pid,"is_active":True})
    await db.project_user_mappings.update_many({"project_id":pid,"is_active":True},{"$set":{"is_active":False,"unmapped_at":now,"unmapped_by":actor}})
    await db.projects.update_one({"_id":project["_id"]},{"$set":{"is_deleted":True,"is_active":False,"deleted_at":now,"deleted_by":actor,"updated_at":now}})
    await log_audit(actor,"PROJECT_DELETED",f"Deleted {project.get('project_name')} and unmapped {unmapped} users",detail=f"project_id={pid}",metadata={"project_id":pid,"unmapped_count":unmapped})
    return {"message":"Project deleted","unmapped_count":unmapped}

@router.get("/{pid}/members")
async def members(pid:str,current_user=Depends(require_role("Admin"))):
    db=get_db(); await active_project(db,pid)
    maps=await db.project_user_mappings.find({"project_id":pid,"is_active":True}).to_list(None); ids=[m["user_id"] for m in maps]
    users=await db.users.find({"$or":[{"user_id":{"$in":ids}},{"userid":{"$in":ids}}]}).to_list(None)
    byid={str(u.get("user_id") or u.get("userid")):u for u in users}
    return [{"mapping_id":m.get("mapping_id"),"project_id":pid,"user_id":m["user_id"],"role":m["role"],"mapped_at":m.get("mapped_at"),"user":serialize(byid.get(m["user_id"],{}))} for m in maps]

@router.get("/{pid}/membership-overview/{role}")
async def membership_overview(pid:str,role:str,current_user=Depends(require_role("Admin"))):
    db=get_db(); await active_project(db,pid); role=role.title()
    if role not in ("Candidate","Examiner"): raise HTTPException(400,"Invalid role")
    mappings=await db.project_user_mappings.find({"role":role,"is_active":True}).to_list(None)
    project_ids=list(dict.fromkeys([str(mapping.get("project_id") or "") for mapping in mappings if mapping.get("project_id")]))
    project_rows=await db.projects.find({"project_id":{"$in":project_ids},"is_deleted":{"$ne":True}}).to_list(None)
    names={project_id(project):project.get("project_name") or project.get("projectname") or "" for project in project_rows}
    overview={}
    for mapping in mappings:
        user_id=str(mapping.get("user_id") or ""); mapped_project_id=str(mapping.get("project_id") or "")
        if not user_id or mapped_project_id not in names: continue
        overview.setdefault(user_id,[]).append({"project_id":mapped_project_id,"project_name":names[mapped_project_id],"is_current":mapped_project_id==pid})
    for memberships in overview.values(): memberships.sort(key=lambda membership:membership["project_name"])
    return overview

@router.get("/{pid}/eligible/{role}")
async def eligible(pid:str,role:str,current_user=Depends(require_role("Admin","Examiner"))):
    db=get_db(); await active_project(db,pid); role=role.title()
    if role not in ("Candidate","Examiner"): raise HTTPException(400,"Invalid role")
    mapped=[m["user_id"] for m in await db.project_user_mappings.find({"project_id":pid,"role":role,"is_active":True}).to_list(None)]
    users=await db.users.find({"role":role,"status":"Active","$or":[{"user_id":{"$in":mapped}},{"userid":{"$in":mapped}}]}).to_list(None)
    return [serialize(u) for u in users]

@router.post("/{pid}/members")
async def map_members(pid:str,body:dict,current_user=Depends(require_role("Admin"))):
    db=get_db(); project=await active_project(db,pid); ids=list(dict.fromkeys([str(x) for x in body.get("user_ids",[]) if x])); role=str(body.get("role") or "").title()
    if role not in ("Candidate","Examiner") or not ids: raise HTTPException(400,"Select users and a valid role")
    users=await db.users.find({"role":role,"$or":[{"user_id":{"$in":ids}},{"userid":{"$in":ids}}]}).to_list(None); valid={str(u.get("user_id") or u.get("userid")) for u in users}
    if valid != set(ids): raise HTTPException(400,"One or more selected users are invalid")
    now=datetime.utcnow(); actor=uid(current_user); created=0; already=[]
    notices={}
    for user_id in ids:
        existing_projects=await db.project_user_mappings.find({"user_id":user_id,"is_active":True}).to_list(None)
        epids=[m["project_id"] for m in existing_projects]
        notices[user_id]=[p.get("project_name") for p in await db.projects.find({"project_id":{"$in":epids},"is_deleted":{"$ne":True}}).to_list(None)]
        existing=await db.project_user_mappings.find_one({"project_id":pid,"user_id":user_id,"role":role})
        if existing and existing.get("is_active"): already.append(user_id); continue
        mid=f"PMAP-{uuid.uuid4().hex[:8].upper()}"
        if existing: await db.project_user_mappings.update_one({"_id":existing["_id"]},{"$set":{"is_active":True,"mapped_at":now,"mapped_by":actor,"unmapped_at":None,"unmapped_by":None}})
        else: await db.project_user_mappings.insert_one({"mapping_id":mid,"project_id":pid,"user_id":user_id,"role":role,"is_active":True,"mapped_at":now,"mapped_by":actor})
        created+=1
    await log_audit(actor,"PROJECT_USER_MAPPED",f"Mapped {created} {role}(s) to {project.get('project_name')}",detail=f"project_id={pid}",metadata={"project_id":pid,"count":created})
    return {"message":f"Mapped {created} user(s)","mapped":created,"already_mapped":already,"existing_projects":notices}

@router.delete("/{pid}/members")
async def unmap_members(pid:str,body:dict,current_user=Depends(require_role("Admin"))):
    db=get_db(); project=await active_project(db,pid); ids=[str(x) for x in body.get("user_ids",[])]; now=datetime.utcnow(); actor=uid(current_user)
    result=await db.project_user_mappings.update_many({"project_id":pid,"user_id":{"$in":ids},"is_active":True},{"$set":{"is_active":False,"unmapped_at":now,"unmapped_by":actor}})
    await log_audit(actor,"PROJECT_USER_UNMAPPED",f"Unmapped {result.modified_count} users from {project.get('project_name')}",detail=f"project_id={pid}",metadata={"project_id":pid,"count":result.modified_count})
    return {"message":"Users unmapped","unmapped":result.modified_count}
