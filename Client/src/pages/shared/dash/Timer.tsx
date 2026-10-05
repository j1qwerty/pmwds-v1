import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../../api';
import type { Task } from '../../../types';
import { Icon } from "../../../components/ui/Icon";

interface TimerProps {
  tasks: Task[];
  token: string;
}

interface TaskStat {
  totalSeconds: number;
  taskTitle: string;
}

const STATS_KEY = 'pmwds-timer-stats';

function loadStats(): Record<string, TaskStat> {
  try {
    return JSON.parse(localStorage.getItem(STATS_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveStats(stats: Record<string, TaskStat>) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

type TimerState = 'IDLE' | 'RUNNING' | 'PAUSED';

const Timer: React.FC<TimerProps> = ({ tasks, token }) => {
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [timerState, setTimerState] = useState<TimerState>('IDLE');
  const [elapsed, setElapsed] = useState<number>(0);
  const [error, setError] = useState<string>('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [stats, setStats] = useState<Record<string, TaskStat>>(loadStats);
  const [showRecords, setShowRecords] = useState<boolean>(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const accumulatedRef = useRef<number>(0);
  const pausedByOfflineRef = useRef<boolean>(false);

  const timerStateRef = useRef<TimerState>(timerState);
  timerStateRef.current = timerState;
  const selectedTaskIdRef = useRef<string>(selectedTaskId);
  selectedTaskIdRef.current = selectedTaskId;
  const tokenRef = useRef<string>(token);
  tokenRef.current = token;
  const tasksRef = useRef<Task[]>(tasks);
  tasksRef.current = tasks;

  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const formatShort = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  const accumulateAndSave = useCallback((taskId: string, seconds: number) => {
    if (seconds <= 0) return;
    setStats(prev => {
      const task = tasksRef.current.find(t => t.id === taskId);
      const title = task?.title ?? taskId;
      const existing = prev[taskId] ?? { totalSeconds: 0, taskTitle: title };
      const updated = {
        ...prev,
        [taskId]: {
          totalSeconds: existing.totalSeconds + seconds,
          taskTitle: title,
        },
      };
      saveStats(updated);
      return updated;
    });
  }, []);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    startTimeRef.current = null;
    accumulatedRef.current = 0;
    pausedByOfflineRef.current = false;
    setElapsed(0);
    setTimerState('IDLE');
  }, []);

  const startTimer = async () => {
    const id = selectedTaskIdRef.current;
    const t = tokenRef.current;
    if (!id || !t) return;
    setError('');
    try {
      await api.startTaskTimer(t, id, 'Dashboard timer');
      accumulatedRef.current = 0;
      startTimeRef.current = Date.now();
      setElapsed(0);
      setTimerState('RUNNING');
    } catch {
      setError('Failed to start. Check your connection.');
    }
  };

  const pauseTimer = useCallback(async (byOffline = false) => {
    const state = timerStateRef.current;
    const id = selectedTaskIdRef.current;
    const t = tokenRef.current;
    if (state !== 'RUNNING' || !id || !t) return;

    if (startTimeRef.current !== null) {
      accumulatedRef.current += Math.floor((Date.now() - startTimeRef.current) / 1000);
    }

    try {
      await api.stopTaskTimer(t, id);
    } catch { }

    setElapsed(accumulatedRef.current);
    pausedByOfflineRef.current = byOffline;
    setTimerState('PAUSED');
  }, []);

  const resumeTimer = useCallback(async () => {
    const state = timerStateRef.current;
    const id = selectedTaskIdRef.current;
    const t = tokenRef.current;
    if (state !== 'PAUSED' || !id || !t) return;

    setError('');
    try {
      await api.startTaskTimer(t, id, 'Dashboard timer');
      startTimeRef.current = Date.now();
      setTimerState('RUNNING');
      pausedByOfflineRef.current = false;
    } catch {
      setError('Failed to resume. Check your connection.');
    }
  }, []);

  const stopTimer = useCallback(async () => {
    const id = selectedTaskIdRef.current;
    const t = tokenRef.current;
    const state = timerStateRef.current;
    if (!id || !t || state === 'IDLE') return;

    let finalElapsed = accumulatedRef.current;
    if (state === 'RUNNING' && startTimeRef.current !== null) {
      finalElapsed += Math.floor((Date.now() - startTimeRef.current) / 1000);
    }

    try {
      await api.stopTaskTimer(t, id);
    } catch { }

    accumulateAndSave(id, finalElapsed);
    clearTimer();
  }, [accumulateAndSave, clearTimer]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (pausedByOfflineRef.current && timerStateRef.current === 'PAUSED') {
        resumeTimer();
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      if (timerStateRef.current === 'RUNNING') {
        pauseTimer(true);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pauseTimer, resumeTimer]);

  useEffect(() => {
    if (timerState === 'RUNNING') {
      intervalRef.current = setInterval(() => {
        if (startTimeRef.current !== null) {
          setElapsed(accumulatedRef.current + Math.floor((Date.now() - startTimeRef.current) / 1000));
        }
      }, 1000);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [timerState]);

  const statEntries = Object.entries(stats)
    .sort(([, a], [, b]) => b.totalSeconds - a.totalSeconds);
  const grandTotal = statEntries.reduce((sum, [, s]) => sum + s.totalSeconds, 0);

  return (
    <div className="bg-gradient-to-br from-cyan-400 to-violet-500 rounded-2xl p-6 text-white relative overflow-hidden shadow-md hover:shadow-md   hover:shadow-blue-500 transition-shadow duration-200">
      <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-10 -mt-10"></div>
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-10 rounded-full -ml-10 -mb-10"></div>

      <div className="relative">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-semibold">Time Tracker</h3>
            <p className="text-xs text-white/70">Track time per task</p>
          </div>
          <div className="flex items-center gap-2">
            {!isOnline && (
              <span className="text-[10px] px-2 py-1 rounded-md bg-yellow-400/30 text-yellow-200">OFFLINE</span>
            )}
            <span className={`text-[10px] px-2 py-1 rounded-md ${
              timerState === 'RUNNING' ? 'bg-green-400/30' :
              timerState === 'PAUSED' ? 'bg-yellow-400/30' : 'bg-white/20'
            }`}>
              {timerState === 'RUNNING' ? 'RUNNING' : timerState === 'PAUSED' ? 'PAUSED' : 'READY'}
            </span>
            <button
              onClick={() => setShowRecords(true)}
              className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition"
              title="View Records"
            >
              <Icon name="hi-clipboard" size={16} />
            </button>
          </div>
        </div>

        {/* Timer Circle with Play/Pause inside */}
        <div className="flex justify-center mb-6">
          <div className="w-40 h-40 rounded-full border-4 border-white/30 flex items-center justify-center relative">
            <div className="text-center">
              <div className="text-3xl font-bold tracking-wider mb-1">{formatTime(elapsed)}</div>
              <div className="text-[10px] text-white/60 mb-2">Elapsed</div>
              
              {/* Play/Pause/Stop buttons inside timer */}
              <div className="flex justify-center gap-2">
                {timerState === 'IDLE' ? (
                  <button
                    onClick={startTimer}
                    disabled={!selectedTaskId}
                    className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                        <Icon name="play" size={14} />
                  </button>
                ) : (
                  <>
                    {timerState === 'RUNNING' ? (
                      <button
                        onClick={() => pauseTimer()}
                        className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition"
                      >
                        <Icon name="pause" size={14} />
                      </button>
                    ) : (
                      <button
                        onClick={resumeTimer}
                        className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition"
                      >
                    <Icon name="play" size={14} />
                      </button>
                    )}
                    <button
                      onClick={stopTimer}
                      className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition"
                    >
                      <Icon name="stop" size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {error && <p className="text-xs text-red-200 text-center mb-3">{error}</p>}

        {/* Themed Dropdown at bottom */}
        <div className="relative">
          <select
            value={selectedTaskId}
            onChange={(e) => setSelectedTaskId(e.target.value)}
            disabled={timerState !== 'IDLE'}
            className="w-full px-4 py-2.5 rounded-xl text-sm text-white bg-white/15 border border-white/20 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/30 disabled:opacity-40 disabled:cursor-not-allowed backdrop-blur-sm transition"
          >
            <option value="" className="text-slate-700 bg-white">Select a task...</option>
            {tasks.map(task => (
              <option key={task.id} value={task.id} className="text-slate-700 bg-white">{task.title}</option>
            ))}
          </select>
          <Icon name="chevron-down" size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 pointer-events-none" />
        </div>
      </div>

      {/* Records Overlay - Smaller with themed scrollbar */}
      {showRecords && (
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/95 to-violet-500/95 backdrop-blur-sm rounded-2xl z-10 flex flex-col">
          <div className="flex justify-between items-center p-4 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Time Records</h3>
              <p className="text-[10px] text-white/70">Total: {formatShort(grandTotal)}</p>
            </div>
            <button
              onClick={() => setShowRecords(false)}
              className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto px-4 pb-4 custom-scrollbar">
            {statEntries.length === 0 ? (
              <div className="text-center py-6 text-white/50">
                <Icon name="clock" size={40} className="mx-auto mb-2 opacity-50" />
                <p className="text-xs">No records yet</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {statEntries.map(([id, stat], index) => (
                  <div
                    key={id}
                    className="flex items-center justify-between bg-white/10 rounded-lg px-3 py-2 hover:bg-white/15 transition"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-bold text-white/40 w-4 shrink-0">
                        {index + 1}
                      </span>
                      <span className="text-xs text-white truncate">
                        {stat.taskTitle}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-white ml-2 shrink-0">
                      {formatShort(stat.totalSeconds)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Custom scrollbar styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.3);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.5);
        }
      `}</style>
    </div>
  );
};

export default Timer;