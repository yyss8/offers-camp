import React, { useEffect, useMemo, useRef, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loggingIn, setLoggingIn] = useState(false);
  const tokenSentRef = useRef(false);
  const [tmStatus, setTmStatus] = useState("");
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [cardFilter, setCardFilter] = useState("all");
  const [cardOptions, setCardOptions] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 100;
  const now = Date.now();
  const isFiltering = query.trim() !== debouncedQuery.trim();
  const tmMode = useMemo(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("tm") === "1";
    if (fromQuery) {
      window.sessionStorage.setItem("offersCampTmMode", "1");
      return true;
    }
    return window.sessionStorage.getItem("offersCampTmMode") === "1";
  }, []);
  const tmOrigin = useMemo(() => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    const originParam = params.get("tmOrigin");
    if (originParam) {
      window.sessionStorage.setItem("offersCampTmOrigin", originParam);
      return originParam;
    }
    return window.sessionStorage.getItem("offersCampTmOrigin") || "";
  }, []);

  useEffect(() => {
    let active = true;
    async function loadUser() {
      setAuthLoading(true);
      setAuthError("");
      try {
        const res = await fetch(`${API_BASE}/auth/me`, { credentials: "include" });
        if (!res.ok) {
          if (res.status === 401) {
            if (active) setUser(null);
            return;
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        if (active) {
          setUser(data.user || null);
        }
      } catch (err) {
        if (active) {
          setUser(null);
          setAuthError("Failed to load session");
        }
      } finally {
        if (active) setAuthLoading(false);
      }
    }
    loadUser();
    return () => {
      active = false;
    };
  }, []);

  function parseExpires(value) {
    if (!value) return null;
    const match = String(value).match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (!match) return null;
    const month = Number(match[1]);
    const day = Number(match[2]);
    let year = Number(match[3]);
    if (year < 100) {
      year += 2000;
    }
    const date = new Date(year, month - 1, day);
    if (Number.isNaN(date.getTime())) return null;
    return date.getTime();
  }

  function isExpiringSoon(value) {
    const timestamp = parseExpires(value);
    if (!timestamp) return false;
    const diff = timestamp - now;
    return diff >= 0 && diff <= 15 * 24 * 60 * 60 * 1000;
  }

  useEffect(() => {
    let active = true;
    async function load() {
      if (!user) {
        setOffers([]);
        setTotal(0);
        setTotalRows(0);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(pageSize)
        });
        if (debouncedQuery.trim()) {
          params.set("q", debouncedQuery.trim());
        }
        if (cardFilter !== "all") {
          params.set("card", cardFilter);
        }
        const res = await fetch(`${API_BASE}/offers?${params.toString()}`, {
          credentials: "include"
        });
        if (!res.ok) {
          if (res.status === 401) {
            if (active) setUser(null);
            return;
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        if (active) {
          setOffers(Array.isArray(data.offers) ? data.offers : []);
          setTotal(Number.isFinite(data.total) ? data.total : 0);
          setTotalRows(Number.isFinite(data.totalRows) ? data.totalRows : 0);
        }
      } catch (err) {
        if (active) {
          setError("Failed to load offers");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [user, page, debouncedQuery, cardFilter]);

  useEffect(() => {
    let active = true;
    async function loadCards() {
      if (!user) {
        if (active) setCardOptions([]);
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/cards`, { credentials: "include" });
        if (!res.ok) {
          if (res.status === 401) {
            if (active) setUser(null);
            return;
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        if (active) {
          setCardOptions(Array.isArray(data.cards) ? data.cards : []);
        }
      } catch (err) {
        if (active) {
          setCardOptions([]);
        }
      }
    }
    loadCards();
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 750);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (page !== 1) {
      setPage(1);
    }
  }, [debouncedQuery, cardFilter]);

  const filtered = useMemo(() => {
    const grouped = new Map();
    offers.forEach(offer => {
      const id = offer.id;
      if (!id) return;
      const existing = grouped.get(id);
      if (!existing) {
        grouped.set(id, {
          ...offer,
          cards: offer.card_last5
            ? [{ last5: offer.card_last5, enrolled: !!offer.enrolled }]
            : []
        });
        return;
      }
      if (offer.card_last5) {
        const already = existing.cards.find(card => card.last5 === offer.card_last5);
        if (!already) {
          existing.cards.push({ last5: offer.card_last5, enrolled: !!offer.enrolled });
        }
      }
    });

    const base = Array.from(grouped.values());

    return base.sort((a, b) => {
      const leftDate = parseExpires(a.expires);
      const rightDate = parseExpires(b.expires);
      if (leftDate && rightDate) return leftDate - rightDate;
      if (leftDate) return -1;
      if (rightDate) return 1;
      const left = (a.title || "").trim();
      const right = (b.title || "").trim();
      return left.localeCompare(right, undefined, { sensitivity: "base" });
    });
  }, [offers]);

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  async function handleLogin(event) {
    event.preventDefault();
    if (loggingIn) return;
    setLoggingIn(true);
    setAuthError("");
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: loginForm.username.trim(),
          password: loginForm.password
        })
      });
      if (!res.ok) {
        throw new Error("Invalid credentials");
      }
      const data = await res.json();
      setUser(data.user || null);
      setLoginForm({ username: "", password: "" });
    } catch (err) {
      setAuthError("Login failed");
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        credentials: "include"
      });
    } catch (err) {
      // Ignore logout errors and still clear local state.
    } finally {
      setUser(null);
    }
  }

  async function fetchToken() {
    const res = await fetch(`${API_BASE}/auth/token`, {
      method: "POST",
      credentials: "include"
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    return data.token || "";
  }

  useEffect(() => {
    if (!tmMode || !user || tokenSentRef.current) return;
    if (!window.opener || window.opener.closed) return;
    tokenSentRef.current = true;
    setTmStatus("Sending token...");
    fetchToken()
      .then(token => {
        if (token) {
          const targetOrigin = tmOrigin || "*";
          window.opener.postMessage({ type: "offersCampToken", token }, targetOrigin);
          setTmStatus("Login complete. Closing...");
          setTimeout(() => {
            window.close();
          }, 200);
          setTimeout(() => {
            if (!window.closed) {
              setTmStatus("Login complete. You can close this window.");
            }
          }, 1200);
          return;
        }
        setTmStatus("Failed to send token.");
      })
      .catch(() => {
        setTmStatus("Failed to send token.");
      });
  }, [tmMode, user]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 text-stone-900">
        <div className="flex min-h-screen items-center justify-center">
          <div className="rounded-2xl border border-stone-200 bg-white/80 px-6 py-8 text-sm text-stone-600 shadow-sm">
            Checking session...
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 text-stone-900">
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white/90 p-6 shadow-lg">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-stone-500">
              Offers Camp
            </p>
            <h1 className="mt-3 text-2xl font-semibold text-stone-900">Sign in</h1>
            <p className="mt-2 text-sm text-stone-600">
              Log in to access your offers dashboard.
            </p>
            <form className="mt-6 flex flex-col gap-4" onSubmit={handleLogin}>
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                Username or email
                <input
                  type="text"
                  value={loginForm.username}
                  onChange={event =>
                    setLoginForm(prev => ({ ...prev, username: event.target.value }))
                  }
                  className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-800 shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
                  autoComplete="username"
                  required
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                Password
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={event =>
                    setLoginForm(prev => ({ ...prev, password: event.target.value }))
                  }
                  className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-800 shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
                  autoComplete="current-password"
                  required
                />
              </label>
              {authError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
                  {authError}
                </div>
              ) : null}
              <button
                type="submit"
                disabled={loggingIn}
                className="rounded-full bg-stone-900 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loggingIn ? "Signing in..." : "Sign in"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (tmMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 text-stone-900">
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white/90 p-6 shadow-lg">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-stone-500">
              Offers Camp
            </p>
            <h1 className="mt-3 text-2xl font-semibold text-stone-900">Login complete</h1>
            <p className="mt-2 text-sm text-stone-600">
              {tmStatus || "Finishing sign-in..."}
            </p>
            <button
              type="button"
              onClick={() => window.close()}
              className="mt-6 rounded-full border border-stone-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-stone-700 shadow-sm transition hover:border-stone-400"
            >
              Close window
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 text-stone-900">
      <div className="flex w-full flex-col gap-8 px-6 py-10">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-stone-500">
              Offers Camp
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-stone-900 sm:text-4xl">
              Collected offers from your active session
            </h1>
            <p className="mt-3 text-sm text-stone-600">
              Displaying normalized offer data captured by the Tampermonkey collector.
            </p>
          </div>
          <div className="flex w-full max-w-xs flex-col gap-3 rounded-2xl bg-stone-900 px-5 py-4 text-stone-100 shadow-lg">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-stone-400">
                {debouncedQuery.trim() || cardFilter !== "all" ? "Filtered offers" : "Total offers"}
              </p>
              <p className="mt-2 text-2xl font-semibold">{total}</p>
              {(debouncedQuery.trim() || cardFilter !== "all") && (
                <p className="mt-2 text-[11px] text-stone-400">
                  Filtered
                  {debouncedQuery.trim() ? ` · "${debouncedQuery.trim()}"` : ""}
                  {cardFilter !== "all" ? ` · Card ${cardFilter}` : ""}
                </p>
              )}
            </div>
            <div className="flex items-center justify-between text-xs text-stone-300">
              <span>{user.username}</span>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full border border-stone-600 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-stone-200 transition hover:border-stone-400 hover:text-white"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full flex-1">
            <input
              type="search"
              placeholder="Search title or summary"
              value={query}
              onChange={event => setQuery(event.target.value)}
              className="w-full rounded-full border border-stone-300 bg-white/80 px-5 py-3 text-sm text-stone-800 shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
            />
          </div>
          <select
            value={cardFilter}
            onChange={event => setCardFilter(event.target.value)}
            className="w-full rounded-full border border-stone-300 bg-white/80 px-4 py-3 text-sm text-stone-800 shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200 sm:w-44"
          >
            <option value="all">All cards</option>
            {cardOptions.map(card => (
              <option key={card} value={card}>
                Card {card}
              </option>
            ))}
          </select>
          {(debouncedQuery.trim() || cardFilter !== "all") && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setDebouncedQuery("");
                setCardFilter("all");
                setPage(1);
              }}
              className="w-full rounded-full border border-stone-300 bg-white/80 px-4 py-3 text-xs font-medium text-stone-700 shadow-sm transition hover:border-stone-400 sm:w-auto"
            >
              Reset filters
            </button>
          )}
          <span className="text-xs font-medium text-stone-500">
            {filtered.length} shown (page {page} of {totalPages})
          </span>
        </section>

        {loading ? (
          <div className="rounded-2xl border border-stone-200 bg-white/80 px-6 py-10 text-center text-sm text-stone-600 shadow-sm">
            <div className="mx-auto mb-3 h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-transparent"></div>
            Loading offers...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center text-sm text-red-700">
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white/70 px-6 py-8 text-center text-sm text-stone-600">
            No offers found.
          </div>
        ) : (
          <>
            <div className="relative">
              {(loading || isFiltering) && (
                <div className="absolute inset-0 z-10 rounded-2xl bg-white/70 backdrop-blur-sm"></div>
              )}
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map(offer => (
                <article
                  className="flex h-full flex-col gap-3 rounded-2xl border border-stone-200 bg-white/80 p-5 shadow-sm backdrop-blur"
                  key={offer.id}
                >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  {offer.image ? (
                    <img
                      src={offer.image}
                      alt=""
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="h-10 w-10 rounded-lg border border-stone-200 object-contain bg-white"
                    />
                  ) : null}
                  <h2 className="min-w-0 flex-1 break-words text-base font-semibold text-stone-900">
                    {offer.title || "Untitled offer"}
                  </h2>
                </div>
                <p className="text-sm text-stone-700">
                  {offer.summary || "No description provided."}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                  <span
                    className={isExpiringSoon(offer.expires) ? "font-semibold text-red-600" : ""}
                  >
                    {offer.expires || "No expiry"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(offer.categories || []).map(tag => (
                    <span
                      className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-amber-800"
                      key={`cat-${offer.id}-${tag}`}
                    >
                      {tag}
                    </span>
                  ))}
                  {(offer.channels || []).map(tag => (
                    <span
                      className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-slate-700"
                      key={`chn-${offer.id}-${tag}`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                {offer.cards && offer.cards.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {offer.cards.map(card => (
                      <span
                        className={`rounded-full border px-2 py-1 text-[11px] font-medium ${
                          card.enrolled
                            ? "border-emerald-600 bg-emerald-600 text-white"
                            : "border-stone-200 bg-white text-stone-600"
                        }`}
                        key={`card-${offer.id}-${card.last5}`}
                      >
                        Card {card.last5}
                      </span>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-stone-600">
              <button
                type="button"
                onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                disabled={page <= 1}
                className="rounded-full border border-stone-300 bg-white/80 px-3 py-2 text-xs font-medium text-stone-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                Prev
              </button>
              {(() => {
                const items = [];
                const start = Math.max(1, page - 4);
                const end = Math.min(totalPages, page + 4);
                if (start > 1) {
                  items.push(1);
                }
                if (start > 2) {
                  items.push("...");
                }
                for (let i = start; i <= end; i += 1) {
                  items.push(i);
                }
                if (end < totalPages - 1) {
                  items.push("...");
                }
                if (end < totalPages) {
                  items.push(totalPages);
                }
                return items.map((item, index) => {
                  if (item === "...") {
                    return (
                      <span key={`ellipsis-${index}`} className="px-2 text-stone-400">
                        ...
                      </span>
                    );
                  }
                  const pageNum = item;
                  const active = pageNum === page;
                  return (
                    <button
                      key={`page-${pageNum}`}
                      type="button"
                      onClick={() => setPage(pageNum)}
                      className={`rounded-full border px-3 py-2 text-xs font-medium shadow-sm ${
                        active
                          ? "border-stone-900 bg-stone-900 text-white"
                          : "border-stone-300 bg-white/80 text-stone-700"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                });
              })()}
              <button
                type="button"
                onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
                disabled={page >= totalPages}
                className="rounded-full border border-stone-300 bg-white/80 px-3 py-2 text-xs font-medium text-stone-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
