import React, { useState } from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import { RetroButton, RetroWindow } from './UI.jsx';
import { playAudio } from '../utils/audio.js';

export function DayDetailsModal({ date, dayEvents, onClose, onAddEvent, onUpdateEvent, onDeleteEvent, sfx, colorOptions = [
  { value: 'var(--primary)', label: '', name: 'Red' },
  { value: 'var(--secondary)', label: '', name: 'Blue' },
  { value: '#4ade80', label: '', name: 'Green' },
  { value: '#f59e0b', label: '', name: 'Orange' }
] }) {
  const [newTitle, setNewTitle] = useState('');
  const [newColor, setNewColor] = useState(colorOptions[0].value);
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingColor, setEditingColor] = useState('');

  // Format date for display
  const dateObj = new Date(date + 'T00:00:00');
  const formattedDate = dateObj.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

  const handleAddEvent = () => {
    if (!newTitle.trim()) return;
    playAudio('click', sfx);
    onAddEvent(newTitle, newColor);
    setNewTitle('');
    setNewColor(colorOptions[0].value);
  };

  const handleStartEdit = (event) => {
    setEditingId(event.id);
    setEditingTitle(event.title);
    setEditingColor(event.color);
  };

  const handleSaveEdit = () => {
    if (!editingTitle.trim()) return;
    playAudio('click', sfx);
    onUpdateEvent(editingId, editingTitle, editingColor);
    setEditingId(null);
  };

  const handleDeleteEvent = (id) => {
    playAudio('click', sfx);
    onDeleteEvent(id);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] bg-black/60 flex items-center justify-center p-4 animate-in fade-in duration-300">
      <RetroWindow 
        title={`day_${formattedDate.toLowerCase().replace(/\s+/g, '_')}.exe`} 
        onClose={onClose}
        className="max-w-md w-full"
      >
        <div className="space-y-3">
          {/* Date Info */}
          <div className="mb-4 pb-3 border-b border-[var(--border)]">
            <h3 className="text-lg font-bold uppercase">{formattedDate}</h3>
            <p className="text-sm font-semibold text-[var(--text-secondary)]">{dayOfWeek}</p>
          </div>

          {/* Activities List */}
          {dayEvents.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-[var(--text-secondary)] font-semibold">No activities marked</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider opacity-60 mb-2">Activities</p>
              {dayEvents.map(event => (
                <div 
                  key={event.id}
                  className={`retro-border p-2 sm:p-3 flex items-start gap-2 ${
                    editingId === event.id ? 'bg-[var(--bg-accent)]' : 'bg-[var(--bg-window)]'
                  }`}
                >
                  <div 
                    className="w-4 h-4 flex-shrink-0 mt-1 retro-border" 
                    style={{ backgroundColor: event.color || 'var(--primary)' }}
                  />
                  {editingId === event.id ? (
                    <div className="flex-1 flex flex-col gap-2">
                      <input 
                        type="text" 
                        value={editingTitle} 
                        onChange={e => setEditingTitle(e.target.value)}
                        className="flex-1 p-1.5 retro-border bg-[var(--bg-main)] text-main-text text-sm font-bold focus:outline-none"
                        autoFocus
                      />
                      <select 
                        value={editingColor} 
                        onChange={e => setEditingColor(e.target.value)}
                        className="p-1.5 retro-border bg-[var(--bg-main)] text-main-text text-xs font-bold"
                      >
                        {colorOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label} {opt.name}
                          </option>
                        ))}
                      </select>
                      <div className="flex gap-2 justify-end">
                        <RetroButton 
                          onClick={handleCancelEdit}
                          className="px-3 py-1 text-xs"
                        >
                          Cancel
                        </RetroButton>
                        <RetroButton 
                          onClick={handleSaveEdit}
                          className="px-3 py-1 text-xs"
                        >
                          Save
                        </RetroButton>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="flex-1 font-bold text-sm break-words">{event.title}</span>
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleStartEdit(event)}
                          className="p-1 hover:brightness-110 transition-all"
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteEvent(event.id)}
                          className="p-1 hover:brightness-110 transition-all text-red-600"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add Activity Section */}
          <div className="mt-4 pt-3 border-t border-[var(--border)] space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider opacity-60">Add a reminder</p>
            <div className="flex gap-2 flex-col sm:flex-row sm:items-end">
              <input 
                type="text" 
                value={newTitle} 
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddEvent()}
                placeholder="Reminder text..." 
                className="flex-1 p-1.5 retro-border bg-[var(--bg-main)] text-main-text text-sm font-bold focus:outline-none"
              />
              <select 
                value={newColor} 
                onChange={e => setNewColor(e.target.value)}
                className="p-1.5 retro-border bg-[var(--bg-main)] text-main-text text-sm font-bold"
              >
                {colorOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <RetroButton 
                onClick={handleAddEvent}
                className="px-4 py-1.5 text-sm font-bold whitespace-nowrap"
              >
                Add
              </RetroButton>
            </div>
          </div>
        </div>
      </RetroWindow>
    </div>
  );
}
