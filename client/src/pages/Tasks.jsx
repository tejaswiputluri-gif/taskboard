import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";

const CATEGORIES = ["General", "Personal", "Work", "Study", "Health"];
const FILTERS = ["all", "open", "done"];
const REMINDER_KEY = "taskboard_reminders";
const EMPTY = {
  title: "",
  notes: "",
  priority: "medium",
  category: "Personal",
  recurrence: "none",
  dueDate: "",
};

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function taskDateKey(date) {
  return date ? new Date(date).toISOString().slice(0, 10) : "";
}

function dayDifference(from, to) {
  return (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000;
}

function formatDueDate(date) {
  const day = taskDateKey(date);
  return day ? new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
}

function dueLabel(date, done) {
  if (!date || done) return "";
  const difference = dayDifference(localDateKey(), taskDateKey(date));
  if (difference < 0) return "Overdue";
  if (difference === 0) return "Due today";
  if (difference === 1) return "Due tomorrow";
  return `Due ${formatDueDate(date)}`;
}

function getStreak(tasks) {
  const completedDays = new Set(
    tasks.filter((task) => task.done && task.completedAt).map((task) => localDateKey(new Date(task.completedAt)))
  );
  const today = localDateKey();
  let cursor = completedDays.has(today) ? today : localDateKey(new Date(Date.now() - 86400000));
  let streak = 0;
  while (completedDays.has(cursor)) {
    streak += 1;
    cursor = localDateKey(new Date(Date.parse(`${cursor}T00:00:00`) - 86400000));
  }
  return streak;
}

function weekStart(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

export default function Tasks() {
  const { user, logout } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [filter, setFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("All categories");
  const [sort, setSort] = useState("manual");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [draggedId, setDraggedId] = useState("");
  const [notificationPermission, setNotificationPermission] = useState(
    () => (typeof Notification === "undefined" ? "unsupported" : Notification.permission)
  );
  const [remindersEnabled, setRemindersEnabled] = useState(
    () => localStorage.getItem(REMINDER_KEY) === "true"
  );

  const loadTasks = useCallback(async () => {
    const result = await api.listTasks();
    setTasks(result);
  }, []);

  useEffect(() => {
    loadTasks().catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [loadTasks]);

  useEffect(() => {
    if (!remindersEnabled || notificationPermission !== "granted" || !user?.id) return undefined;

    const checkReminders = () => {
      const today = localDateKey();
      const now = new Date();
      if (now.getHours() < 9) return;

      for (const task of tasks) {
        if (task.done || !task.dueDate) continue;
        const dueDay = taskDateKey(task.dueDate);
        const daysUntilDue = dayDifference(today, dueDay);
        const stage = daysUntilDue === 1 ? "day-before" : daysUntilDue === 0 ? "due-day" : "";
        if (!stage) continue;

        const key = `${REMINDER_KEY}:${user.id}:${task._id}:${dueDay}:${stage}`;
        if (localStorage.getItem(key)) continue;
        try {
          new Notification(stage === "day-before" ? "Due tomorrow" : "Due today", {
            body: task.title,
            tag: key,
          });
          localStorage.setItem(key, "sent");
        } catch (e) {
          setError(`Could not show a task reminder: ${e.message}`);
          localStorage.setItem(key, "failed");
        }
      }
    };

    checkReminders();
    const timer = window.setInterval(checkReminders, 60000);
    return () => window.clearInterval(timer);
  }, [notificationPermission, remindersEnabled, tasks, user?.id]);

  const completedThisWeek = useMemo(() => {
    const start = weekStart(new Date());
    const nextWeek = new Date(start);
    nextWeek.setDate(nextWeek.getDate() + 7);
    return tasks.filter((task) => {
      if (!task.done || !task.completedAt) return false;
      const completedAt = new Date(task.completedAt);
      return completedAt >= start && completedAt < nextWeek;
    }).length;
  }, [tasks]);

  const weeklyBars = useMemo(() => {
    const start = weekStart(new Date());
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(start);
      day.setDate(day.getDate() + index);
      const key = localDateKey(day);
      const count = tasks.filter((task) => task.done && task.completedAt && localDateKey(new Date(task.completedAt)) === key).length;
      return {
        key,
        count,
        label: day.toLocaleDateString(undefined, { weekday: "short" }),
      };
    });
  }, [tasks]);

  const openCount = tasks.filter((task) => !task.done).length;
  const overdueCount = tasks.filter((task) => !task.done && dueLabel(task.dueDate, task.done) === "Overdue").length;
  const dueSoonCount = tasks.filter((task) => {
    if (task.done || !task.dueDate) return false;
    const difference = dayDifference(localDateKey(), taskDateKey(task.dueDate));
    return difference >= 0 && difference <= 7;
  }).length;
  const streak = getStreak(tasks);
  const maxDaily = Math.max(1, ...weeklyBars.map((bar) => bar.count));
  const draggable = sort === "manual" && filter === "all" && categoryFilter === "All categories" && !search.trim();

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = tasks.filter((task) => {
      const matchesStatus = filter === "all" || (filter === "done" ? task.done : !task.done);
      const matchesCategory = categoryFilter === "All categories" || task.category === categoryFilter;
      const matchesSearch = !query || `${task.title} ${task.notes} ${task.category}`.toLowerCase().includes(query);
      return matchesStatus && matchesCategory && matchesSearch;
    });

    if (sort === "due") {
      return result.sort((a, b) => (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) - (b.dueDate ? new Date(b.dueDate).getTime() : Infinity));
    }
    if (sort === "priority") {
      const rank = { high: 0, medium: 1, low: 2 };
      return result.sort((a, b) => rank[a.priority] - rank[b.priority]);
    }
    if (sort === "newest") return result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return result.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }, [categoryFilter, filter, search, sort, tasks]);

  const add = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const created = await api.createTask(form);
      setTasks((previous) => [...previous, created].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)));
      setForm(EMPTY);
    } catch (e) {
      setError(e.message);
    }
  };

  const toggle = async (task) => {
    setError("");
    try {
      await api.updateTask(task._id, { done: !task.done });
      await loadTasks();
    } catch (e) {
      setError(e.message);
    }
  };

  const remove = async (task) => {
    setError("");
    try {
      await api.deleteTask(task._id);
      setTasks((previous) => previous.filter((item) => item._id !== task._id));
    } catch (e) {
      setError(e.message);
    }
  };

  const enableReminders = async () => {
    if (typeof Notification === "undefined") {
      setError("This browser does not support notifications.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === "granted") {
        localStorage.setItem(REMINDER_KEY, "true");
        setRemindersEnabled(true);
        setError("");
      } else {
        setError("Allow notifications in your browser settings to receive task reminders.");
      }
    } catch (e) {
      setError(`Could not enable notifications: ${e.message}`);
    }
  };

  const disableReminders = () => {
    localStorage.setItem(REMINDER_KEY, "false");
    setRemindersEnabled(false);
  };

  const reorder = async (targetId) => {
    if (!draggedId || draggedId === targetId || !draggable) return;
    const from = tasks.findIndex((task) => task._id === draggedId);
    const to = tasks.findIndex((task) => task._id === targetId);
    if (from < 0 || to < 0) return;

    const reordered = [...tasks];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    const positioned = reordered.map((task, index) => ({ ...task, position: index }));
    setTasks(positioned);
    setDraggedId("");
    setError("");

    try {
      await Promise.all(positioned.map((task) => api.updateTask(task._id, { position: task.position })));
    } catch (e) {
      setError(e.message);
      try {
        await loadTasks();
      } catch (refreshError) {
        setError(`${e.message} The task list could not be refreshed: ${refreshError.message}`);
      }
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="sidebar-brand" href="#overview" aria-label="Taskboard home">
          <span className="brand-mark">T</span>
          <span>taskboard</span>
        </a>
        <p className="sidebar-label">WORKSPACE</p>
        <nav className="side-nav" aria-label="Main navigation">
          <a className="side-link active" href="#overview"><span className="nav-icon">⌂</span>Dashboard</a>
          <a className="side-link" href="#tasks"><span className="nav-icon">▤</span>My tasks</a>
          <a className="side-link" href="#weekly-progress"><span className="nav-icon">◷</span>Progress</a>
        </nav>
        <div className="sidebar-bottom">
          <div className="profile-chip">
            <span className="avatar">{(user?.name || "T").slice(0, 1).toUpperCase()}</span>
            <span className="profile-copy"><strong>{user?.name}</strong><small>Personal workspace</small></span>
          </div>
          <button className="side-link signout" onClick={logout}><span className="nav-icon">↪</span>Sign out</button>
        </div>
      </aside>

      <main className="dashboard">
        <header className="dashboard-top">
          <div className="breadcrumb">Workspace <span>/</span> Overview</div>
          <div className="top-actions">
            <span className="today-date">{new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
            {remindersEnabled ? (
              <div className="reminder-control">
                <button className="notification-button enabled" onClick={disableReminders} title="Turn reminders off">Reminders on</button>
                <small className="reminder-note">9 AM · day before + due day</small>
              </div>
            ) : (
              <button className="notification-button" onClick={enableReminders} title="Browser popups at 9 AM the day before and on the due date">Enable reminders</button>
            )}
          </div>
        </header>

        <section className="welcome" id="overview">
          <div>
            <p className="eyebrow">YOUR PERSONAL SPACE</p>
            <h1>Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {user?.name?.split(" ")[0] || "there"} <span className="wave">✦</span></h1>
            <p className="welcome-copy">
              {openCount ? `You have ${openCount} task${openCount === 1 ? "" : "s"} in motion. Keep your momentum going.` : "A clear board is a fresh start. Add a task when you're ready."}
            </p>
          </div>
          <a className="welcome-action" href="#tasks">View my tasks <span>↗</span></a>
        </section>

        <section className="stat-grid" aria-label="Task summary">
          <article className="stat-card stat-blue">
            <span className="stat-symbol">◷</span>
            <p className="stat-label">OPEN TASKS</p>
            <strong className="stat-value">{openCount}</strong>
            <span className="stat-detail">Ready when you are</span>
          </article>
          <article className="stat-card stat-lilac">
            <span className="stat-symbol">✓</span>
            <p className="stat-label">DONE THIS WEEK</p>
            <strong className="stat-value">{completedThisWeek}</strong>
            <span className="stat-detail">Small wins add up</span>
          </article>
          <article className="stat-card stat-peach">
            <span className="stat-symbol">↗</span>
            <p className="stat-label">DUE THIS WEEK</p>
            <strong className="stat-value">{dueSoonCount}</strong>
            <span className="stat-detail">{overdueCount ? `${overdueCount} overdue — take a look` : "Nothing sneaking up"}</span>
          </article>
          <article className="stat-card stat-mint">
            <span className="stat-symbol">✦</span>
            <p className="stat-label">DAY STREAK</p>
            <strong className="stat-value">{streak}<small> days</small></strong>
            <span className="stat-detail">Show up for yourself</span>
          </article>
        </section>

        <section className="insight-grid">
          <article className="panel progress-panel" id="weekly-progress">
            <div className="panel-heading">
              <div><p className="eyebrow">YOUR MOMENTUM</p><h2>Weekly progress</h2></div>
              <span className="soft-chip">{completedThisWeek} completed</span>
            </div>
            <div className="week-chart" aria-label="Completed tasks by day this week">
              {weeklyBars.map((bar) => (
                <div className="chart-column" key={bar.key} aria-label={`${bar.label}: ${bar.count} completed`}>
                  <span className="chart-count">{bar.count || ""}</span>
                  <div className="chart-track"><span className="chart-bar" style={{ height: `${Math.max(bar.count ? 16 : 5, (bar.count / maxDaily) * 100)}%` }} /></div>
                  <span className="chart-day">{bar.label}</span>
                </div>
              ))}
            </div>
          </article>
          <article className="panel focus-panel">
            <div className="panel-heading"><div><p className="eyebrow">A LITTLE NUDGE</p><h2>Keep it light</h2></div><span className="focus-icon">✿</span></div>
            <p className="focus-copy">{overdueCount ? "A task is waiting for you. Pick one small next step and get back on track." : "Progress isn't about doing it all. It's about doing the next thing that matters."}</p>
            <a className="text-link" href="#tasks">Find your next step <span>→</span></a>
          </article>
        </section>

        <section className="tasks-section" id="tasks">
          <div className="section-heading">
            <div><p className="eyebrow">MAKE SPACE FOR WHAT MATTERS</p><h2>My tasks <span className="task-count">{tasks.length}</span></h2></div>
            <div className="task-tools">
              <label className="search-box"><span>⌕</span><input aria-label="Search tasks" placeholder="Search tasks..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>
              <select aria-label="Filter by category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option>All categories</option>
                {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
              </select>
              <select aria-label="Sort tasks" value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="manual">My order</option>
                <option value="due">Due date</option>
                <option value="priority">Priority</option>
                <option value="newest">Newest</option>
              </select>
            </div>
          </div>

          <form onSubmit={add} className="composer">
            <div className="composer-title-row">
              <span className="composer-plus">+</span>
              <input className="title-input" placeholder="What would you like to get done?" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} maxLength={140} required />
            </div>
            <input className="notes-input" placeholder="Add a note or a little detail (optional)" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
            <div className="composer-bottom">
              <div className="composer-fields">
                <label className="field-control"><span>Category</span><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label>
                <label className="field-control"><span>Priority</span><select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
                <label className="field-control"><span>Due date</span><input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></label>
                <label className="field-control"><span>Repeat</span><select value={form.recurrence} onChange={(event) => setForm({ ...form, recurrence: event.target.value })}><option value="none">Does not repeat</option><option value="daily">Every day</option><option value="weekly">Every week</option></select></label>
              </div>
              <button className="primary add-button"><span>+</span> Add task</button>
            </div>
          </form>

          {error && <p className="error" role="alert">{error}</p>}

          <div className="list-toolbar">
            <div className="filters" role="tablist" aria-label="Task status">
              {FILTERS.map((item) => (
                <button key={item} role="tab" aria-selected={filter === item} className={filter === item ? "filter-tab selected" : "filter-tab"} onClick={() => setFilter(item)}>
                  {item === "all" ? "All tasks" : item === "open" ? "In progress" : "Completed"}
                </button>
              ))}
            </div>
            {draggable && <span className="drag-hint">Drag tasks to set your order</span>}
          </div>

          {loading ? (
            <div className="empty-state">Loading your tasks...</div>
          ) : visible.length === 0 ? (
            <div className="empty-state"><span className="empty-sparkle">✦</span><strong>{search ? "No matches just yet" : filter === "done" ? "Your wins will show up here" : "Your space is ready"}</strong><span>{search ? "Try another search or category." : "Add a task above to get started."}</span></div>
          ) : (
            <ul className="list">
              {visible.map((task) => {
                const deadline = dueLabel(task.dueDate, task.done);
                return (
                  <li
                    key={task._id}
                    className={`task-row ${task.done ? "is-done" : ""} ${draggedId === task._id ? "is-dragging" : ""}`}
                    draggable={draggable}
                    onDragStart={() => setDraggedId(task._id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => reorder(task._id)}
                    onDragEnd={() => setDraggedId("")}
                  >
                    {draggable && <span className="drag-handle" aria-label="Drag to reorder">⠿</span>}
                    <input className="task-check" type="checkbox" checked={task.done} onChange={() => toggle(task)} aria-label={`Mark "${task.title}" ${task.done ? "in progress" : "done"}`} />
                    <div className="task-main">
                      <div className="task-title-line"><span className="title">{task.title}</span><span className={`category-tag category-${(task.category || "General").toLowerCase()}`}>{task.category || "General"}</span></div>
                      {task.notes && <span className="notes">{task.notes}</span>}
                      <span className="meta">
                        <span className={`priority-dot priority-${task.priority}`} />{task.priority} priority
                        {deadline && <span className={`deadline ${deadline === "Overdue" ? "overdue" : ""}`}> · {deadline}</span>}
                        {task.recurrence !== "none" && <span> · Repeats {task.recurrence}</span>}
                      </span>
                    </div>
                    <button className="delete-button" onClick={() => remove(task)} aria-label={`Delete ${task.title}`} title="Delete task">×</button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <footer className="dashboard-footer">One step at a time <span>✦</span></footer>
      </main>
    </div>
  );
}
