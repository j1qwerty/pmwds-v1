import { useState, useRef, useEffect } from "react";

interface SearchBarProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
  className?: string;
}

export function SearchBar({ 
  placeholder = "Search...", 
  onSearch,
  className = ""
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => onSearch?.(value), 300);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div className={`relative hidden md:block ${className}`}>
      <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[20px] pointer-events-none">
        search
      </span>
      <input
        value={query}
        onChange={handleChange}
        className="
          w-[250px]
          h-[40px]
          rounded-full
          bg-white
          border border-slate-200
          pl-11 pr-4
          text-[13px]
          text-slate-700
          placeholder:text-slate-400
          outline-none
          transition-all duration-300
          focus:border-indigo-500
          focus:bg-white
          focus:ring-2 focus:ring-indigo-500/10
        "
        placeholder={placeholder}
        type="text"
      />
    </div>
  );
}