import { useSync } from '../../context/instances.js';
import { useNavigate } from 'react-router-dom';

export function CalendarReminder() {
  const { globalState } = useSync();
  const navigate = useNavigate();
  const events = globalState?.calendar_events || [];
  const now = new Date();
  
  // Set time to start of day for accurate filtering
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const upcoming = (events || [])
    .filter(e => e && e.date && new Date(e.date) >= today)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const next = upcoming[0];
  
  if (!next) return (
    <div 
      onClick={() => navigate('/calendar')}
      className="border-t border-dashed border-border pt-2 mt-2 text-[10px] font-bold opacity-50 uppercase tracking-widest text-center cursor-pointer hover:opacity-100 hover:text-primary transition-all underline decoration-dashed"
    >
      No upcoming events in calendar.
    </div>
  );

  const daysUntil = Math.floor((new Date(next.date) - today) / (1000 * 60 * 60 * 24));
  return (
    <div className="border-t border-dashed border-border pt-2 mt-2">
      <p className="text-[10px] font-bold opacity-50 uppercase tracking-widest mb-1">📅 upcoming</p>
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 retro-border flex items-center justify-center font-bold text-xs ${daysUntil === 0 ? 'bg-accent text-accent-text animate-pulse' : 'bg-primary text-primary-text'}`}>
          {daysUntil === 0 ? '★' : `${daysUntil}d`}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-xs truncate">{next.title || next.text || 'Event'}</p>
          <p className="text-[10px] opacity-50">
            {daysUntil === 0 ? 'Today' : new Date(next.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
        </div>
      </div>
    </div>
  );
}
