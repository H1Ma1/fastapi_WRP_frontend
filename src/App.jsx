import { useEffect, useMemo, useState } from "react";
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import "./App.css";

const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(
  /\/$/,
  ""
);

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const CATEGORIES = [
  {
    id: "game",
    title: "Игры",
    subtitle: "Планы на прохождение",
    emoji: "🎮",
  },
  {
    id: "movie",
    title: "Кино и сериалы",
    subtitle: "Что посмотреть дальше",
    emoji: "🎬",
  },
  {
    id: "book",
    title: "Книги",
    subtitle: "Что прочитать",
    emoji: "📚",
  },
];

const STATUSES = [
  {
    id: "planned",
    title: "В планах",
  },
  {
    id: "completed",
    title: "Завершено",
  },
  {
    id: "dropped",
    title: "Заброшено",
  },
];

const STATUS_TEXT = {
  planned: "В планах",
  completed: "Завершено",
  dropped: "Заброшено",
};

const CATEGORY_TEXT = {
  game: "Игра",
  movie: "Кино / сериал",
  book: "Книга",
};

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <WatchReadPlayApp />
    </GoogleOAuthProvider>
  );
}

function WatchReadPlayApp() {
  const [auth, setAuth] = useState(() => {
    const savedAuth = localStorage.getItem("watch_read_play_auth");
    return savedAuth ? JSON.parse(savedAuth) : null;
  });

  const [authMode, setAuthMode] = useState("login");
  const [activeCategory, setActiveCategory] = useState("game");

  const [catalog, setCatalog] = useState([]);
  const [items, setItems] = useState([]);

  const [selectedCatalogItemId, setSelectedCatalogItemId] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [newStatus, setNewStatus] = useState("planned");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [error, setError] = useState("");

  const token = auth?.access_token;
  const user = auth?.user;

  const activeCategoryInfo = useMemo(() => {
    return CATEGORIES.find((category) => category.id === activeCategory);
  }, [activeCategory]);

  async function request(path, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };

    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let message = `Ошибка запроса: ${response.status}`;

      try {
        const data = await response.json();

        if (data.detail) {
          message = data.detail;
        }
      } catch {
        // Backend мог вернуть не JSON
      }

      if (response.status === 401) {
        localStorage.removeItem("watch_read_play_auth");
        setAuth(null);
      }

      throw new Error(message);
    }

    return response.json();
  }

  async function handleGoogleSuccess(credentialResponse) {
    try {
      setError("");

      if (!credentialResponse.credential) {
        throw new Error("Google не вернул credential");
      }

      const data = await request("/auth/google", {
        method: "POST",
        body: JSON.stringify({
          credential: credentialResponse.credential,
        }),
      });

      localStorage.setItem("watch_read_play_auth", JSON.stringify(data));
      setAuth(data);
    } catch (err) {
      setError(err.message);
    }
  }

  function handleGoogleError() {
    setError("Не получилось войти через Google");
  }

  async function loadCatalog(category = activeCategory) {
    try {
      setCatalogLoading(true);
      setError("");

      const data = await request(`/catalog?category=${category}`);
      setCatalog(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCatalogLoading(false);
    }
  }

  async function loadItems() {
    try {
      setLoading(true);
      setError("");

      const data = await request("/items");
      setItems(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("watch_read_play_auth");
    setAuth(null);
    setItems([]);
    setCatalog([]);
  }

  async function addItem(event) {
    event.preventDefault();

    const hasCatalogItem = Boolean(selectedCatalogItemId);
    const hasCustomTitle = Boolean(customTitle.trim());

    if (!hasCatalogItem && !hasCustomTitle) {
      setError("Выбери элемент из каталога или введи своё название");
      return;
    }

    const payload = {
      category: activeCategory,
      status: newStatus,
      notes: notes.trim() || null,
    };

    if (hasCustomTitle) {
      payload.custom_title = customTitle.trim();
    } else {
      payload.catalog_item_id = Number(selectedCatalogItemId);
    }

    try {
      setError("");

      await request("/items", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setSelectedCatalogItemId("");
      setCustomTitle("");
      setNewStatus("planned");
      setNotes("");

      await loadItems();
    } catch (err) {
      setError(err.message);
    }
  }

  async function changeStatus(itemId, status) {
    try {
      setError("");

      await request(`/items/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });

      await loadItems();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteItem(itemId) {
    try {
      setError("");

      await request(`/items/${itemId}`, {
        method: "DELETE",
      });

      await loadItems();
    } catch (err) {
      setError(err.message);
    }
  }

  function getItemsByStatus(status) {
    return items.filter(
      (item) => item.category === activeCategory && item.status === status
    );
  }

  const categoryItems = items.filter((item) => item.category === activeCategory);

  useEffect(() => {
    if (!auth) {
      return;
    }

    loadCatalog(activeCategory);
    loadItems();
  }, [auth, activeCategory]);

  if (!GOOGLE_CLIENT_ID) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="brand-badge">WRP</div>
          <h1>WatchReadPlay</h1>
          <p className="error-message">
            Не найден VITE_GOOGLE_CLIENT_ID в .env.local
          </p>
        </section>
      </main>
    );
  }

  if (!auth) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="brand-badge">WRP</div>

          <h1>WatchReadPlay</h1>

          <p className="auth-subtitle">
            Твой личный backlog для игр, фильмов, сериалов и книг.
          </p>

          <div className="auth-switcher">
            <button
              className={authMode === "login" ? "switch-active" : ""}
              onClick={() => setAuthMode("login")}
              type="button"
            >
              Login
            </button>

            <button
              className={authMode === "signup" ? "switch-active" : ""}
              onClick={() => setAuthMode("signup")}
              type="button"
            >
              Sign up
            </button>
          </div>

          <div className="google-login-box">
            <p>
              {authMode === "login"
                ? "Войди через Google, чтобы открыть свой список."
                : "Создай аккаунт через Google чтобы начать собирать свой список."}
            </p>

            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              theme="filled_black"
              size="large"
              text={authMode === "login" ? "signin_with" : "signup_with"}
              shape="pill"
            />
          </div>


          {error && <p className="error-message">{error}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="app-page">
      <header className="topbar">
        <div className="user-heading">
          {user?.picture && (
            <img className="user-avatar" src={user.picture} alt="User avatar" />
          )}

          <div>
            <p className="eyebrow">WatchReadPlay</p>
            <h1>Мой backlog</h1>
            <p className="muted">
              Привет, {user?.name || user?.email}. Собирай планы и отмечай прогресс.
            </p>
          </div>
        </div>

        <button className="ghost-button" onClick={logout}>
          Выйти
        </button>
      </header>

      <section className="category-grid">
        {CATEGORIES.map((category) => {
          const count = items.filter((item) => item.category === category.id).length;

          return (
            <button
              key={category.id}
              className={
                activeCategory === category.id
                  ? "category-card category-card-active"
                  : "category-card"
              }
              onClick={() => setActiveCategory(category.id)}
            >
              <span className="category-emoji">{category.emoji}</span>
              <span className="category-title">{category.title}</span>
              <span className="category-subtitle">{category.subtitle}</span>
              <span className="category-count">{count} в списке</span>
            </button>
          );
        })}
      </section>

      <section className="workspace">
        <div className="workspace-header">
          <div>
            <p className="eyebrow">{activeCategoryInfo?.subtitle}</p>
            <h2>{activeCategoryInfo?.title}</h2>
          </div>

          <button className="ghost-button" onClick={loadItems}>
            Обновить
          </button>
        </div>

        <form className="add-panel" onSubmit={addItem}>
          <div className="form-row">
            <label>
              Выбрать из каталога
              <select
                value={selectedCatalogItemId}
                onChange={(event) => {
                  setSelectedCatalogItemId(event.target.value);

                  if (event.target.value) {
                    setCustomTitle("");
                  }
                }}
              >
                <option value="">
                  {catalogLoading ? "Загрузка..." : "Выбери из списка"}
                </option>

                {catalog.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Или своё название
              <input
                value={customTitle}
                onChange={(event) => {
                  setCustomTitle(event.target.value);

                  if (event.target.value.trim()) {
                    setSelectedCatalogItemId("");
                  }
                }}
                placeholder="Например, Hollow Knight"
              />
            </label>
          </div>

          <div className="form-row">
            <label>
              Статус
              <select
                value={newStatus}
                onChange={(event) => setNewStatus(event.target.value)}
              >
                {STATUSES.map((status) => (
                  <option key={status.id} value={status.id}>
                    {status.title}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Заметка
              <input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Например, пройти зимой"
              />
            </label>
          </div>

          <button className="primary-button" type="submit">
            Добавить в мой список
          </button>
        </form>

        {error && <p className="error-message">{error}</p>}
        {loading && <p className="muted">Загрузка списка...</p>}

        <div className="stats-row">
          <div className="stat-card">
            <strong>{categoryItems.length}</strong>
            <span>Всего</span>
          </div>

          {STATUSES.map((status) => (
            <div className="stat-card" key={status.id}>
              <strong>{getItemsByStatus(status.id).length}</strong>
              <span>{status.title}</span>
            </div>
          ))}
        </div>

        <section className="status-board">
          {STATUSES.map((status) => {
            const sectionItems = getItemsByStatus(status.id);

            return (
              <div className="status-column" key={status.id}>
                <div className="status-column-header">
                  <h3>{status.title}</h3>
                  <span>{sectionItems.length}</span>
                </div>

                <div className="item-list">
                  {sectionItems.map((item) => (
                    <article className="item-card" key={item.id}>
                      <div>
                        <p className="item-type">{CATEGORY_TEXT[item.category]}</p>
                        <h4>{item.title}</h4>

                        {item.notes && <p className="item-notes">{item.notes}</p>}

                        <p className="item-status">
                          Сейчас: {STATUS_TEXT[item.status]}
                        </p>
                      </div>

                      <div className="item-actions">
                        {STATUSES.map((nextStatus) => (
                          <button
                            key={nextStatus.id}
                            className={
                              item.status === nextStatus.id
                                ? "tiny-button tiny-button-active"
                                : "tiny-button"
                            }
                            onClick={() => changeStatus(item.id, nextStatus.id)}
                            type="button"
                          >
                            {nextStatus.title}
                          </button>
                        ))}

                        <button
                          className="tiny-button delete-button"
                          onClick={() => deleteItem(item.id)}
                          type="button"
                        >
                          Удалить
                        </button>
                      </div>
                    </article>
                  ))}

                  {sectionItems.length === 0 && (
                    <div className="empty-card">Здесь пока пусто</div>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      </section>
    </main>
  );
}

export default App;