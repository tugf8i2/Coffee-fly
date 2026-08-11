from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.schemas.login_schemas import LoginSchema
from app.services.login_services import login_user
from app.core.database import get_db    

router = APIRouter()


@router.post("/login")
def login(data: LoginSchema, db: Session = Depends(get_db)):
    return login_user(db, data)