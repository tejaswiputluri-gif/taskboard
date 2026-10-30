const TOKEN_KEY = "taskboard_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

async function request(path, { method = "GET", body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(getToken() && { Authorization: `Bearer ${getToken()}` }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Request failed.");
  return data;
}

export const api = {
  register: (b) => request("/auth/register", { method: "POST", body: b }),
  login: (b) => request("/auth/login", { method: "POST", body: b }),
  me: () => request("/auth/me"),
  listTasks: () => request("/tasks"),
  createTask: (b) => request("/tasks", { method: "POST", body: b }),
  updateTask: (id, b) => request(`/tasks/${id}`, { method: "PATCH", body: b }),
  deleteTask: (id) => request(`/tasks/${id}`, { method: "DELETE" }),
};
