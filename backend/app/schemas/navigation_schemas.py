from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class MapMatchPoint(BaseModel):
    latitude: float = Field(ge=-90, le=90, allow_inf_nan=False)
    longitude: float = Field(ge=-180, le=180, allow_inf_nan=False)
    accuracy: float = Field(default=20, ge=0, le=100, allow_inf_nan=False)
    heading: Optional[float] = Field(default=None, ge=0, le=360)
    speed: Optional[float] = Field(default=None, ge=0, le=200)
    capturedAt: Optional[datetime] = None


class MapMatchRequest(BaseModel):
    points: list[MapMatchPoint] = Field(min_length=2, max_length=100)


class MapMatchPointResult(BaseModel):
    rawLatitude: float
    rawLongitude: float
    matchedLatitude: Optional[float] = None
    matchedLongitude: Optional[float] = None
    confidence: Optional[float] = Field(default=None, ge=0, le=1)
    distanceFromRoadM: Optional[float] = None
    matched: bool


class MapMatchResponse(BaseModel):
    provider: str
    points: list[MapMatchPointResult]
