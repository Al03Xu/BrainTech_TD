import { useState, useEffect } from "react";
import "./App.css";

// Request lewat path relatif /api; nginx di container frontend meneruskannya ke backend.
const API = process.env.REACT_APP_API_URL || "/api";

function Logo() {
  return (
    <svg className="logo" viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#14213D" />
      <path d="M17 34l10 10 19-23" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="46" cy="20" r="5.5" fill="#F2C94C" />
    </svg>
  );
}

export default function App() {
  const [todos, setTodos] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchTodos = () =>
    fetch(`${API}/todos`)
      .then((r) => r.json())
      .then((data) => { setTodos(data); setError(""); })
      .catch(() => setError("Can't reach the server. Check that the backend is running."))
      .finally(() => setLoading(false));

  useEffect(() => { fetchTodos(); }, []);

  const addTodo = () => {
    if (!input.trim()) return;
    fetch(`${API}/todos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: input }),
    }).then(() => { setInput(""); fetchTodos(); });
  };

  const toggleTodo = (id) => fetch(`${API}/todos/${id}`, { method: "PUT" }).then(fetchTodos);
  const deleteTodo = (id) => fetch(`${API}/todos/${id}`, { method: "DELETE" }).then(fetchTodos);

  const done = todos.filter((t) => t.completed).length;
  const percent = todos.length ? Math.round((done / todos.length) * 100) : 0;

  return (
    <main className="app">
      <header className="header">
        <Logo />
        <div>
          <h1>Todo</h1>
          <p className="tagline">React · Node.js · MySQL, running in Docker</p>
        </div>
      </header>

      <section className="progress" aria-label="Progress">
        <div className="progress-text">
          <span>{todos.length ? `${done} of ${todos.length} done` : "Nothing to track yet"}</span>
          <span>{percent}%</span>
        </div>
        <div className="bar"><div className="bar-fill" style={{ width: `${percent}%` }} /></div>
      </section>

      <div className="add">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTodo()}
          placeholder="What needs doing?"
          aria-label="New task"
        />
        <button className="add-btn" onClick={addTodo}>Add task</button>
      </div>

      {error && <p className="notice error" role="alert">{error}</p>}
      {!error && !loading && todos.length === 0 && (
        <p className="notice">No tasks yet. Type one above and press Enter.</p>
      )}

      <ul className="list">
        {todos.map((todo) => (
          <li key={todo.id} className={`item ${todo.completed ? "is-done" : ""}`}>
            <button
              className="check"
              role="checkbox"
              aria-checked={!!todo.completed}
              aria-label={`Mark "${todo.title}" as ${todo.completed ? "not done" : "done"}`}
              onClick={() => toggleTodo(todo.id)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 12.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span className="title" onClick={() => toggleTodo(todo.id)}>{todo.title}</span>
            <button className="delete" onClick={() => deleteTodo(todo.id)} aria-label={`Delete "${todo.title}"`}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10 11v5M14 11v5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}