import {
  filterTasks,
  getDueTimestamp,
  isTaskOverdue,
  normalizeTasks,
  persistTasks,
  validateSchedule,
} from "./task-utils.mjs";

const STORAGE_KEY = "task-list:v1";

const form = document.querySelector("#task-form");
const input = document.querySelector("#task-input");
const dateInput = document.querySelector("#task-date");
const timeInput = document.querySelector("#task-time");
const formMessage = document.querySelector("#form-message");
const list = document.querySelector("#task-list");
const emptyState = document.querySelector("#empty-state");
const emptyTitle = document.querySelector("#empty-title");
const emptyMessage = document.querySelector("#empty-message");
const taskFilters = document.querySelector("#task-filters");
const allCount = document.querySelector("#all-count");
const activeCount = document.querySelector("#active-count");
const completedCount = document.querySelector("#completed-count");
const summary = document.querySelector("#task-summary");
const completionLabel = document.querySelector("#completion-label");
const taskProgress = document.querySelector("#task-progress");
const progressNumber = document.querySelector("#progress-number");
const currentDate = document.querySelector("#current-date");
const undoBar = document.querySelector("#undo-bar");
const undoButton = document.querySelector("#undo-button");
const editDialog = document.querySelector("#edit-dialog");
const editForm = document.querySelector("#edit-form");
const editInput = document.querySelector("#edit-input");
const editDate = document.querySelector("#edit-date");
const editTime = document.querySelector("#edit-time");
const editMessage = document.querySelector("#edit-message");
const editCancel = document.querySelector("#edit-cancel");
const dialogClose = document.querySelector("#dialog-close");
const deleteDialog = document.querySelector("#delete-dialog");
const deleteForm = document.querySelector("#delete-form");
const deleteTaskName = document.querySelector("#delete-task-name");
const deleteCancel = document.querySelector("#delete-cancel");
const deleteDialogClose = document.querySelector("#delete-dialog-close");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const scheduleDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
});

let tasks = loadTasks();
let removedTask = null;
let undoTimer = null;
let animatedTaskId = null;
let editingTaskId = null;
let editTrigger = null;
let dialogCloseTimer = null;
let deletingTaskId = null;
let deleteTrigger = null;
let deleteDialogCloseTimer = null;
let currentFilter = "all";

function loadTasks() {
  try {
    return normalizeTasks(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
  } catch {
    return [];
  }
}

function commitTasks(nextTasks, messageControl = formMessage) {
  if (!persistTasks(localStorage, STORAGE_KEY, nextTasks)) {
    messageControl.textContent = "Не удалось сохранить задачи. Проверьте настройки браузера.";
    return false;
  }

  tasks = nextTasks;
  return true;
}

function formatSchedule(task) {
  const timestamp = getDueTimestamp(task);
  if (timestamp === null) return "";

  const date = scheduleDateFormatter.format(timestamp);
  return task.dueTime ? `${date}, ${task.dueTime}` : date;
}

function readSchedule(dateControl, timeControl, messageControl) {
  const error = validateSchedule(dateControl.value, timeControl.value);
  if (error) {
    dateControl.setAttribute("aria-invalid", "true");
    messageControl.textContent = error;
    dateControl.focus();
    return null;
  }

  dateControl.removeAttribute("aria-invalid");
  return { dueDate: dateControl.value, dueTime: timeControl.value };
}

function createTaskElement(task) {
  const item = document.createElement("li");
  const dueTimestamp = getDueTimestamp(task);
  const isOverdue = isTaskOverdue(task);
  item.className = `task-item${task.completed ? " is-complete" : ""}${isOverdue ? " is-overdue" : ""}${task.id === animatedTaskId ? " is-new" : ""}`;
  item.dataset.id = task.id;

  const checkbox = document.createElement("input");
  checkbox.className = "task-checkbox";
  checkbox.type = "checkbox";
  checkbox.checked = task.completed;
  checkbox.setAttribute(
    "aria-label",
    task.completed
      ? `Отметить задачу «${task.text}» как невыполненную`
      : `Отметить задачу «${task.text}» как выполненную`,
  );

  const text = document.createElement("span");
  text.className = "task-text";
  text.textContent = task.text;

  const taskCopy = document.createElement("span");
  taskCopy.className = "task-copy";
  taskCopy.append(text);

  if (dueTimestamp !== null) {
    const schedule = document.createElement("span");
    schedule.className = "task-due";
    schedule.textContent = `${isOverdue ? "Просрочено · " : "До · "}${formatSchedule(task)}`;
    taskCopy.append(schedule);
  }

  const taskContent = document.createElement("label");
  taskContent.className = "task-content";
  taskContent.append(checkbox, taskCopy);

  const editButton = document.createElement("button");
  editButton.className = "edit-button";
  editButton.type = "button";
  editButton.setAttribute("aria-label", `Изменить задачу «${task.text}»`);
  editButton.innerHTML = `
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m4 20 4.2-1 10.6-10.6a2 2 0 0 0-2.8-2.8L5.4 16.2 4 20Z" />
      <path d="m14.5 7.1 2.8 2.8" />
    </svg>
  `;

  const deleteButton = document.createElement("button");
  deleteButton.className = "delete-button";
  deleteButton.type = "button";
  deleteButton.setAttribute("aria-label", `Удалить задачу «${task.text}»`);
  deleteButton.innerHTML = `
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
    </svg>
  `;

  const actions = document.createElement("div");
  actions.className = "task-actions";
  actions.append(editButton, deleteButton);

  item.append(taskContent, actions);
  return item;
}

function pluralizeTasks(value) {
  const mod10 = value % 10;
  const mod100 = value % 100;

  if (mod10 === 1 && mod100 !== 11) return "задача";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return "задачи";
  }
  return "задач";
}

function remainingTasksLabel(value) {
  const verb = value % 10 === 1 && value % 100 !== 11 ? "Осталась" : "Осталось";
  return `${verb} ${value} ${pluralizeTasks(value)}`;
}

function getVisibleTasks() {
  return filterTasks(tasks, currentFilter);
}

function render() {
  const visibleTasks = getVisibleTasks();
  list.replaceChildren(...visibleTasks.map(createTaskElement));

  const doneCount = tasks.filter((task) => task.completed).length;
  const remainingCount = tasks.length - doneCount;
  const hasTasks = tasks.length > 0;
  const hasVisibleTasks = visibleTasks.length > 0;

  list.hidden = !hasVisibleTasks;
  emptyState.hidden = hasVisibleTasks;
  taskFilters.hidden = !hasTasks;
  taskProgress.hidden = !hasTasks;
  allCount.textContent = String(tasks.length);
  activeCount.textContent = String(remainingCount);
  completedCount.textContent = String(doneCount);
  taskFilters.querySelectorAll("button").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.filter === currentFilter));
  });

  if (!hasTasks) {
    emptyTitle.textContent = "Задач пока нет";
    emptyMessage.textContent = "Добавьте первую задачу — она сохранится даже после обновления страницы.";
  } else if (currentFilter === "active" && !hasVisibleTasks) {
    emptyTitle.textContent = "Все задачи выполнены";
    emptyMessage.textContent = "Здесь появятся новые задачи, которые ещё предстоит выполнить.";
  } else if (currentFilter === "completed" && !hasVisibleTasks) {
    emptyTitle.textContent = "Выполненных пока нет";
    emptyMessage.textContent = "Отмеченные задачи появятся в этом разделе.";
  }

  summary.textContent = hasTasks
    ? remainingTasksLabel(remainingCount)
    : "Можно начать с малого";
  completionLabel.textContent = hasTasks
    ? `${doneCount} из ${tasks.length} выполнено`
    : "";
  const nextProgressNumber = `${doneCount} / ${tasks.length}`;
  if (progressNumber.textContent !== nextProgressNumber && !reducedMotion.matches) {
    progressNumber.animate(
      [
        { opacity: 0.35, transform: "translateY(8px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 240, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
    );
  }
  progressNumber.textContent = nextProgressNumber;
  taskProgress.style.setProperty(
    "--progress",
    hasTasks ? doneCount / tasks.length : 0,
  );
  taskProgress.setAttribute("aria-valuemax", String(hasTasks ? tasks.length : 1));
  taskProgress.setAttribute("aria-valuenow", String(doneCount));
}

function refreshDeadlineStates() {
  const taskById = new Map(tasks.map((task) => [task.id, task]));

  for (const item of list.children) {
    const task = taskById.get(item.dataset.id);
    if (!task) continue;

    const isOverdue = isTaskOverdue(task);
    item.classList.toggle("is-overdue", isOverdue);
    const dueLabel = item.querySelector(".task-due");
    if (dueLabel) {
      dueLabel.textContent = `${isOverdue ? "Просрочено · " : "До · "}${formatSchedule(task)}`;
    }
  }
}

function addTask(text, schedule) {
  const task = {
    id: crypto.randomUUID(),
    text,
    completed: false,
    ...schedule,
  };
  if (!commitTasks([task, ...tasks])) return false;
  animatedTaskId = task.id;
  render();
  animatedTaskId = null;
  return true;
}

function toggleTask(id) {
  const nextTasks = tasks.map((task) =>
    task.id === id ? { ...task, completed: !task.completed } : task,
  );
  if (!commitTasks(nextTasks)) return;
  render();
}

function removeTask(id) {
  const index = tasks.findIndex((task) => task.id === id);
  if (index === -1) return;

  const removed = tasks[index];
  const nextTasks = [...tasks];
  nextTasks.splice(index, 1);
  if (!commitTasks(nextTasks)) return;
  removedTask = { task: removed, index };
  render();
  showUndo();
}

function openEditDialog(id, trigger) {
  const task = tasks.find((item) => item.id === id);
  if (!task) return;

  editingTaskId = id;
  editTrigger = trigger;
  editInput.value = task.text;
  editDate.value = task.dueDate;
  editTime.value = task.dueTime;
  editInput.removeAttribute("aria-invalid");
  editDate.removeAttribute("aria-invalid");
  editMessage.textContent = "";
  editDialog.showModal();
  requestAnimationFrame(() => editInput.select());
}

function closeEditDialog(afterClose) {
  if (!editDialog.open || editDialog.dataset.closing !== undefined) return;

  editDialog.dataset.closing = "";
  window.clearTimeout(dialogCloseTimer);
  dialogCloseTimer = window.setTimeout(() => {
    editDialog.close();
    delete editDialog.dataset.closing;

    if (afterClose) {
      afterClose();
    } else if (editTrigger?.isConnected) {
      editTrigger.focus();
    }

    editingTaskId = null;
    editTrigger = null;
  }, reducedMotion.matches ? 150 : 220);
}

function openDeleteDialog(id, trigger) {
  const task = tasks.find((item) => item.id === id);
  if (!task) return;

  deletingTaskId = id;
  deleteTrigger = trigger;
  deleteTaskName.textContent = task.text;
  deleteDialog.showModal();
  requestAnimationFrame(() => deleteCancel.focus());
}

function closeDeleteDialog(afterClose) {
  if (!deleteDialog.open || deleteDialog.dataset.closing !== undefined) return;

  deleteDialog.dataset.closing = "";
  window.clearTimeout(deleteDialogCloseTimer);
  deleteDialogCloseTimer = window.setTimeout(() => {
    deleteDialog.close();
    delete deleteDialog.dataset.closing;

    if (afterClose) {
      afterClose();
    } else if (deleteTrigger?.isConnected) {
      deleteTrigger.focus();
    }

    deletingTaskId = null;
    deleteTrigger = null;
  }, reducedMotion.matches ? 150 : 220);
}

function showUndo() {
  window.clearTimeout(undoTimer);
  delete undoBar.dataset.closing;
  undoBar.hidden = false;
  undoTimer = window.setTimeout(hideUndo, 5000);
}

function hideUndo() {
  if (undoBar.hidden || undoBar.dataset.closing !== undefined) return;

  undoBar.dataset.closing = "";
  undoTimer = window.setTimeout(() => {
    undoBar.hidden = true;
    delete undoBar.dataset.closing;
    removedTask = null;
  }, reducedMotion.matches ? 150 : 320);
}

function undoRemove() {
  if (!removedTask) return;

  const nextTasks = [...tasks];
  nextTasks.splice(removedTask.index, 0, removedTask.task);
  if (!commitTasks(nextTasks)) return;
  render();
  window.clearTimeout(undoTimer);
  undoBar.hidden = true;
  delete undoBar.dataset.closing;
  removedTask = null;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = input.value.trim();

  if (!text) {
    input.setAttribute("aria-invalid", "true");
    formMessage.textContent = "Введите название задачи.";
    input.focus();
    return;
  }

  const schedule = readSchedule(dateInput, timeInput, formMessage);
  if (!schedule) return;

  input.removeAttribute("aria-invalid");
  formMessage.textContent = "";
  if (!addTask(text, schedule)) return;
  form.reset();
  input.focus();
});

input.addEventListener("input", () => {
  if (input.value.trim()) {
    input.removeAttribute("aria-invalid");
    formMessage.textContent = "";
  }
});

dateInput.addEventListener("input", () => {
  if (dateInput.value) {
    dateInput.removeAttribute("aria-invalid");
    formMessage.textContent = "";
  }
});

timeInput.addEventListener("input", () => {
  if (!timeInput.value || dateInput.value) {
    dateInput.removeAttribute("aria-invalid");
    formMessage.textContent = "";
  }
});

list.addEventListener("change", (event) => {
  if (!event.target.matches(".task-checkbox")) return;
  toggleTask(event.target.closest(".task-item").dataset.id);
});

list.addEventListener("click", (event) => {
  const editButton = event.target.closest(".edit-button");
  if (editButton) {
    openEditDialog(editButton.closest(".task-item").dataset.id, editButton);
    return;
  }

  const deleteButton = event.target.closest(".delete-button");
  if (!deleteButton) return;
  openDeleteDialog(deleteButton.closest(".task-item").dataset.id, deleteButton);
});

taskFilters.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-filter]");
  if (!button) return;
  currentFilter = button.dataset.filter;
  render();
});

editForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = editInput.value.trim();

  if (!text) {
    editInput.setAttribute("aria-invalid", "true");
    editMessage.textContent = "Введите название задачи.";
    editInput.focus();
    return;
  }

  const schedule = readSchedule(editDate, editTime, editMessage);
  if (!schedule) return;

  const editedId = editingTaskId;
  const nextTasks = tasks.map((task) =>
    task.id === editedId ? { ...task, text, ...schedule } : task,
  );
  if (!commitTasks(nextTasks, editMessage)) return;
  closeEditDialog(() => {
    render();
    [...list.children]
      .find((item) => item.dataset.id === editedId)
      ?.querySelector(".edit-button")
      ?.focus();
  });
});

editInput.addEventListener("input", () => {
  if (editInput.value.trim()) {
    editInput.removeAttribute("aria-invalid");
    editMessage.textContent = "";
  }
});

editDate.addEventListener("input", () => {
  if (editDate.value) {
    editDate.removeAttribute("aria-invalid");
    editMessage.textContent = "";
  }
});

editTime.addEventListener("input", () => {
  if (!editTime.value || editDate.value) {
    editDate.removeAttribute("aria-invalid");
    editMessage.textContent = "";
  }
});

editCancel.addEventListener("click", () => closeEditDialog());
dialogClose.addEventListener("click", () => closeEditDialog());

editDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeEditDialog();
});

editDialog.addEventListener("click", (event) => {
  if (event.target === editDialog) closeEditDialog();
});

deleteForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const deletedId = deletingTaskId;
  closeDeleteDialog(() => removeTask(deletedId));
});

deleteCancel.addEventListener("click", () => closeDeleteDialog());
deleteDialogClose.addEventListener("click", () => closeDeleteDialog());

deleteDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeDeleteDialog();
});

deleteDialog.addEventListener("click", (event) => {
  if (event.target === deleteDialog) closeDeleteDialog();
});

undoButton.addEventListener("click", undoRemove);

window.setInterval(refreshDeadlineStates, 60_000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshDeadlineStates();
});

currentDate.textContent = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
  day: "numeric",
  month: "long",
}).format(new Date());

render();
