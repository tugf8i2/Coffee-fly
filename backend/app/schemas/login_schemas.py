from pydantic import BaseModel


class LoginSchema(BaseModel):
    email: str
    password: str
    device_id: str | None = None
    device_name: str | None = None
    device_platform: str | None = None
