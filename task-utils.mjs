export function normalizeTasks(value) {
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (task) =>
        task &&
        typeof task.id === "string" &&
        typeof task.text === "string" &&
        typeof task.completed === "boolean",
    )
    .map((task) => ({
      ...task,
      id: task.id.trim().slice(0, 100),
      text: task.text.trim().slice(0, 160),
      dueDate: /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate) ? task.dueDate : "",
      dueTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(task.dueTime) ? task.dueTime : "",
    }))
    .filter((task) => task.id && task.text);
}

export function getDueTimestamp(task) {
  if (!task.dueDate) return null;
  const timestamp = new Date(`${task.dueDate}T${task.dueTime || "23:59"}`).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function isTaskOverdue(task, now = Date.now()) {
  const timestamp = getDueTimestamp(task);
  return !task.completed && timestamp !== null && timestamp < now;
}

export function validateSchedule(dueDate, dueTime) {
  return dueTime && !dueDate ? "Выберите дату для указанного времени." : "";
}

export function filterTasks(tasks, filter) {
  if (filter === "active") return tasks.filter((task) => !task.completed);
  if (filter === "completed") return tasks.filter((task) => task.completed);
  return tasks;
}

export function persistTasks(storage, key, tasks) {
  try {
    storage.setItem(key, JSON.stringify(tasks));
    return true;
  } catch {
    return false;
  }
}
