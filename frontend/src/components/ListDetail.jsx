import { useEffect, useRef, useState } from "react";
import { CheckSquare, Hash, Link2, Minus, Plus, RefreshCw, Square, Trash2, X } from "lucide-react";
import { api } from "../api";

const LIST_TYPES = [
  { value: "checkbox", icon: CheckSquare, label: "Check" },
  { value: "bullet", icon: Minus, label: "Bullet" },
  { value: "numbered", icon: Hash, label: "Numbered" },
];

// Wraps each item row with swipe-left-to-delete on touch
function SwipeRow({ onDelete, children }) {
  const [offset, setOffset] = useState(0);
  const touch = useRef({ startX: 0, startY: 0, horiz: false });

  function onTouchStart(e) {
    touch.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, horiz: false };
    setOffset(0);
  }

  function onTouchMove(e) {
    const dx = e.touches[0].clientX - touch.current.startX;
    const dy = e.touches[0].clientY - touch.current.startY;
    if (!touch.current.horiz && Math.abs(dx) > 8) {
      touch.current.horiz = Math.abs(dx) > Math.abs(dy);
    }
    if (touch.current.horiz && dx < 0) {
      setOffset(Math.max(dx, -100));
    }
  }

  function onTouchEnd() {
    if (offset < -70) {
      onDelete();
    } else {
      setOffset(0);
    }
  }

  return (
    <div
      className="relative overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Red backdrop revealed as item slides */}
      <div className="absolute inset-0 flex items-center justify-end bg-danger/90 pr-4">
        <Trash2 size={16} className="text-white" />
      </div>
      <div
        className="relative bg-surface"
        style={{
          transform: `translateX(${offset}px)`,
          transition: offset === 0 ? "transform 0.2s ease" : "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default function ListDetail({ list, onChanged, onDelete }) {
  const [items, setItems] = useState(list.items ?? []);
  const [listType, setListType] = useState(list.list_type ?? "checkbox");
  const [draft, setDraft] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(list.name);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [linkedTask, setLinkedTask] = useState(null);
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [taskQuery, setTaskQuery] = useState("");
  const [allTasks, setAllTasks] = useState(null);
  const addInputRef = useRef(null);
  const taskPickerRef = useRef(null);

  useEffect(() => {
    setItems(list.items ?? []);
    setName(list.name);
    setListType(list.list_type ?? "checkbox");
    setLinkedTask(null);
    if (list.task_id) {
      api.listTasks().then((tasks) => {
        setLinkedTask(tasks.find((t) => t.id === list.task_id) ?? null);
      });
    }
  }, [list.id, list.task_id, list.list_type]);

  useEffect(() => {
    if (!showTaskPicker) return;
    if (!allTasks) api.listTasks().then(setAllTasks);
    function onOutside(e) {
      if (taskPickerRef.current && !taskPickerRef.current.contains(e.target)) {
        setShowTaskPicker(false);
        setTaskQuery("");
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [showTaskPicker, allTasks]);

  async function addItem(e) {
    e?.preventDefault();
    const content = draft.trim();
    if (!content) return;
    const item = await api.addListItem(list.id, { content, order: items.length });
    setItems((prev) => [...prev, item]);
    setDraft("");
    addInputRef.current?.focus();
    onChanged();
  }

  async function toggleItem(item) {
    if (listType !== "checkbox") return;
    const updated = await api.updateListItem(list.id, item.id, { checked: !item.checked });
    setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
    onChanged();
  }

  async function deleteItem(item) {
    await api.deleteListItem(list.id, item.id);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    onChanged();
  }

  async function resetList() {
    const updated = await api.resetList(list.id);
    setItems(updated.items ?? []);
    onChanged();
  }

  async function saveName() {
    const trimmed = name.trim();
    setEditingName(false);
    if (!trimmed || trimmed === list.name) return;
    await api.updateList(list.id, { name: trimmed });
    onChanged();
  }

  async function saveItemEdit(item) {
    const trimmed = editContent.trim();
    setEditingItemId(null);
    if (!trimmed || trimmed === item.content) return;
    const updated = await api.updateListItem(list.id, item.id, { content: trimmed });
    setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
  }

  async function changeType(type) {
    setListType(type);
    await api.updateList(list.id, { list_type: type });
    onChanged();
  }

  async function linkTask(task) {
    await api.updateList(list.id, { task_id: task.id });
    setLinkedTask(task);
    setShowTaskPicker(false);
    setTaskQuery("");
    onChanged();
  }

  async function unlinkTask() {
    await api.updateList(list.id, { task_id: null });
    setLinkedTask(null);
    onChanged();
  }

  const checkedCount = items.filter((i) => i.checked).length;
  const pct = items.length ? (checkedCount / items.length) * 100 : 0;
  const filteredTasks = allTasks
    ? allTasks
        .filter((t) => t.parent_id == null && t.content.toLowerCase().includes(taskQuery.toLowerCase().trim()))
        .slice(0, 12)
    : [];

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      {/* Header */}
      <div className="mb-3 flex items-start gap-2">
        {editingName ? (
          <form onSubmit={(e) => { e.preventDefault(); saveName(); }} className="flex-1">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setEditingName(false)}
              onBlur={saveName}
              className="w-full rounded bg-elevated px-2 py-1 text-[22px] font-semibold text-text-primary focus:outline-none"
            />
          </form>
        ) : (
          <h1
            className="flex-1 cursor-pointer text-[22px] font-semibold text-text-primary hover:text-accent"
            onClick={() => setEditingName(true)}
          >
            {list.name}
          </h1>
        )}
        {listType === "checkbox" && (
          <button
            onClick={resetList}
            title="Uncheck all"
            disabled={checkedCount === 0}
            className="mt-1 rounded-md p-1.5 text-text-muted transition-colors hover:bg-elevated hover:text-text-primary disabled:opacity-30"
          >
            <RefreshCw size={15} />
          </button>
        )}
        <button
          onClick={() => { if (confirm("Delete this list?")) onDelete(); }}
          title="Delete list"
          className="mt-1 rounded-md p-1.5 text-text-muted transition-colors hover:bg-elevated hover:text-danger"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {/* Type picker */}
      <div className="mb-4 flex gap-1">
        {LIST_TYPES.map(({ value, icon: Icon, label }) => (
          <button
            key={value}
            onClick={() => changeType(value)}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors ${
              listType === value
                ? "bg-accent/15 text-accent"
                : "text-text-muted hover:bg-elevated hover:text-text-secondary"
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {/* Linked task */}
      <div className="mb-4 relative" ref={taskPickerRef}>
        {linkedTask ? (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-elevated/60 px-3 py-2">
            <Link2 size={13} className="shrink-0 text-text-muted" />
            <span className="flex-1 truncate text-[13px] text-text-secondary">
              Linked: <span className="text-text-primary">{linkedTask.content}</span>
            </span>
            <button onClick={unlinkTask} className="shrink-0 text-text-muted hover:text-text-primary" title="Unlink">
              <X size={13} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowTaskPicker((v) => !v)}
            className="flex items-center gap-1.5 text-[13px] text-text-muted transition-colors hover:text-text-secondary"
          >
            <Link2 size={13} /> Link to task
          </button>
        )}
        {showTaskPicker && (
          <div className="absolute top-full left-0 z-20 mt-1 w-full max-w-sm rounded-xl border border-border bg-surface shadow-pop">
            <div className="border-b border-border px-3 py-2">
              <input
                autoFocus
                value={taskQuery}
                onChange={(e) => setTaskQuery(e.target.value)}
                placeholder="Search tasks…"
                className="w-full bg-transparent text-[14px] text-text-primary placeholder:text-text-muted focus:outline-none"
              />
            </div>
            <div className="max-h-52 overflow-y-auto py-1">
              {!allTasks && <p className="px-3 py-4 text-center text-[13px] text-text-muted">Loading…</p>}
              {allTasks && filteredTasks.length === 0 && <p className="px-3 py-4 text-center text-[13px] text-text-muted">No tasks found</p>}
              {filteredTasks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => linkTask(t)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-text-secondary hover:bg-elevated hover:text-text-primary"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full bg-text-muted/40" />
                  <span className="truncate">{t.content}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Progress bar (checkbox only) */}
      {listType === "checkbox" && items.length > 0 && (
        <div className="mb-5">
          <div className="mb-1.5 flex items-center justify-between text-[12px] text-text-muted">
            <span>{checkedCount} of {items.length} done</span>
            {checkedCount === items.length && <span className="font-medium text-accent">All done!</span>}
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-elevated">
            <div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {/* Add item — at top, Enter to submit */}
      <form onSubmit={addItem} className="mb-2 flex items-center gap-2.5 border-b border-border/40 pb-3">
        <Plus size={15} className="shrink-0 text-text-muted" />
        <input
          ref={addInputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add item…"
          className="flex-1 bg-transparent text-[15px] text-text-primary placeholder:text-text-muted focus:outline-none"
        />
        {draft.trim() && (
          <button type="submit" className="shrink-0 rounded bg-accent px-2.5 py-1 text-[12px] font-semibold text-white hover:bg-accent/90">
            Add
          </button>
        )}
      </form>

      {/* Items — swipe left to delete on mobile */}
      <div className="divide-y divide-border/30">
        {items.length === 0 && (
          <p className="py-6 text-center text-[14px] text-text-muted">No items yet.</p>
        )}
        {items.map((item, idx) => (
          <SwipeRow key={item.id} onDelete={() => deleteItem(item)}>
            <div className="group flex items-center gap-3 py-2.5">
              {/* Left indicator */}
              {listType === "checkbox" && (
                <button onClick={() => toggleItem(item)} className="shrink-0 transition-colors">
                  {item.checked
                    ? <CheckSquare size={20} className="text-accent" />
                    : <Square size={20} className="text-text-muted hover:text-text-secondary" />}
                </button>
              )}
              {listType === "bullet" && (
                <span className="shrink-0 text-[18px] leading-none text-text-muted">•</span>
              )}
              {listType === "numbered" && (
                <span className="w-5 shrink-0 text-right text-[13px] font-medium text-text-muted">{idx + 1}.</span>
              )}

              {/* Content — click to edit, Enter saves and refocuses add input */}
              {editingItemId === item.id ? (
                <input
                  autoFocus
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onBlur={() => saveItemEdit(item)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      saveItemEdit(item);
                      addInputRef.current?.focus();
                    }
                    if (e.key === "Escape") setEditingItemId(null);
                  }}
                  className="flex-1 bg-transparent text-[15px] text-text-primary focus:outline-none"
                />
              ) : (
                <span
                  onClick={() => { setEditingItemId(item.id); setEditContent(item.content); }}
                  className={`flex-1 cursor-text text-[15px] leading-snug ${
                    listType === "checkbox" && item.checked
                      ? "text-text-muted line-through"
                      : "text-text-primary"
                  }`}
                >
                  {item.content}
                </span>
              )}

              {/* Delete (desktop hover) */}
              <button
                onClick={() => deleteItem(item)}
                className="shrink-0 text-text-muted opacity-0 transition-all hover:text-danger group-hover:opacity-100 group-focus-within:opacity-100"
              >
                <X size={14} />
              </button>
            </div>
          </SwipeRow>
        ))}
      </div>
    </div>
  );
}
