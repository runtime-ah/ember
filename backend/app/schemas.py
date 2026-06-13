from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict, Field

# --- Projects ---


class ProjectBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    color: str = "#c96442"
    order: int = 0


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    color: str | None = None
    order: int | None = None


class ProjectOut(ProjectBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime


# --- Sections ---


class SectionBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    order: int = 0


class SectionCreate(SectionBase):
    project_id: int


class SectionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    order: int | None = None


class SectionOut(SectionBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    created_at: datetime


# --- Tasks ---


class TaskBase(BaseModel):
    content: str = Field(min_length=1, max_length=500)
    description: str | None = None
    priority: int = Field(default=4, ge=1, le=4)
    due_date: date | None = None
    due_time: time | None = None
    reminder_time: datetime | None = None
    section_id: int | None = None
    parent_id: int | None = None
    order: int = 0


class TaskCreate(TaskBase):
    project_id: int


class TaskUpdate(BaseModel):
    content: str | None = Field(default=None, min_length=1, max_length=500)
    description: str | None = None
    priority: int | None = Field(default=None, ge=1, le=4)
    due_date: date | None = None
    due_time: time | None = None
    reminder_time: datetime | None = None
    project_id: int | None = None
    section_id: int | None = None
    order: int | None = None


class TaskOut(TaskBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    completed: bool
    completed_at: datetime | None
    created_at: datetime


class ReorderItem(BaseModel):
    id: int
    order: int


class ReorderRequest(BaseModel):
    items: list[ReorderItem]
