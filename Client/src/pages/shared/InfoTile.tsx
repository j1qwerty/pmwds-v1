interface InfoTileProps {
  icon: string;
  label: string;
  value?: string | number;
  subValue?: string;
}

export function InfoTile({ icon, label, value, subValue }: InfoTileProps) {
  return (
    <div className="bg-white/50 rounded-xl p-3.5 border border-[#e0e3e5]/30 flex gap-2.5 items-center transition-all duration-200 hover:bg-white/80">
      <span className="material-symbols-outlined text-[#4648d4] text-xl shrink-0">{icon}</span>
      <div>
        <div className="text-[10px] font-bold uppercase text-[#767586] mb-0.5">{label}</div>
        <div className="text-sm font-semibold text-[#191c1e]">{value ?? "—"}</div>
        {subValue && <div className="text-xs text-[#767586] mt-0.5">{subValue}</div>}
      </div>
    </div>
  );
}