from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict, Field

# --- Labels ---


class LabelBase(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    color: str = "#999999"
    order: int = 0


class LabelCreate(LabelBase):
    pass


class LabelUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=64)
    color: str | None = None
    order: int | None = None


class LabelOut(LabelBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime


# --- Views ---


class ViewBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    icon: str | None = None
    filter_json: str = "{}"
    order: int = 0


class ViewCreate(ViewBase):
    pass


class ViewUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    icon: str | None = None
    filter_json: str | None = None
    order: int | None = None


class ViewOut(ViewBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime


# --- Projects ---


class ProjectBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    color: str = "#c96442"
    icon: str | None = None
    order: int = 0
    pinned: bool = False


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    color: str | None = None
    icon: str | None = None
    order: int | None = None
    pinned: bool | None = None
    archived: bool | None = None


class ProjectOut(ProjectBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    archived: bool = False
    archived_at: datetime | None = None
    created_at: datetime
    task_count: int = 0
    completed_count: int = 0


# --- Sections ---


class SectionBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    icon: str | None = None
    order: int = 0


class SectionCreate(SectionBase):
    project_id: int


class SectionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    icon: str | None = None
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
    effort: float | None = None
    recurrence_rule: str | None = None
    due_date: date | None = None
    due_time: time | None = None
    reminder_time: datetime | None = None
    section_id: int | None = None
    parent_id: int | None = None
    order: int = 0


class TaskCreate(TaskBase):
    project_id: int
    label_ids: list[int] = []


class TaskUpdate(BaseModel):
    content: str | None = Field(default=None, min_length=1, max_length=500)
    description: str | None = None
    priority: int | None = Field(default=None, ge=1, le=4)
    effort: float | None = None
    recurrence_rule: str | None = None
    due_date: date | None = None
    due_time: time | None = None
    reminder_time: datetime | None = None
    project_id: int | None = None
    section_id: int | None = None
    order: int | None = None
    label_ids: list[int] | None = None


class TaskOut(TaskBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    completed: bool
    completed_at: datetime | None
    created_at: datetime
    labels: list[LabelOut] = []


class ReorderItem(BaseModel):
    id: int
    order: int


class ReorderRequest(BaseModel):
    items: list[ReorderItem]


# --- Lists ---


class ListItemBase(BaseModel):
    content: str = Field(min_length=1, max_length=500)
    checked: bool = False
    order: int = 0


class ListItemCreate(ListItemBase):
    pass


class ListItemUpdate(BaseModel):
    content: str | None = Field(default=None, min_length=1, max_length=500)
    checked: bool | None = None
    order: int | None = None


class ListItemOut(ListItemBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    list_id: int
    created_at: datetime


class ListBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    icon: str | None = None
    color: str = "#c96442"
    list_type: str = "checkbox"
    task_id: int | None = None
    order: int = 0


class ListCreate(ListBase):
    pass


class ListUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    icon: str | None = None
    color: str | None = None
    list_type: str | None = None
    task_id: int | None = None
    order: int | None = None
    archived: bool | None = None


class ListOut(ListBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    archived: bool = False
    archived_at: datetime | None = None
    created_at: datetime
    items: list[ListItemOut] = []
    item_count: int = 0
    checked_count: int = 0
