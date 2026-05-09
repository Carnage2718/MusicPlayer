from fastapi import Header, APIRouter, HTTPException
from pydantic import BaseModel
from app.database import get_connection

router = APIRouter(prefix="/auth", tags=["login"])

class LoginRequest(BaseModel):
    login_id: str
    password: str

def get_current_user(authorization: str = Header(None)):

    if not authorization:
        raise HTTPException(401)

    try:

        token = authorization.replace("Bearer ","")
        return int(token)

    except:
        raise HTTPException(401)
    

@router.post("/login")
def login(data: LoginRequest):

    conn = get_connection()
    cur = conn.cursor()

    try:

        cur.execute("""
            SELECT id, password_hash
            FROM users
            WHERE login_id=%s
        """, (data.login_id,))

        row = cur.fetchone()

        if not row:
            raise HTTPException(401, "Invalid login")

        user_id, password_hash = row

        # 仮（後でbcrypt）
        if data.password != password_hash:
            raise HTTPException(401, "Invalid password")

        return {
            "token": str(user_id),
            "user_id": user_id
        }

    finally:
        cur.close()
        conn.close()