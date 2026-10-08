import { useEffect } from "react";
import { Icon } from "../../components/ui/Icon";
import { Link, useParams } from "react-router-dom";
import { GlassCard, useNavHeader } from "../shared/index";
import { useAppData } from "../../appData";

export function ProjectNotFound() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data } = useAppData();
  const { setNavHeader } = useNavHeader();

  useEffect(() => {
    setNavHeader({ title: "Project not found", description: "" });
  }, [setNavHeader]);

  const known = data.projects.some((p) => p.id === projectId);

  return (
    <div className="flex items-center justify-center py-16">
      <GlassCard className="p-8  w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 mx-auto mb-4 flex items-center justify-center">
          <Icon name="error" size={36} className="text-slate-400" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 mb-2">Project not found</h2>
        <p className="text-sm text-slate-500 mb-4">
          {known
            ? "This project is not available with your current organization or permissions."
            : "The project you are looking for does not exist."}
        </p>
        <div className="flex justify-center gap-2">
          <Link
            to="/projects"
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
          >
            Go to Projects
          </Link>
          <Link
            to="/"
            className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50"
          >
            Dashboard
          </Link>
        </div>
      </GlassCard>
    </div>
  );
}
