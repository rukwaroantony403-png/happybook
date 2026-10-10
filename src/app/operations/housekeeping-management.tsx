"use client";

import { useState, type FormEvent } from "react";
import type { LiveSnapshot } from "../operations-live";

type Row = Record<string, unknown>;
type SaveRecord = (kind: string, record: Row) => Promise<Row | null>;

const text = (value: unknown) => value === null || value === undefined || value === "" ? "—" : String(value);
const terminalStatuses = new Set(["ready", "done"]);
const statusLabels: Record<string, string> = {
  reported: "Reported",
  dirty: "Awaiting clean",
  "in-progress": "In progress",
  ready: "Ready for guests",
  done: "Complete",
};
const taskSuggestions = [
  "Departure clean",
  "Daily housekeeping",
  "Deep clean",
  "Linen change",
  "Room inspection",
  "Restock supplies",
];

export function HousekeepingManagement({ tasks, roomUnits, search, persistRecord, refresh, action }: {
  tasks: Row[];
  roomUnits: LiveSnapshot["roomUnits"];
  search: string;
  persistRecord: SaveRecord;
  refresh: () => Promise<void>;
  action: (message: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const openTasks = tasks.filter((task) => !terminalStatuses.has(String(task.status || "reported")));
  const urgentTasks = openTasks.filter((task) => ["high", "urgent"].includes(String(task.priority || "").toLowerCase()));
  const roomsBeingPrepared = roomUnits.filter((unit) => String(unit.operationalStatus || "") === "dirty");
  const visibleTasks = tasks.filter((task) => !search || Object.values(task).join(" ").toLowerCase().includes(search.toLowerCase()));

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const record: Row = {
      room: String(form.get("room") || "").trim(),
      task: String(form.get("task") || "").trim(),
      assignedTo: String(form.get("assignedTo") || "").trim(),
      priority: String(form.get("priority") || "normal"),
      dueDate: String(form.get("dueDate") || ""),
      description: String(form.get("description") || "").trim(),
      status: "reported",
    };
    setSaving(true);
    try {
      const saved = await persistRecord("housekeeping", record);
      if (!saved) throw new Error("Check the room number and task, then try again.");
      formElement.reset();
      await refresh();
      action(`Housekeeping task created for room ${record.room}. The room is held from new bookings until it is ready.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The housekeeping task could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function updateTask(task: Row, status: string) {
    setError("");
    setSaving(true);
    try {
      const saved = await persistRecord("housekeeping", { ...task, status });
      if (!saved) throw new Error("The housekeeping task could not be updated.");
      await refresh();
      if (status === "ready" || status === "done") {
        action(`Room ${String(task.room)} is ready for new bookings, unless another open task still needs attention.`);
      } else {
        action(`Housekeeping task for room ${String(task.room)} updated.`);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The housekeeping task could not be updated.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="housekeeping-workspace">
    <section className="housekeeping-summary" aria-label="Housekeeping summary">
      <article><span>Open tasks</span><b>{openTasks.length}</b><small>Rooms awaiting housekeeping</small></article>
      <article className={urgentTasks.length ? "housekeeping-summary-alert" : ""}><span>High priority</span><b>{urgentTasks.length}</b><small>Urgent tasks first</small></article>
      <article><span>Rooms being prepared</span><b>{roomsBeingPrepared.length}</b><small>Temporarily held from booking</small></article>
    </section>

    <form className="room-setup-form housekeeping-task-form" onSubmit={(event) => void createTask(event)}>
      <h2>Create a room task</h2>
      <p>Room numbers are suggested from active room inventory. Rooms stay unavailable while open housekeeping work is in progress.</p>
      {error && <p className="room-form-message" role="alert">{error}</p>}
      <div>
        <label>Room number
          <input name="room" list="housekeeping-room-suggestions" autoComplete="off" required maxLength={100} placeholder="Type a room number, e.g. A1"/>
          <datalist id="housekeeping-room-suggestions">
            {roomUnits.map((unit) => <option key={String(unit.id)} value={String(unit.code || "")}>
              {String(unit.category || unit.slug || "Room")} · {String(unit.operationalStatus || "available")}
            </option>)}
          </datalist>
        </label>
        <label>Task
          <input name="task" list="housekeeping-task-suggestions" required maxLength={160} placeholder="Choose or type a task"/>
          <datalist id="housekeeping-task-suggestions">{taskSuggestions.map((task) => <option key={task} value={task}/>)}</datalist>
        </label>
        <label>Assigned to<input name="assignedTo" maxLength={120} placeholder="Staff member (optional)"/></label>
        <label>Priority<select name="priority" defaultValue="normal"><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
        <label>Due date<input name="dueDate" type="date"/></label>
        <label className="housekeeping-wide-field">Task details<textarea name="description" rows={2} maxLength={1000} placeholder="Optional instructions, supplies, or inspection notes"/></label>
        <div className="housekeeping-form-actions"><button className="primary-btn" disabled={saving}>{saving ? "Saving task…" : "Create task"}</button></div>
      </div>
    </form>

    <section className="housekeeping-task-list">
      <header><div><h2>Room task board</h2><p>Checkout cleaning is added automatically for every physical room assigned to the reservation.</p></div></header>
      {visibleTasks.length ? <div className="housekeeping-task-grid">{visibleTasks.map((task) => {
        const room = roomUnits.find((unit) => String(unit.code) === String(task.room));
        const status = String(task.status || "reported");
        const isOpen = !terminalStatuses.has(status);
        return <article className={`housekeeping-task-card${isOpen && ["high", "urgent"].includes(String(task.priority || "").toLowerCase()) ? " housekeeping-task-priority" : ""}`} key={String(task.id || task.key)}>
          <div className="housekeeping-task-card-head">
            <div><span className="housekeeping-task-room">Room {text(task.room)}</span><small>{text(room?.category || room?.slug || task.roomType)}</small></div>
            <span className={`housekeeping-task-status housekeeping-status-${status === "dirty" ? "reported" : status}`}>{statusLabels[status] || status.replaceAll("-", " ")}</span>
          </div>
          <h3>{text(task.task)}</h3>
          <p>{text(task.description)}</p>
          <dl>
            <div><dt>Priority</dt><dd>{text(task.priority || "normal")}</dd></div>
            <div><dt>Assigned to</dt><dd>{text(task.assignedTo)}</dd></div>
            <div><dt>Due</dt><dd>{text(task.dueDate || task.checkOut)}</dd></div>
          </dl>
          {Boolean(task.reservationReference) && <small className="housekeeping-reservation-link">Checkout · {String(task.reservationReference)}{task.guest ? ` · ${String(task.guest)}` : ""}</small>}
          <label className="housekeeping-status-control">Update task
            <select value={status === "dirty" ? "reported" : status} disabled={saving} onChange={(event) => void updateTask(task, event.target.value)}>
              {Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </label>
        </article>;
      })}</div> : <div className="live-empty"><b>{tasks.length ? "No tasks match your search" : "No housekeeping tasks yet"}</b><p>{tasks.length ? "Try another room number, task, or reservation reference." : "New tasks and checkout cleaning will appear here."}</p></div>}
    </section>
  </div>;
}
