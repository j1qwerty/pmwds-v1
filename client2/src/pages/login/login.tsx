import { useState, type FormEvent } from "react";
import { z } from "zod";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { LoginSidebar } from "./LoginSidebar";
import { Icon } from "../../components/ui/Icon";
import { SHOW_SUPERADMIN_DEMO_LOGIN } from "../../featureFlags";

type LoginMode = "signin" | "signup" | "forgot" | "reset";

const emailSchema = z.string().trim().email("Please enter a valid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");
const authSchemas = {
  signin: z.object({
    email: emailSchema,
    password: passwordSchema,
  }),
  signup: z.object({
    firstName: z.string().trim().min(1, "First name is required"),
    lastName: z.string().trim().min(1, "Last name is required"),
    email: emailSchema,
    password: passwordSchema,
  }),
  forgot: z.object({
    email: emailSchema,
  }),
  reset: z.object({
    email: emailSchema,
    resetToken: z.string().trim().min(1, "Reset token is required"),
    password: passwordSchema,
  }),
};

const allDemoAccountGroups = [
  {
    label: "Executive",
    accounts: [
      { email: "superadmin@org1.com", label: "SuperAdmin", icon: "shield_person", color: "bg-red-500" },
      { email: "admin@org1.com", label: "Admin", icon: "admin_panel_settings", color: "bg-purple-500" },
      { email: "manager@org1.com", label: "Manager", icon: "supervisor_account", color: "bg-blue-500" },
      { email: "rajesh.verma@pwd.up.gov.in", label: "Chief Engineer", icon: "engineering", color: "bg-sky-500" },
    ]
  },
  {
    label: "Department Heads",
    accounts: [
      { email: "head.eng@org1.com", label: "Civil Division", icon: "foundation", color: "bg-teal-500" },
      { email: "head.pmo@org1.com", label: "PWD Coordination", icon: "account_tree", color: "bg-cyan-500" },
      { email: "head.ops@org1.com", label: "Procurement", icon: "receipt_long", color: "bg-amber-500" },
      { email: "head.bstr@org1.com", label: "Revenue Dept", icon: "landscape", color: "bg-rose-500" },
      { email: "head.csv@org1.com", label: "Quality Assurance", icon: "verified", color: "bg-violet-500" },
      { email: "sunil.yadav@up.gov.in", label: "Tehsildar", icon: "gavel", color: "bg-orange-500" },
    ]
  },
  {
    label: "Staff",
    accounts: [
      { email: "member@org1.com", label: "Team Member", icon: "person", color: "bg-green-500" },
      { email: "viewer@org1.com", label: "Viewer", icon: "visibility", color: "bg-orange-500" },
      { email: "dinesh.kumar@pwd.up.gov.in", label: "Executive Engineer", icon: "precision_manufacturing", color: "bg-lime-500" },
      { email: "pradeep.mishra@up.gov.in", label: "Jal Nigam", icon: "water_drop", color: "bg-blue-600" },
      { email: "suresh.pandey@up.gov.in", label: "Electrical", icon: "bolt", color: "bg-yellow-500" },
      { email: "ramesh.yadav@up.gov.in", label: "Sewerage", icon: "plumbing", color: "bg-stone-500" },
    ]
  }
];

/**
 * SuperAdmin is hidden from the quick-login list by default. Filtering here
 * keeps the account definition in place so the flag can restore it.
 * Groups that end up empty are dropped so no orphaned heading renders.
 */
const demoAccountGroups = allDemoAccountGroups
  .map((group) => ({
    ...group,
    accounts: group.accounts.filter(
      (account) => SHOW_SUPERADMIN_DEMO_LOGIN || account.email !== "superadmin@org1.com"
    ),
  }))
  .filter((group) => group.accounts.length > 0);

export function LoginPage() {
  const [email, setEmail] = useState("admin@org1.com");
  const [password, setPassword] = useState("Pmwds@123");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [resetToken, setResetToken] = useState(() => new URLSearchParams(window.location.search).get("token") ?? "");
  const [mode, setMode] = useState<LoginMode>(() => new URLSearchParams(window.location.search).get("token") ? "reset" : "signin");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();

  const validateForm = () => {
    const payload = { firstName, lastName, email, password, resetToken };
    const result = authSchemas[mode].safeParse(payload);
    if (result.success) {
      setFieldErrors({});
      return true;
    }

    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !errors[key]) errors[key] = issue.message;
    }
    setFieldErrors(errors);
    return false;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!validateForm()) return;

    setLoading(true);
    try {
      if (mode === "signin") {
        await login(email, password);
      } else if (mode === "signup") {
        await api.signup({ firstName, lastName, email, password });
        setSuccess("Account created with Viewer access. An admin can assign your department and role.");
        setMode("signin");
      } else if (mode === "forgot") {
        const result = await api.forgotPassword(email);
        setSuccess(result.message);
      } else {
        const result = await api.resetPassword(email, resetToken, password);
        setSuccess(result.message);
        setMode("signin");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";

      if (message.toLowerCase().includes("deactivated")) {
        setError("Your account has been deactivated. Please contact your administrator.");
      } else if (message.toLowerCase().includes("invalid credentials") || message.toLowerCase().includes("unauthorized")) {
        setError("Invalid email or password. Please try again.");
      } else if (message.toLowerCase().includes("network")) {
        setError("Network error. Please check your connection.");
      } else if (message.toLowerCase().includes("locked")) {
        setError("Account is locked. Please contact your administrator.");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("Pmwds@123");
    setMode("signin");
    setTimeout(() => {
      const form = document.getElementById("login-form") as HTMLFormElement;
      if (form) form.requestSubmit();
    }, 300);
  };

  const title = mode === "signup" ? "Create account" : mode === "forgot" ? "Reset request" : mode === "reset" ? "Set new password" : "Sign in";
  const submitLabel =
    mode === "signup" ? "Create Account" :
    mode === "forgot" ? "Send Reset Link" :
    mode === "reset" ? "Reset Password" : "Sign In";
  const loadingLabel =
    mode === "signup" ? "Creating account..." :
    mode === "forgot" ? "Sending link..." :
    mode === "reset" ? "Resetting..." : "Signing in...";

  return (
    <div className="flex min-h-screen w-full bg-gradient-to-br from-slate-50 via-indigo-50/30 to-violet-50/40 font-sans">
      {/* Left Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-[440px]">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                <Icon name="rocket_launch" size={22} className="text-white" />
              </div>
              <span className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">
                PMWDS
              </span>
            </div>
            <p className="text-sm text-slate-500">
              Project Monitoring & Workflow Distribution
            </p>
          </div>

          {/* Login Card — glass-panel */}
          <div className="glass-panel rounded-2xl shadow-xl shadow-slate-200/50 p-8">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5 flex items-start gap-3 animate-shake">
                <Icon name="error" size={20} className="text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-700 mb-0.5">
                    Authentication Failed
                  </p>
                  <p className="text-xs text-red-600 leading-relaxed">
                    {error}
                  </p>
                </div>
                <button
                  onClick={() => setError("")}
                  className="text-red-400 hover:text-red-600 transition-colors shrink-0"
                >
                  <Icon name="close" size={18} />
                </button>
              </div>
            )}

            {success && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-5 flex items-start gap-3">
                <Icon name="check_circle" size={20} className="text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-sm text-emerald-700 leading-relaxed">
                  {success}
                </p>
              </div>
            )}

            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-800">{title}</h2>
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "signin" ? "signup" : "signin");
                  setError("");
                  setSuccess("");
                  setFieldErrors({});
                }}
                className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                {mode === "signin" ? "Create account" : "Sign in instead"}
              </button>
            </div>

            <form id="login-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
              {mode === "signup" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <input
                      value={firstName}
                      onChange={(e) => {
                        setFirstName(e.target.value);
                        if (fieldErrors.firstName) setFieldErrors((prev) => ({ ...prev, firstName: undefined }));
                      }}
                      required
                      placeholder="First name"
                      className={`h-11 rounded-xl border px-3.5 text-sm outline-none transition-all duration-200 ${
                        fieldErrors.firstName
                          ? "border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100"
                          : "border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      }`}
                    />
                    {fieldErrors.firstName && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <Icon name="error" size={15} />
                        {fieldErrors.firstName}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <input
                      value={lastName}
                      onChange={(e) => {
                        setLastName(e.target.value);
                        if (fieldErrors.lastName) setFieldErrors((prev) => ({ ...prev, lastName: undefined }));
                      }}
                      required
                      placeholder="Last name"
                      className={`h-11 rounded-xl border px-3.5 text-sm outline-none transition-all duration-200 ${
                        fieldErrors.lastName
                          ? "border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100"
                          : "border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      }`}
                    />
                    {fieldErrors.lastName && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <Icon name="error" size={15} />
                        {fieldErrors.lastName}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Email Address
                </label>
                <div className="relative">
                  <Icon name="mail" size={20} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    placeholder="you@example.com"
                    disabled={loading}
                    className={`w-full h-11 pl-10 pr-3.5 rounded-xl text-sm outline-none transition-all duration-200 ${
                      fieldErrors.email
                        ? "border-2 border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100"
                        : "border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    } ${loading ? "bg-slate-50" : "bg-white"}`}
                    autoComplete="email"
                    autoFocus
                  />
                </div>
                {fieldErrors.email && (
                  <p className="text-xs text-red-500 ml-1 flex items-center gap-1">
                    <Icon name="error" size={15} />
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              {mode === "reset" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Reset Token
                  </label>
                  <input
                    value={resetToken}
                    onChange={(e) => {
                      setResetToken(e.target.value);
                      if (fieldErrors.resetToken) setFieldErrors((prev) => ({ ...prev, resetToken: undefined }));
                    }}
                    required
                    disabled={loading}
                    placeholder="Paste reset token"
                    className="w-full h-11 rounded-xl border border-slate-200 px-3.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                  />
                  {fieldErrors.resetToken && (
                    <p className="text-xs text-red-500 ml-1 flex items-center gap-1">
                      <Icon name="error" size={15} />
                      {fieldErrors.resetToken}
                    </p>
                  )}
                </div>
              )}

              {mode !== "forgot" && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      {mode === "reset" ? "New Password" : "Password"}
                    </label>
                    {mode === "signin" && (
                      <button
                        type="button"
                        className="text-xs text-indigo-600 font-semibold hover:text-indigo-700 transition-colors"
                        onClick={() => {
                          setMode("forgot");
                          setError("");
                          setSuccess("");
                        }}
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Icon
                      name="lock"
                      size={20}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                    />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
                      }}
                      placeholder="Enter your password"
                      disabled={loading}
                      className={`w-full h-11 pl-10 pr-12 rounded-xl text-sm outline-none transition-all duration-200 ${
                        fieldErrors.password
                          ? "border-2 border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100"
                          : "border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      } ${loading ? "bg-slate-50" : "bg-white"}`}
                      autoComplete={mode === "reset" ? "new-password" : "current-password"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600 transition-colors"
                      aria-label="Toggle password visibility"
                    >
                      <Icon name={showPassword ? "visibility_off" : "visibility"} size={18} />
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p className="text-xs text-red-500 ml-1 flex items-center gap-1">
                      <Icon name="error" size={15} />
                      {fieldErrors.password}
                    </p>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="gradient-btn w-full h-11 text-white text-sm font-semibold rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/30 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {loadingLabel}
                  </>
                ) : (
                  <>
                    <Icon name="login" size={18} />
                    {submitLabel}
                  </>
                )}
              </button>

              {mode === "signin" && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setError("");
                    setSuccess("");
                    setFieldErrors({});
                  }}
                  className="w-full h-11 border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-700 text-sm font-semibold rounded-xl transition-all duration-200 hover:bg-indigo-50/50 flex items-center justify-center gap-2"
                >
                  <Icon name="person_add" size={18} />
                  Create New Account
                </button>
              )}
            </form>
          </div>

          {/* Demo Accounts - Mobile only */}
          {mode === "signin" && (
            <div className="mt-5 lg:hidden">
              <DemoAccountsPanel
                groups={demoAccountGroups}
                onPick={handleDemoLogin}
                loading={loading}
                variant="light"
              />
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Sidebar (signin: demo accounts; otherwise: showcase) */}
      {mode === "signin" ? (
        <div className="hidden lg:flex w-[45%] xl:w-[50%] relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 left-0 w-[30rem] h-[30rem] bg-white rounded-full -translate-x-1/4 translate-y-1/4" />
            <div className="absolute top-1/2 left-1/2 w-[40rem] h-[40rem] bg-white rounded-full -translate-x-1/2 -translate-y-1/2 opacity-50" />
          </div>

          <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20 w-full py-12">
            {/* Heading */}
            <div className="mb-6">
              <div className="inline-flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Icon name="rocket_launch" size={22} className="text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white tracking-tight">PMWDS</h1>
                  <p className="text-xs text-indigo-200">Project Monitoring & Workflow Distribution</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <Icon name="science" size={18} className="text-indigo-200" />
                <h2 className="text-base font-bold text-white">Dev Quick Login</h2>
              </div>
              <p className="text-xs text-indigo-200/70">
                Click any account to instantly sign in with password{" "}
                <code className="bg-white/10 px-1.5 py-0.5 rounded text-indigo-100 font-mono text-[10px]">
                  Pmwds@123
                </code>
              </p>
            </div>

            {/* Demo Accounts */}
            <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-22rem)] pr-2">
              {demoAccountGroups.map((group) => (
                <div key={group.label}>
                  <div className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest mb-2">
                    {group.label}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {group.accounts.map((account) => (
                      <button
                        key={account.email}
                        onClick={() => handleDemoLogin(account.email)}
                        disabled={loading}
                        className="flex items-center gap-2.5 p-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 hover:bg-white/20 hover:border-white/30 transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className={`w-8 h-8 rounded-lg ${account.color} flex items-center justify-center shrink-0 shadow-sm`}>
                          <Icon name={account.icon} size={15} className="text-white" />
                        </div>
                        <div className="text-left min-w-0 flex-1">
                          <div className="text-xs font-semibold text-white group-hover:text-indigo-100 transition-colors truncate">
                            {account.label}
                          </div>
                          <div className="text-[10px] text-indigo-200/70 truncate">
                            {account.email}
                          </div>
                        </div>
                        <Icon
                          name="arrow_forward"
                          size={14}
                          className="text-indigo-300/50 group-hover:text-white ml-auto shrink-0 transition-all opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Info */}
            <div className="mt-8 pt-6 border-t border-white/10">
              <div className="flex items-center gap-4 text-[10px] text-indigo-200/70">
                <span className="flex items-center gap-1">
                  <Icon name="apartment" size={12} />
                  11 Departments
                </span>
                <span className="w-px h-3 bg-white/20" />
                <span className="flex items-center gap-1">
                  <Icon name="flag" size={12} />
                  13 Milestones
                </span>
                <span className="w-px h-3 bg-white/20" />
                <span className="flex items-center gap-1">
                  <Icon name="group" size={12} />
                  21 Users
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <LoginSidebar />
      )}
    </div>
  );
}

// ─── Demo Accounts Panel (mobile) ──────────────────────────────────

function DemoAccountsPanel({
  groups,
  onPick,
  loading,
  variant,
}: {
  groups: typeof demoAccountGroups;
  onPick: (email: string) => void;
  loading: boolean;
  variant: "light" | "dark";
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Icon name="science" size={14} />
          Dev Quick Login
        </span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>
      <div className="space-y-2.5">
        {groups.map((group) => (
          <div key={group.label}>
            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-1">
              {group.label}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {group.accounts.map((account) => (
                <button
                  key={account.email}
                  onClick={() => onPick(account.email)}
                  disabled={loading}
                  className="flex items-center gap-2 p-2 rounded-lg border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className={`w-7 h-7 rounded-md ${account.color} flex items-center justify-center shrink-0`}>
                    <Icon name={account.icon} size={13} className="text-white" />
                  </div>
                  <div className="text-left min-w-0">
                    <div className="text-[11px] font-semibold text-slate-700 group-hover:text-indigo-700 transition-colors truncate">
                      {account.label}
                    </div>
                    <div className="text-[9px] text-slate-400 truncate">
                      {account.email}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="text-[9px] text-slate-400 text-center mt-2.5">
        Password: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-mono text-[9px]">Pmwds@123</code>
      </p>
    </div>
  );
}
