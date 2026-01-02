import React, { useEffect, useMemo, useRef, useState } from "react";

import AuthLoading from "./components/AuthLoading";
import DashboardHeader from "./components/DashboardHeader";
import FiltersBar from "./components/FiltersBar";
import LoginView from "./components/LoginView";
import OfferModal from "./components/OfferModal";
import OffersGrid from "./components/OffersGrid";
import Pagination from "./components/Pagination";
import TmLoginComplete from "./components/TmLoginComplete";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const FORCE_REMOTE =
  String(import.meta.env.VITE_FORCE_REMOTE || "").toLowerCase() === "true" ||
  String(import.meta.env.VITE_FORCE_REMOTE || "") === "1";
const IS_LOCAL_API =
  !FORCE_REMOTE &&
  (API_BASE.includes("localhost") || API_BASE.includes("127.0.0.1"));

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    username: "",
    email: "",
    password: ""
  });
  const [verifyForm, setVerifyForm] = useState({ email: "", code: "" });
  const [loggingIn, setLoggingIn] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const tokenSentRef = useRef(false);
  const [tmStatus, setTmStatus] = useState("");
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [cardFilter, setCardFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [cardOptions, setCardOptions] = useState([]);
  const [sourceOptions, setSourceOptions] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const [page, setPage] = useState(1);
  const [activeModal, setActiveModal] = useState(null);
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
      setAuthNotice("");
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
    const isoMatch = String(value).match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const date = new Date(
        Number(isoMatch[1]),
        Number(isoMatch[2]) - 1,
        Number(isoMatch[3])
      );
      if (!Number.isNaN(date.getTime())) return date.getTime();
    }
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
        if (sourceFilter !== "all") {
          params.set("source", sourceFilter);
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
  }, [user, page, debouncedQuery, cardFilter, sourceFilter]);

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
    let active = true;
    async function loadSources() {
      if (!user) {
        if (active) setSourceOptions([]);
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/sources`, { credentials: "include" });
        if (!res.ok) {
          if (res.status === 401) {
            if (active) setUser(null);
            return;
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        if (active) {
          setSourceOptions(Array.isArray(data.sources) ? data.sources : []);
        }
      } catch (err) {
        if (active) {
          setSourceOptions([]);
        }
      }
    }
    loadSources();
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
  }, [debouncedQuery, cardFilter, sourceFilter]);

  const filtered = useMemo(() => {
    const grouped = new Map();
    offers.forEach(offer => {
      const id = offer.id;
      if (!id) return;
      const cardLabel = (offer.card_label || offer.cardLabel || "").trim();
      const existing = grouped.get(id);
      if (!existing) {
        grouped.set(id, {
          ...offer,
          cards: offer.card_num
            ? [
              {
                cardNum: offer.card_num,
                enrolled: !!offer.enrolled,
                label: cardLabel
              }
            ]
            : []
        });
        return;
      }
      if (offer.card_num) {
        const already = existing.cards.find(card => card.cardNum === offer.card_num);
        if (!already) {
          existing.cards.push({
            cardNum: offer.card_num,
            enrolled: !!offer.enrolled,
            label: cardLabel
          });
          return;
        }
        if (!already.label && cardLabel) {
          already.label = cardLabel;
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

  function formatExpiresDisplay(value) {
    if (!value) return "";
    const isoMatch = String(value).match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const mm = String(Number(isoMatch[2]));
      const dd = String(Number(isoMatch[3]));
      const yy = isoMatch[1].slice(-2);
      return `${mm}/${dd}/${yy}`;
    }
    return String(value).replace(/^Expires\\s+/i, "");
  }

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
    setAuthNotice("");
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

  function handleLoginChange(field, value) {
    setLoginForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleRegister(event) {
    event.preventDefault();
    if (registering) return;
    setRegistering(true);
    setAuthError("");
    setAuthNotice("");
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: registerForm.username.trim(),
          email: registerForm.email.trim(),
          password: registerForm.password
        })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Registration failed");
      }
      const data = await res.json();
      if (data && data.verificationRequired) {
        setAuthMode("verify");
        setVerifyForm({
          email: data.email || registerForm.email.trim(),
          code: ""
        });
        setAuthNotice("Verification code sent. Check your email.");
        // Start 30-second countdown immediately when code is sent
        setResendCooldown(30);
        const interval = setInterval(() => {
          setResendCooldown(prev => {
            if (prev <= 1) {
              clearInterval(interval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        return;
      }
      setAuthError("Registration requires verification");
    } catch (err) {
      setAuthError(err.message || "Registration failed");
    } finally {
      setRegistering(false);
    }
  }

  function handleRegisterChange(field, value) {
    setRegisterForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleVerify(event) {
    event.preventDefault();
    if (verifying) return;
    setVerifying(true);
    setAuthError("");
    setAuthNotice("");
    try {
      const res = await fetch(`${API_BASE}/auth/verify-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: verifyForm.email.trim(),
          code: verifyForm.code.trim()
        })
      });
      if (!res.ok) {
        throw new Error("Verification failed");
      }
      const data = await res.json();
      setUser(data.user || null);
      // Reset all forms and mode on successful verification
      setAuthMode("login");
      setLoginForm({ username: "", password: "" });
      setRegisterForm({ username: "", email: "", password: "" });
      setVerifyForm({ email: "", code: "" });
      setResendCooldown(0);
    } catch (err) {
      setAuthError("Verification failed");
    } finally {
      setVerifying(false);
    }
  }

  function handleVerifyChange(field, value) {
    setVerifyForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleResendCode() {
    if (resending || resendCooldown > 0) return;
    setResending(true);
    setAuthError("");
    try {
      const res = await fetch(`${API_BASE}/auth/resend-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: verifyForm.email.trim() })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to resend code");
      }
      setAuthNotice("Verification code sent. Check your email.");
      // Start 30-second countdown
      setResendCooldown(30);
      const interval = setInterval(() => {
        setResendCooldown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setAuthError(err.message || "Failed to resend code");
    } finally {
      setResending(false);
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
      setAuthMode("login");
      setLoginForm({ username: "", password: "" });
      setRegisterForm({ username: "", email: "", password: "" });
      setVerifyForm({ email: "", code: "" });
      setResendCooldown(0);
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
    return <AuthLoading />;
  }

  if (!user) {
    return (
      <LoginView
        isLocalApi={IS_LOCAL_API}
        authMode={authMode}
        onModeChange={setAuthMode}
        loginForm={loginForm}
        onLoginChange={handleLoginChange}
        onSubmit={handleLogin}
        registerForm={registerForm}
        onRegisterChange={handleRegisterChange}
        onRegisterSubmit={handleRegister}
        verifyForm={verifyForm}
        onVerifyChange={handleVerifyChange}
        onVerifySubmit={handleVerify}
        onResendCode={handleResendCode}
        authError={authError}
        authNotice={authNotice}
        loggingIn={loggingIn}
        registering={registering}
        verifying={verifying}
        resending={resending}
        resendCooldown={resendCooldown}
      />
    );
  }

  if (tmMode) {
    return (
      <TmLoginComplete tmStatus={tmStatus} onClose={() => window.close()} />
    );
  }

  const showReset =
    debouncedQuery.trim() || cardFilter !== "all" || sourceFilter !== "all";

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 text-stone-900">
      <div className="flex w-full flex-col gap-8 px-6 py-10">
        <DashboardHeader
          debouncedQuery={debouncedQuery}
          cardFilter={cardFilter}
          sourceFilter={sourceFilter}
          total={total}
          user={user}
          onLogout={handleLogout}
        />

        <FiltersBar
          query={query}
          onQueryChange={setQuery}
          cardFilter={cardFilter}
          onCardFilterChange={setCardFilter}
          sourceFilter={sourceFilter}
          onSourceFilterChange={setSourceFilter}
          cardOptions={cardOptions}
          sourceOptions={sourceOptions}
          showReset={showReset}
          onReset={() => {
            setQuery("");
            setDebouncedQuery("");
            setCardFilter("all");
            setSourceFilter("all");
            setPage(1);
          }}
          filteredCount={filtered.length}
          page={page}
          totalPages={totalPages}
        />

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
            <OffersGrid
              offers={filtered}
              loading={loading}
              isFiltering={isFiltering}
              formatExpiresDisplay={formatExpiresDisplay}
              isExpiringSoon={isExpiringSoon}
              onViewDetails={setActiveModal}
            />
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </>
        )}
        <OfferModal modal={activeModal} onClose={() => setActiveModal(null)} />
      </div>
    </div>
  );
}
