import { Icon } from "../../components/ui/Icon";

const capabilities = [
  { icon: "account_tree", title: "Departments and roles", text: "Scope every project to the teams and people who own it." },
  { icon: "task_alt", title: "Milestones and tasks", text: "Dependencies, deadlines and progress in one timeline." },
  { icon: "insights", title: "AI risk signals", text: "Delay and budget risk surfaced before they become problems." },
  { icon: "bolt", title: "Live updates", text: "Changes from your team appear without refreshing." },
];

export function LoginSidebar() {
  return (
    <div className="relative hidden overflow-hidden bg-[#0c0f14] lg:flex lg:w-[46%] xl:w-[50%]">
      {/* One soft light source, bottom-left. Nothing else decorates the panel. */}
      <div
        className="pointer-events-none absolute -bottom-40 -left-40 h-[36rem] w-[36rem] rounded-full"
        style={{ background: "radial-gradient(closest-side, rgb(59 98 240 / 0.28), transparent)" }}
      />

      <div className="relative z-10 flex w-full flex-col justify-between px-12 py-12 xl:px-20 xl:py-16">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500 text-base font-semibold text-white">P</span>
          <span className="text-lg font-semibold tracking-tight text-white">PMWDS</span>
        </div>

        <div className="max-w-[34rem]">
          <h1 className="text-4xl font-semibold leading-[1.08] tracking-tighter text-white xl:text-5xl">
            Every project, one clear picture.
          </h1>
          <p className="mt-5 max-w-[30rem] text-base leading-relaxed text-slate-400">
            Track milestones, tasks and departments in one workspace, with AI flagging delays before they land.
          </p>

          <ul className="mt-12 grid gap-6 sm:grid-cols-2">
            {capabilities.map((c) => (
              <li key={c.title} className="flex gap-3.5">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.07] text-indigo-300">
                  <Icon name={c.icon} size={17} />
                </span>
                <div>
                  <div className="text-sm font-medium text-white">{c.title}</div>
                  <div className="mt-1 text-[13px] leading-relaxed text-slate-500">{c.text}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-slate-600">Project Monitoring and Workflow Distribution System</p>
      </div>
    </div>
  );
}
