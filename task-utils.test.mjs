import test from "node:test";
import assert from "node:assert/strict";
import {
  getDueTimestamp,
  filterTasks,
  isTaskOverdue,
  normalizeTasks,
  persistTasks,
  validateSchedule,
} from "./task-utils.mjs";

test("normalizes old tasks and rejects malformed records", () => {
  assert.deepEqual(
    normalizeTasks([
      { id: "1", text: "  Задача  ", completed: false },
      { id: "2", text: "", completed: false },
      { id: 3, text: "Неверный id", completed: false },
    ]),
    [{ id: "1", text: "Задача", completed: false, dueDate: "", dueTime: "" }],
  );
});

test("validates schedule and invalid stored dates", () => {
  assert.equal(validateSchedule("", "12:30"), "Выберите дату для указанного времени.");
  assert.equal(validateSchedule("2026-11-10", "12:30"), "");
  assert.equal(getDueTimestamp({ dueDate: "2026-99-99", dueTime: "12:30" }), null);
});

test("detects overdue tasks but ignores completed ones", () => {
  const task = { dueDate: "2026-11-10", dueTime: "12:30", completed: false };
  const afterDeadline = new Date("2026-11-10T12:31").getTime();
  assert.equal(isTaskOverdue(task, afterDeadline), true);
  assert.equal(isTaskOverdue({ ...task, completed: true }, afterDeadline), false);
});

test("reports storage failures without throwing", () => {
  const storage = { setItem: () => { throw new Error("quota"); } };
  assert.equal(persistTasks(storage, "tasks", []), false);
});

test("filters active and completed tasks", () => {
  const tasks = [
    { id: "1", completed: false },
    { id: "2", completed: true },
  ];
  assert.deepEqual(filterTasks(tasks, "active"), [tasks[0]]);
  assert.deepEqual(filterTasks(tasks, "completed"), [tasks[1]]);
  assert.equal(filterTasks(tasks, "all"), tasks);
});
