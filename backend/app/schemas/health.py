from pydantic import BaseModel


class StatusHealth(BaseModel):
    status: str
    database: str
