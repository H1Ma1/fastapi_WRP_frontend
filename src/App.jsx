import { useEffect, useMemo, useState } from "react";
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const STORAGE_KEY = "watch_read_play_auth";

const categories = [
  {
    id: "game",
    title: "Игры",
    icon: "🎮",
    subtitle: "Планы на прохождение",
    addText: "Добавить игру",
    introText:
      "Добавь игру в свой backlog: выбери из каталога или впиши своё название, если игры пока нет в базе.",
    catalogModeTitle: "Выбрать игру из каталога",
    catalogModeDescription:
      "Лучший вариант, если игра уже есть в общем списке.",
    customModeTitle: "Добавить свою игру",
    customModeDescription: "Для игры, которой пока нет в каталоге.",
    catalogLabel: "Игра из каталога",
    customLabel: "Название игры",
    customPlaceholder: "Например, Hollow Knight: Silksong",
    notePlaceholder: "Например, пройти зимой",
  },
  {
    id: "book",
    title: "Книги",
    icon: "📚",
    subtitle: "Что прочитать",
    addText: "Добавить книгу",
    introText:
      "Добавь книгу в свой список чтения: выбери из каталога или впиши своё название.",
    catalogModeTitle: "Выбрать книгу из каталога",
    catalogModeDescription:
      "Лучший вариант, если книга уже есть в общем списке.",
    customModeTitle: "Добавить свою книгу",
    customModeDescription: "Для книги, которой пока нет в каталоге.",
    catalogLabel: "Книга из каталога",
    customLabel: "Название книги",
    customPlaceholder: "Например, правила стандоффа второй класс",
    notePlaceholder: "Например, прочитать в отпуске",
  },
  {
    id: "anime",
    title: "Аниме",
    icon: "🍥",
    subtitle: "Сериалы и полнометражки",
    addText: "Добавить аниме",
    introText:
      "Добавь аниме в свой список: сериал, полнометражку или OVA.",
    catalogModeTitle: "Выбрать аниме из каталога",
    catalogModeDescription:
      "Лучший вариант, если тайтл уже есть в базе.",
    customModeTitle: "Добавить своё аниме",
    customModeDescription: "Для аниме, которого пока нет в каталоге.",
    catalogLabel: "Аниме из каталога",
    customLabel: "Название аниме",
    customPlaceholder: "Например, Attack on Titan: Final Season",
    notePlaceholder: "Например, досмотреть 2 сезон",
  },
];

const statuses = [
  { id: "planned", title: "В планах" },
  { id: "completed", title: "Завершено" },
  { id: "dropped", title: "Заброшено" },
];

const statusLabels = {
  planned: "В планах",
  completed: "Завершено",
  dropped: "Заброшено",
};

const categoryLabels = {
  game: "Игры",
  book: "Книги",
  anime: "Аниме",
};

function getStoredAuth() {
  try {
    const rawAuth = localStorage.getItem(STORAGE_KEY);
    return rawAuth ? JSON.parse(rawAuth) : null;
  } catch {
    return null;
  }
}

function getApiErrorMessage(data) {
  if (!data) {
    return "Ошибка запроса";
  }

  if (typeof data.detail === "string") {
    return data.detail;
  }

  if (Array.isArray(data.detail)) {
    return data.detail.map((error) => error.msg).join(", ");
  }

  if (typeof data.message === "string") {
    return data.message;
  }

  return "Ошибка запроса";
}

function normalizeUsernameForInput(value) {
  return value.trim().replace(/^@/, "").toLowerCase();
}

function makeUsernameSuggestion(user) {
  const emailName = user?.email?.split("@")[0] || "";
  const rawName = user?.name || emailName || "user";

  const cleaned = rawName
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20);

  if (cleaned.length >= 3) {
    return cleaned;
  }

  return `user${user?.id || ""}`;
}

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <WatchReadPlayApp />
    </GoogleOAuthProvider>
  );
}

function WatchReadPlayApp() {
  const [auth, setAuth] = useState(getStoredAuth);
  const [authMode, setAuthMode] = useState("login");
  const [isCheckingAuth, setIsCheckingAuth] = useState(Boolean(getStoredAuth()));

  const [page, setPage] = useState("backlog");
  const [selectedCategory, setSelectedCategory] = useState("game");

  const [items, setItems] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);

  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [isLoadingSocial, setIsLoadingSocial] = useState(false);

  const [message, setMessage] = useState(null);

  const [usernameDraft, setUsernameDraft] = useState("");
  const [isSavingUsername, setIsSavingUsername] = useState(false);

  const [addMode, setAddMode] = useState("catalog");
  const [selectedCatalogItemId, setSelectedCatalogItemId] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [newStatus, setNewStatus] = useState("planned");
  const [newNotes, setNewNotes] = useState("");

  const [searchUsername, setSearchUsername] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

  const [selectedFriend, setSelectedFriend] = useState(null);
  const [friendItems, setFriendItems] = useState([]);
  const [friendCategory, setFriendCategory] = useState("game");
  const [friendStatus, setFriendStatus] = useState("planned");
  const [isLoadingFriendProfile, setIsLoadingFriendProfile] = useState(false);

  const isLoggedIn = Boolean(auth?.access_token);
  const currentUser = auth?.user || null;
  const needsUsername = isLoggedIn && !currentUser?.username;

  const selectedCategoryInfo = categories.find(
    (category) => category.id === selectedCategory
  );

  const selectedItems = useMemo(() => {
    return items.filter((item) => item.category === selectedCategory);
  }, [items, selectedCategory]);

  const stats = useMemo(() => {
    return {
      total: selectedItems.length,
      planned: selectedItems.filter((item) => item.status === "planned").length,
      completed: selectedItems.filter((item) => item.status === "completed").length,
      dropped: selectedItems.filter((item) => item.status === "dropped").length,
    };
  }, [selectedItems]);

  const categoryCounts = useMemo(() => {
    return categories.reduce((acc, category) => {
      acc[category.id] = items.filter(
        (item) => item.category === category.id
      ).length;

      return acc;
    }, {});
  }, [items]);

  const filteredFriendItems = useMemo(() => {
    return friendItems.filter((item) => {
      const sameCategory = item.category === friendCategory;
      const sameStatus = friendStatus === "all" || item.status === friendStatus;

      return sameCategory && sameStatus;
    });
  }, [friendItems, friendCategory, friendStatus]);

  function showMessage(type, text) {
    setMessage({ type, text });
  }

  function saveAuth(nextAuth) {
    setAuth(nextAuth);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextAuth));
  }

  function logout() {
    setAuth(null);
    localStorage.removeItem(STORAGE_KEY);

    setItems([]);
    setCatalog([]);
    setFriends([]);
    setIncomingRequests([]);
    setOutgoingRequests([]);
    setSearchResults([]);
    setSelectedFriend(null);
    setFriendItems([]);
    setMessage(null);
  }

  async function apiRequest(path, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };

    if (auth?.access_token) {
      headers.Authorization = `Bearer ${auth.access_token}`;
    }

    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      if (response.status === 401) {
        logout();
      }

      throw new Error(getApiErrorMessage(data));
    }

    return data;
  }

  async function syncCurrentUser() {
    try {
      const user = await apiRequest("/auth/me");

      saveAuth({
        ...auth,
        user,
      });

      if (!user.username) {
        setUsernameDraft(makeUsernameSuggestion(user));
      } else {
        setUsernameDraft(user.username);
      }
    } catch (error) {
      showMessage("error", error.message);
    } finally {
      setIsCheckingAuth(false);
    }
  }

  async function loadDashboard() {
    if (!auth?.access_token || !currentUser?.username) {
      return;
    }

    try {
      setIsLoadingDashboard(true);

      const [itemsData, catalogData] = await Promise.all([
        apiRequest("/items"),
        apiRequest(`/catalog?category=${selectedCategory}`),
      ]);

      setItems(itemsData);
      setCatalog(catalogData);
    } catch (error) {
      showMessage("error", error.message);
    } finally {
      setIsLoadingDashboard(false);
    }
  }

  async function loadSocial() {
    if (!auth?.access_token || !currentUser?.username) {
      return;
    }

    try {
      setIsLoadingSocial(true);

      const [friendsData, incomingData, outgoingData] = await Promise.all([
        apiRequest("/friends"),
        apiRequest("/friends/requests/incoming"),
        apiRequest("/friends/requests/outgoing"),
      ]);

      setFriends(friendsData);
      setIncomingRequests(incomingData);
      setOutgoingRequests(outgoingData);
    } catch (error) {
      showMessage("error", error.message);
    } finally {
      setIsLoadingSocial(false);
    }
  }

  useEffect(() => {
    if (!auth?.access_token) {
      setIsCheckingAuth(false);
      return;
    }

    syncCurrentUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.access_token]);

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.access_token, currentUser?.username, selectedCategory]);

  useEffect(() => {
    loadSocial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.access_token, currentUser?.username]);

  async function handleGoogleSuccess(credentialResponse) {
    try {
      setMessage(null);

      if (!credentialResponse.credential) {
        throw new Error("Google не вернул credential");
      }

      const response = await fetch(`${API_URL}/auth/google`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          credential: credentialResponse.credential,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(getApiErrorMessage(data));
      }

      saveAuth({
        access_token: data.access_token,
        user: data.user,
      });

      if (!data.user.username) {
        setUsernameDraft(makeUsernameSuggestion(data.user));
      } else {
        setUsernameDraft(data.user.username);
      }

      showMessage("success", "Вход выполнен");
    } catch (error) {
      showMessage("error", error.message);
    }
  }

  function handleGoogleError() {
    showMessage("error", "Google login не сработал");
  }

  async function handleSaveUsername(event) {
    event.preventDefault();

    const username = normalizeUsernameForInput(usernameDraft);

    if (!username) {
      showMessage("error", "Введи username");
      return;
    }

    try {
      setIsSavingUsername(true);
      setMessage(null);

      const user = await apiRequest("/auth/me/username", {
        method: "PATCH",
        body: JSON.stringify({ username }),
      });

      saveAuth({
        ...auth,
        user,
      });

      setUsernameDraft(user.username);

      showMessage("success", `Username сохранён: @${user.username}`);
    } catch (error) {
      showMessage("error", error.message);
    } finally {
      setIsSavingUsername(false);
    }
  }

  async function handleAddItem(event) {
    event.preventDefault();

    const body = {
      category: selectedCategory,
      status: newStatus,
      notes: newNotes.trim() || null,
    };

    if (addMode === "catalog") {
      if (!selectedCatalogItemId) {
        showMessage("error", "Выбери название из каталога");
        return;
      }

      body.catalog_item_id = Number(selectedCatalogItemId);
      body.custom_title = null;
    } else {
      if (!customTitle.trim()) {
        showMessage("error", "Введи своё название");
        return;
      }

      body.catalog_item_id = null;
      body.custom_title = customTitle.trim();
    }

    try {
      setMessage(null);

      await apiRequest("/items", {
        method: "POST",
        body: JSON.stringify(body),
      });

      setSelectedCatalogItemId("");
      setCustomTitle("");
      setNewNotes("");
      setNewStatus("planned");

      await loadDashboard();

      showMessage("success", "Добавлено в твой список");
    } catch (error) {
      showMessage("error", error.message);
    }
  }

  async function handleChangeStatus(itemId, status) {
    try {
      await apiRequest(`/items/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });

      await loadDashboard();
    } catch (error) {
      showMessage("error", error.message);
    }
  }

  async function handleDeleteItem(itemId) {
    try {
      await apiRequest(`/items/${itemId}`, {
        method: "DELETE",
      });

      await loadDashboard();
    } catch (error) {
      showMessage("error", error.message);
    }
  }

  async function handleSearchUsers(event) {
    event.preventDefault();

    const username = normalizeUsernameForInput(searchUsername);

    if (username.length < 2) {
      showMessage("error", "Введи минимум 2 символа username");
      return;
    }

    try {
      setIsSearchingUsers(true);
      setMessage(null);

      const users = await apiRequest(
        `/users/search?username=${encodeURIComponent(username)}`
      );

      setSearchResults(users);
    } catch (error) {
      showMessage("error", error.message);
    } finally {
      setIsSearchingUsers(false);
    }
  }

  async function handleSendFriendRequest(receiverId) {
    try {
      setMessage(null);

      await apiRequest(`/friends/request/${receiverId}`, {
        method: "POST",
      });

      await loadSocial();

      showMessage("success", "Заявка в друзья отправлена");
    } catch (error) {
      showMessage("error", error.message);
    }
  }

  async function handleAcceptRequest(requestId) {
    try {
      await apiRequest(`/friends/requests/${requestId}/accept`, {
        method: "PATCH",
      });

      await loadSocial();

      showMessage("success", "Заявка принята");
    } catch (error) {
      showMessage("error", error.message);
    }
  }

  async function handleDeclineRequest(requestId) {
    try {
      await apiRequest(`/friends/requests/${requestId}/decline`, {
        method: "PATCH",
      });

      await loadSocial();

      showMessage("success", "Заявка отклонена");
    } catch (error) {
      showMessage("error", error.message);
    }
  }

  async function handleDeleteFriend(friendId) {
    try {
      await apiRequest(`/friends/${friendId}`, {
        method: "DELETE",
      });

      await loadSocial();

      if (selectedFriend?.id === friendId) {
        setSelectedFriend(null);
        setFriendItems([]);
      }

      showMessage("success", "Друг удалён");
    } catch (error) {
      showMessage("error", error.message);
    }
  }

  async function handleOpenFriendProfile(friend) {
    if (!friend.username) {
      showMessage("error", "У пользователя нет username");
      return;
    }

    try {
      setSelectedFriend(friend);
      setIsLoadingFriendProfile(true);
      setMessage(null);

      const data = await apiRequest(`/users/${friend.username}/items`);

      setFriendItems(data);
      setPage("friends");
    } catch (error) {
      showMessage("error", error.message);
    } finally {
      setIsLoadingFriendProfile(false);
    }
  }

  if (isCheckingAuth) {
    return (
      <main className="app-shell center-shell">
        <div className="loading-card">
          <div className="logo-badge">WRP</div>
          <h1>Загружаем профиль...</h1>
        </div>
      </main>
    );
  }

  if (!isLoggedIn) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="logo-badge">WRP</div>

          <h1>WatchReadPlay</h1>

          <p>
            Твой личный backlog для игр, книг и аниме. Войди через
            Google, чтобы сохранять списки и прогресс.
          </p>

          <div className="auth-tabs">
            <button
              className={authMode === "login" ? "active" : ""}
              onClick={() => setAuthMode("login")}
              type="button"
            >
              Login
            </button>

            <button
              className={authMode === "signup" ? "active" : ""}
              onClick={() => setAuthMode("signup")}
              type="button"
            >
              Sign up
            </button>
          </div>

          <div className="google-box">
            <p>
              {authMode === "login"
                ? "Войди через Google, чтобы открыть свой список."
                : "Создай аккаунт через Google. После входа нужно будет выбрать username."}
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

          {message && <Alert type={message.type} text={message.text} />}
        </section>
      </main>
    );
  }

  if (needsUsername) {
    return (
      <main className="app-shell center-shell">
        <section className="username-card">
          <div className="user-heading">
            {currentUser?.picture && (
              <img
                className="user-avatar"
                src={currentUser.picture}
                alt=""
                referrerPolicy="no-referrer"
              />
            )}

            <div>
              <p className="eyebrow">Почти готово</p>
              <h1>Придумай username</h1>
              <p>
                Username нужен, чтобы друзья могли найти тебя и отправить заявку.
              </p>
            </div>
          </div>

          <form className="username-form" onSubmit={handleSaveUsername}>
            <label htmlFor="username">Твой username</label>

            <div className="username-input-row">
              <span>@</span>
              <input
                id="username"
                value={usernameDraft}
                onChange={(event) => setUsernameDraft(event.target.value)}
                placeholder="vlad_123"
              />
            </div>

            <p className="hint">
              От 3 до 20 символов. Только латинские буквы, цифры и нижнее
              подчёркивание.
            </p>

            <button type="submit" disabled={isSavingUsername}>
              {isSavingUsername ? "Сохраняем..." : "Сохранить username"}
            </button>
          </form>

          {message && <Alert type={message.type} text={message.text} />}

          <button className="ghost-button" type="button" onClick={logout}>
            Выйти
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <p className="eyebrow">WATCHREADPLAY</p>

          <div className="profile-title">
            {currentUser?.picture && (
              <img
                className="user-avatar"
                src={currentUser.picture}
                alt=""
                referrerPolicy="no-referrer"
              />
            )}

            <div>
              <h1>Мой backlog</h1>
              <p>
                Привет, {currentUser?.name || currentUser?.email}. Твой username:{" "}
                <strong>@{currentUser?.username}</strong>
              </p>
            </div>
          </div>
        </div>

        <div className="header-actions">
          <nav className="page-tabs">
            <button
              className={page === "backlog" ? "active" : ""}
              onClick={() => setPage("backlog")}
              type="button"
            >
              Backlog
            </button>

            <button
              className={page === "friends" ? "active" : ""}
              onClick={() => setPage("friends")}
              type="button"
            >
              Друзья
              {incomingRequests.length > 0 && (
                <span className="tab-badge">{incomingRequests.length}</span>
              )}
            </button>
          </nav>

          <button className="logout-button" type="button" onClick={logout}>
            Выйти
          </button>
        </div>
      </header>

      {message && <Alert type={message.type} text={message.text} />}

      {page === "backlog" && (
        <>
          <section className="category-grid">
            {categories.map((category) => (
              <button
                key={category.id}
                className={
                  selectedCategory === category.id
                    ? "category-card active"
                    : "category-card"
                }
                onClick={() => setSelectedCategory(category.id)}
                type="button"
              >
                <span className="category-icon">{category.icon}</span>
                <h2>{category.title}</h2>
                <p>{category.subtitle}</p>
                <span className="count-pill">
                  {categoryCounts[category.id] || 0} в списке
                </span>
              </button>
            ))}
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Планы на прохождение</p>
                <h2>{selectedCategoryInfo?.title}</h2>
              </div>

              <button type="button" onClick={loadDashboard}>
                {isLoadingDashboard ? "Обновляем..." : "Обновить"}
              </button>
            </div>

            <form className="add-form" onSubmit={handleAddItem}>
              <div className="form-intro">
                <h3>{selectedCategoryInfo?.addText}</h3>
                <p>{selectedCategoryInfo?.introText}</p>
              </div>

              <div className="add-mode-grid">
                <button
                  className={addMode === "catalog" ? "mode-card active" : "mode-card"}
                  type="button"
                  onClick={() => setAddMode("catalog")}
                >
                  <strong>{selectedCategoryInfo?.catalogModeTitle}</strong>
                  <span>{selectedCategoryInfo?.catalogModeDescription}</span>
                </button>

                <button
                  className={addMode === "custom" ? "mode-card active" : "mode-card"}
                  type="button"
                  onClick={() => setAddMode("custom")}
                >
                  <strong>{selectedCategoryInfo?.customModeTitle}</strong>
                  <span>{selectedCategoryInfo?.customModeDescription}</span>
                </button>
              </div>

              {addMode === "catalog" ? (
                <label className="field">
                  <span>{selectedCategoryInfo?.catalogLabel}</span>
                  <select
                    value={selectedCatalogItemId}
                    onChange={(event) => setSelectedCatalogItemId(event.target.value)}
                  >
                    <option value="">Выбери из списка</option>
                    {catalog.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="field">
                  <span>{selectedCategoryInfo?.customLabel}</span>
                  <input
                    value={customTitle}
                    onChange={(event) => setCustomTitle(event.target.value)}
                    placeholder={selectedCategoryInfo?.customPlaceholder}
                  />
                </label>
              )}

              <div className="form-grid">
                <label className="field">
                  <span>Статус</span>
                  <select
                    value={newStatus}
                    onChange={(event) => setNewStatus(event.target.value)}
                  >
                    {statuses.map((status) => (
                      <option key={status.id} value={status.id}>
                        {status.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Заметка</span>
                  <input
                    value={newNotes}
                    onChange={(event) => setNewNotes(event.target.value)}
                    placeholder={selectedCategoryInfo?.notePlaceholder}
                  />
                </label>
              </div>

              <button className="primary-button" type="submit">
                Добавить в мой список
              </button>
            </form>
          </section>

          <section className="stats-grid">
            <StatCard title="Всего" value={stats.total} />
            <StatCard title="В планах" value={stats.planned} />
            <StatCard title="Завершено" value={stats.completed} />
            <StatCard title="Заброшено" value={stats.dropped} />
          </section>

          <section className="status-grid">
            {statuses.map((status) => (
              <div className="status-column" key={status.id}>
                <h3>{status.title}</h3>

                <div className="item-list">
                  {selectedItems
                    .filter((item) => item.status === status.id)
                    .map((item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        onChangeStatus={handleChangeStatus}
                        onDelete={handleDeleteItem}
                      />
                    ))}

                  {selectedItems.filter((item) => item.status === status.id)
                    .length === 0 && <p className="empty-text">Пока пусто</p>}
                </div>
              </div>
            ))}
          </section>
        </>
      )}

      {page === "friends" && (
        <section className="friends-layout">
          <div className="friends-column">
            <section className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Профиль</p>
                  <h2>Мой username</h2>
                </div>
              </div>

              <form className="username-mini-form" onSubmit={handleSaveUsername}>
                <label className="field">
                  <span>Username</span>
                  <input
                    value={usernameDraft || currentUser?.username || ""}
                    onChange={(event) => setUsernameDraft(event.target.value)}
                    placeholder="username"
                  />
                </label>

                <button type="submit" disabled={isSavingUsername}>
                  {isSavingUsername ? "Сохраняем..." : "Обновить username"}
                </button>
              </form>
            </section>

            <section className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Поиск</p>
                  <h2>Найти друга</h2>
                </div>
              </div>

              <form className="search-form" onSubmit={handleSearchUsers}>
                <input
                  value={searchUsername}
                  onChange={(event) => setSearchUsername(event.target.value)}
                  placeholder="Введи username друга"
                />

                <button type="submit">
                  {isSearchingUsers ? "Ищем..." : "Найти"}
                </button>
              </form>

              <div className="people-list">
                {searchResults.map((user) => (
                  <PersonRow
                    key={user.id}
                    user={user}
                    actionText="Добавить"
                    onAction={() => handleSendFriendRequest(user.id)}
                  />
                ))}

                {searchResults.length === 0 && (
                  <p className="empty-text">
                    Здесь появятся найденные пользователи.
                  </p>
                )}
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Друзья</p>
                  <h2>Мой список друзей</h2>
                </div>

                <button type="button" onClick={loadSocial}>
                  {isLoadingSocial ? "..." : "Обновить"}
                </button>
              </div>

              <div className="people-list">
                {friends.map((item) => (
                  <div className="friend-row" key={item.friendship_id}>
                    <PersonInfo user={item.friend} />

                    <div className="row-actions">
                      <button
                        type="button"
                        onClick={() => handleOpenFriendProfile(item.friend)}
                      >
                        Профиль
                      </button>

                      <button
                        className="danger-button"
                        type="button"
                        onClick={() => handleDeleteFriend(item.friend.id)}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                ))}

                {friends.length === 0 && (
                  <p className="empty-text">Друзей пока нет.</p>
                )}
              </div>
            </section>
          </div>

          <div className="friends-column">
            <section className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Заявки</p>
                  <h2>Входящие</h2>
                </div>
              </div>

              <div className="people-list">
                {incomingRequests.map((request) => (
                  <div className="friend-row" key={request.id}>
                    <PersonInfo user={request.requester} />

                    <div className="row-actions">
                      <button
                        type="button"
                        onClick={() => handleAcceptRequest(request.id)}
                      >
                        Принять
                      </button>

                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => handleDeclineRequest(request.id)}
                      >
                        Отклонить
                      </button>
                    </div>
                  </div>
                ))}

                {incomingRequests.length === 0 && (
                  <p className="empty-text">Нет входящих заявок.</p>
                )}
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Заявки</p>
                  <h2>Исходящие</h2>
                </div>
              </div>

              <div className="people-list">
                {outgoingRequests.map((request) => (
                  <div className="friend-row" key={request.id}>
                    <PersonInfo user={request.receiver} />
                    <span className="status-pill">Ожидает ответа</span>
                  </div>
                ))}

                {outgoingRequests.length === 0 && (
                  <p className="empty-text">Нет исходящих заявок.</p>
                )}
              </div>
            </section>

            <section className="panel friend-profile-panel">
              {!selectedFriend ? (
                <div className="empty-profile">
                  <h2>Профиль друга</h2>
                  <p>
                    Нажми “Профиль” у друга, чтобы посмотреть его игры, фильмы,
                    сериалы и аниме.
                  </p>
                </div>
              ) : (
                <>
                  <div className="friend-profile-header">
                    <PersonInfo user={selectedFriend} />

                    <button
                      type="button"
                      onClick={() => handleOpenFriendProfile(selectedFriend)}
                    >
                      {isLoadingFriendProfile ? "Обновляем..." : "Обновить"}
                    </button>
                  </div>

                  <div className="friend-filters">
                    <label className="field">
                      <span>Категория</span>
                      <select
                        value={friendCategory}
                        onChange={(event) => setFriendCategory(event.target.value)}
                      >
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.title}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field">
                      <span>Статус</span>
                      <select
                        value={friendStatus}
                        onChange={(event) => setFriendStatus(event.target.value)}
                      >
                        <option value="all">Все</option>
                        {statuses.map((status) => (
                          <option key={status.id} value={status.id}>
                            {status.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="friend-items">
                    {filteredFriendItems.map((item) => (
                      <div className="friend-item-card" key={item.id}>
                        <h3>{item.title}</h3>
                        <p>
                          {categoryLabels[item.category]} ·{" "}
                          {statusLabels[item.status]}
                        </p>

                        {item.notes && <span>{item.notes}</span>}
                      </div>
                    ))}

                    {filteredFriendItems.length === 0 && (
                      <p className="empty-text">
                        У друга пока нет элементов с такими фильтрами.
                      </p>
                    )}
                  </div>
                </>
              )}
            </section>
          </div>
        </section>
      )}
    </main>
  );
}

function Alert({ type, text }) {
  return <div className={`alert ${type}`}>{text}</div>;
}

function StatCard({ title, value }) {
  return (
    <div className="stat-card">
      <strong>{value}</strong>
      <span>{title}</span>
    </div>
  );
}

function ItemCard({ item, onChangeStatus, onDelete }) {
  return (
    <article className="item-card">
      <div>
        <h4>{item.title}</h4>

        {item.notes && <p>{item.notes}</p>}

        <span className="status-pill">{statusLabels[item.status]}</span>
      </div>

      <div className="item-actions">
        {statuses.map((status) => (
          <button
            key={status.id}
            className={item.status === status.id ? "active" : ""}
            type="button"
            onClick={() => onChangeStatus(item.id, status.id)}
          >
            {status.title}
          </button>
        ))}

        <button
          className="danger-button"
          type="button"
          onClick={() => onDelete(item.id)}
        >
          Удалить
        </button>
      </div>
    </article>
  );
}

function PersonInfo({ user }) {
  return (
    <div className="person-info">
      {user.picture ? (
        <img src={user.picture} alt="" referrerPolicy="no-referrer" />
      ) : (
        <div className="person-placeholder">👤</div>
      )}

      <div>
        <strong>{user.name || `@${user.username}`}</strong>
        <span>@{user.username || "no_username"}</span>
      </div>
    </div>
  );
}

function PersonRow({ user, actionText, onAction }) {
  return (
    <div className="friend-row">
      <PersonInfo user={user} />

      <button type="button" onClick={onAction}>
        {actionText}
      </button>
    </div>
  );
}

export default App;