import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const STORAGE_KEY = "retro_todos_v1";

/**
 * @typedef {"all"|"active"|"completed"} Filter
 */

/**
 * @typedef Todo
 * @property {string} id
 * @property {string} title
 * @property {boolean} completed
 * @property {number} createdAt
 * @property {number} updatedAt
 */

/**
 * Generates a reasonably unique id without extra dependencies.
 * @returns {string}
 */
function generateId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Loads todos from localStorage (defensive against corrupted data).
 * @returns {Todo[]}
 */
function loadTodos() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Basic shape validation
    return parsed
      .filter(
        (t) =>
          t &&
          typeof t.id === "string" &&
          typeof t.title === "string" &&
          typeof t.completed === "boolean"
      )
      .map((t) => ({
        id: t.id,
        title: t.title,
        completed: t.completed,
        createdAt: typeof t.createdAt === "number" ? t.createdAt : Date.now(),
        updatedAt: typeof t.updatedAt === "number" ? t.updatedAt : Date.now(),
      }));
  } catch {
    return [];
  }
}

/**
 * Saves todos to localStorage.
 * @param {Todo[]} todos
 */
function saveTodos(todos) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

/**
 * Returns the filtered todos based on filter.
 * @param {Todo[]} todos
 * @param {Filter} filter
 * @returns {Todo[]}
 */
function applyFilter(todos, filter) {
  if (filter === "active") return todos.filter((t) => !t.completed);
  if (filter === "completed") return todos.filter((t) => t.completed);
  return todos;
}

// PUBLIC_INTERFACE
function App() {
  const [todos, setTodos] = useState(() => loadTodos());
  const [filter, setFilter] = useState(/** @type {Filter} */ ("all"));
  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState(/** @type {string|null} */ (null));
  const [editingTitle, setEditingTitle] = useState("");
  const [error, setError] = useState("");

  const newInputRef = useRef(null);

  // Persist to localStorage whenever todos change.
  useEffect(() => {
    saveTodos(todos);
  }, [todos]);

  // Keep focus on the new todo input for a snappy workflow.
  useEffect(() => {
    if (newInputRef.current) {
      // @ts-ignore - ref is HTMLInputElement at runtime
      newInputRef.current.focus();
    }
  }, []);

  const stats = useMemo(() => {
    const total = todos.length;
    const completed = todos.filter((t) => t.completed).length;
    const active = total - completed;
    return { total, active, completed };
  }, [todos]);

  const visibleTodos = useMemo(() => applyFilter(todos, filter), [todos, filter]);

  /**
   * Validates a todo title and returns a trimmed version.
   * @param {string} title
   * @returns {{ok: true, value: string} | {ok: false, message: string}}
   */
  function validateTitle(title) {
    const trimmed = title.trim();
    if (!trimmed) return { ok: false, message: "Please type a task first." };
    if (trimmed.length > 80) return { ok: false, message: "Keep it under 80 characters." };
    return { ok: true, value: trimmed };
  }

  /**
   * Adds a new todo.
   * @param {React.FormEvent} e
   */
  function onAdd(e) {
    e.preventDefault();
    setError("");

    const res = validateTitle(newTitle);
    if (!res.ok) {
      setError(res.message);
      return;
    }

    const now = Date.now();
    /** @type {Todo} */
    const todo = {
      id: generateId(),
      title: res.value,
      completed: false,
      createdAt: now,
      updatedAt: now,
    };

    setTodos((prev) => [todo, ...prev]);
    setNewTitle("");
    if (newInputRef.current) {
      // @ts-ignore
      newInputRef.current.focus();
    }
  }

  /**
   * Toggles completion for a todo by id.
   * @param {string} id
   */
  function toggleCompleted(id) {
    setTodos((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, completed: !t.completed, updatedAt: Date.now() } : t
      )
    );
  }

  /**
   * Deletes a todo by id.
   * @param {string} id
   */
  function deleteTodo(id) {
    setTodos((prev) => prev.filter((t) => t.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setEditingTitle("");
    }
  }

  /**
   * Starts editing a todo.
   * @param {Todo} todo
   */
  function startEditing(todo) {
    setError("");
    setEditingId(todo.id);
    setEditingTitle(todo.title);
  }

  /**
   * Cancels editing.
   */
  function cancelEditing() {
    setEditingId(null);
    setEditingTitle("");
  }

  /**
   * Saves edits for a todo.
   * @param {string} id
   */
  function saveEditing(id) {
    setError("");
    const res = validateTitle(editingTitle);
    if (!res.ok) {
      setError(res.message);
      return;
    }

    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, title: res.value, updatedAt: Date.now() } : t))
    );
    setEditingId(null);
    setEditingTitle("");
  }

  /**
   * Handles keyboard shortcuts while editing.
   * @param {React.KeyboardEvent<HTMLInputElement>} e
   * @param {string} id
   */
  function onEditKeyDown(e, id) {
    if (e.key === "Enter") {
      e.preventDefault();
      saveEditing(id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEditing();
    }
  }

  /**
   * Clears completed todos.
   */
  function clearCompleted() {
    setTodos((prev) => prev.filter((t) => !t.completed));
  }

  /**
   * Toggles all todos completed state.
   */
  function toggleAll() {
    const hasActive = todos.some((t) => !t.completed);
    const nextCompleted = hasActive; // if any active, mark all completed; else mark all active
    setTodos((prev) => prev.map((t) => ({ ...t, completed: nextCompleted, updatedAt: Date.now() })));
  }

  return (
    <div className="App">
      <div className="retro-bg" aria-hidden="true" />
      <main className="shell">
        <header className="topbar">
          <div className="brand">
            <div className="brand-badge" aria-hidden="true">
              TD
            </div>
            <div className="brand-text">
              <h1 className="title">Retro To‑Do</h1>
              <p className="subtitle">CRUD • Filters • Local save</p>
            </div>
          </div>

          <div className="stats" aria-label="Task statistics">
            <span className="pill" title="Total tasks">
              Total <strong>{stats.total}</strong>
            </span>
            <span className="pill" title="Active tasks">
              Active <strong>{stats.active}</strong>
            </span>
            <span className="pill" title="Completed tasks">
              Done <strong>{stats.completed}</strong>
            </span>
          </div>
        </header>

        <section className="card" aria-label="Add a new task">
          <form className="addRow" onSubmit={onAdd}>
            <label className="srOnly" htmlFor="newTodo">
              New task
            </label>
            <input
              id="newTodo"
              ref={newInputRef}
              className="input"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Type a task… (e.g., ‘Refactor the spaceship UI’)"
              maxLength={120}
              aria-invalid={!!error}
            />
            <button className="btn btnPrimary" type="submit">
              Add
            </button>
          </form>

          {error ? (
            <div className="alert" role="alert">
              <span className="alertDot" aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}

          <div className="actionsRow">
            <button className="btn btnGhost" type="button" onClick={toggleAll} disabled={todos.length === 0}>
              Toggle all
            </button>
            <button
              className="btn btnDangerGhost"
              type="button"
              onClick={clearCompleted}
              disabled={stats.completed === 0}
              title="Remove all completed tasks"
            >
              Clear completed
            </button>
          </div>
        </section>

        <section className="card" aria-label="To-do list">
          <div className="listHeader">
            <h2 className="sectionTitle">Tasks</h2>

            <div className="filters" role="tablist" aria-label="Filter tasks">
              <button
                className={`chip ${filter === "all" ? "chipActive" : ""}`}
                type="button"
                onClick={() => setFilter("all")}
                role="tab"
                aria-selected={filter === "all"}
              >
                All
              </button>
              <button
                className={`chip ${filter === "active" ? "chipActive" : ""}`}
                type="button"
                onClick={() => setFilter("active")}
                role="tab"
                aria-selected={filter === "active"}
              >
                Active
              </button>
              <button
                className={`chip ${filter === "completed" ? "chipActive" : ""}`}
                type="button"
                onClick={() => setFilter("completed")}
                role="tab"
                aria-selected={filter === "completed"}
              >
                Completed
              </button>
            </div>
          </div>

          {visibleTodos.length === 0 ? (
            <div className="empty" role="status">
              <div className="emptyIcon" aria-hidden="true">
                ▢
              </div>
              <div>
                <div className="emptyTitle">No tasks here.</div>
                <div className="emptyHint">
                  {filter === "all"
                    ? "Add a task above to get started."
                    : "Try another filter, or add a new task."}
                </div>
              </div>
            </div>
          ) : (
            <ul className="list" aria-label="Tasks">
              {visibleTodos.map((todo) => {
                const isEditing = editingId === todo.id;
                return (
                  <li key={todo.id} className={`item ${todo.completed ? "itemDone" : ""}`}>
                    <button
                      className={`check ${todo.completed ? "checkOn" : ""}`}
                      type="button"
                      onClick={() => toggleCompleted(todo.id)}
                      aria-label={todo.completed ? "Mark as not completed" : "Mark as completed"}
                      title={todo.completed ? "Mark as active" : "Mark as done"}
                    >
                      <span className="checkMark" aria-hidden="true">
                        ✓
                      </span>
                    </button>

                    <div className="content">
                      {!isEditing ? (
                        <>
                          <div className="textRow">
                            <span className="todoText">{todo.title}</span>
                          </div>
                          <div className="metaRow">
                            <span className="meta">
                              {todo.completed ? "Completed" : "Active"} •{" "}
                              {new Date(todo.updatedAt).toLocaleString()}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="editRow">
                          <label className="srOnly" htmlFor={`edit-${todo.id}`}>
                            Edit task
                          </label>
                          <input
                            id={`edit-${todo.id}`}
                            className="input inputSmall"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => onEditKeyDown(e, todo.id)}
                            autoFocus
                          />
                          <div className="editButtons">
                            <button className="btn btnPrimary btnSmall" type="button" onClick={() => saveEditing(todo.id)}>
                              Save
                            </button>
                            <button className="btn btnGhost btnSmall" type="button" onClick={cancelEditing}>
                              Cancel
                            </button>
                          </div>
                          <div className="editHint" aria-hidden="true">
                            Enter to save • Esc to cancel
                          </div>
                        </div>
                      )}
                    </div>

                    {!isEditing ? (
                      <div className="itemActions" aria-label="Task actions">
                        <button className="btn btnGhost btnSmall" type="button" onClick={() => startEditing(todo)}>
                          Edit
                        </button>
                        <button
                          className="btn btnDangerGhost btnSmall"
                          type="button"
                          onClick={() => deleteTodo(todo.id)}
                          aria-label="Delete task"
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <div className="itemActions" />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <footer className="footer">
          <div className="footerInner">
            <span className="footerNote">
              Saved locally in your browser (localStorage). No backend required.
            </span>
            <a
              className="footerLink"
              href="https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage"
              target="_blank"
              rel="noreferrer"
            >
              What’s localStorage?
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}

export default App;
