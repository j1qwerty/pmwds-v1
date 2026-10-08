import { Icon } from "../../components/ui/Icon";

const features = [
  {
    icon: "analytics",
    title: "Real-time Analytics",
    description: "Track project progress with live dashboards and performance metrics"
  },
  {
    icon: "account_tree",
    title: "Department Management",
    description: "Organize projects across departments with role-based access control"
  },
  {
    icon: "task_alt",
    title: "Milestone Tracking",
    description: "Monitor deliverables and deadlines with automated milestone alerts"
  },
  {
    icon: "insights",
    title: "AI-Powered Insights",
    description: "Get intelligent recommendations and risk predictions for your projects"
  }
];

const stats = [
  { value: "99.9%", label: "Uptime", icon: "bolt" },
  { value: "10k+", label: "Active Projects", icon: "folder_open" },
  { value: "24/7", label: "Support", icon: "support_agent" },
];

export function LoginSidebar() {
  return (
    <div className="hidden lg:flex lg:w-[45%] xl:w-[50%] relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800">
      {/* Background decorative circles */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-[30rem] h-[30rem] bg-white rounded-full translate-x-1/4 translate-y-1/4" />
        <div className="absolute top-1/2 left-1/2 w-[40rem] h-[40rem] bg-white rounded-full -translate-x-1/2 -translate-y-1/2 opacity-50" />
      </div>

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20 w-full py-12">
        {/* Branding */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg shadow-indigo-900/20">
              <Icon name="rocket_launch" size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl xl:text-4xl font-bold text-white tracking-tight">
                PMWDS
              </h1>
              <p className="text-sm text-indigo-200 mt-0.5">
                Project Monitoring & Workflow Distribution
              </p>
            </div>
          </div>
          <p className="text-lg text-indigo-100/90 leading-relaxed max-w-md">
            Streamline your project management with intelligent monitoring,
            automated workflows, and real-time collaboration.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 mb-10">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10 hover:bg-white/15 transition-all duration-300 hover:scale-[1.03] hover:border-white/20"
            >
              <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center mb-2.5">
                <Icon name={feature.icon} size={18} className="text-white" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">
                {feature.title}
              </h3>
              <p className="text-xs text-indigo-200/80 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="flex items-stretch gap-3">
          {stats.map((stat, index) => (
            <div key={stat.label} className="flex items-center gap-3 flex-1">
              {index > 0 && <div className="w-px h-12 bg-white/20" />}
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <Icon name={stat.icon} size={14} className="text-indigo-200" />
                  <div className="text-2xl font-bold text-white">{stat.value}</div>
                </div>
                <div className="text-xs text-indigo-200 mt-1">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
