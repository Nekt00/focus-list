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
    .map((task) => {
      const dueDate =
        typeof task.dueDate === "string" &&
        getDueTimestamp({ dueDate: task.dueDate, dueTime: "" }) !== null
          ? task.dueDate
          : "";
      const dueTime =
        dueDate && /^([01]\d|2[0-3]):[0-5]\d$/.test(task.dueTime)
          ? task.dueTime
          : "";

      return {
        id: task.id.trim().slice(0, 100),
        text: task.text.trim().slice(0, 160),
        completed: task.completed,
        dueDate,
        dueTime,
      };
    })
    .filter((task) => task.id && task.text);
}

export function getDueTimestamp(task) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(task.dueDate);
  const timeMatch = task.dueTime
    ? /^([01]\d|2[0-3]):([0-5]\d)$/.exec(task.dueTime)
    : null;
  if (!dateMatch || (task.dueTime && !timeMatch)) return null;

  const [, year, month, day] = dateMatch.map(Number);
  const hour = timeMatch ? Number(timeMatch[1]) : 23;
  const minute = timeMatch ? Number(timeMatch[2]) : 59;
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(hour, minute, timeMatch ? 0 : 59, timeMatch ? 0 : 999);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    return null;
  }

  return date.getTime();
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
