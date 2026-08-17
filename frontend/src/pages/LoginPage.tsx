import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CompanyLogo } from "../components/brand/CompanyLogo";
import { useAuth } from "../hooks/useAuth";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-bg flex min-h-screen flex-col">
      <div className="px-6 pt-6 sm:px-12">
        <CompanyLogo />
      </div>
      <div className="flex flex-1 items-center justify-center px-6">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm space-y-4 rounded-2xl border border-brand-border bg-brand-surface p-8 shadow-soft"
        >
          <h1 className="text-xl font-semibold text-brand-text">Log in</h1>
          {error && <p className="text-sm text-brand-danger">{error}</p>}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-[10px] border border-brand-border px-4 py-3 text-sm placeholder:text-brand-muted"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-[10px] border border-brand-border px-4 py-3 text-sm placeholder:text-brand-muted"
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-[10px] bg-brand-blue py-3 text-sm font-bold text-white transition-colors hover:bg-brand-blue-dark disabled:opacity-50"
          >
            {submitting ? "Logging in..." : "Log in"}
          </button>
          <p className="text-sm text-brand-muted">
            Don&apos;t have an account?{" "}
            <Link to="/signup" className="font-medium text-brand-blue hover:underline">
              Sign up
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
