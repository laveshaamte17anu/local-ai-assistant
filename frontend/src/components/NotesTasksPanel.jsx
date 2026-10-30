import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  FileText,
  CheckSquare,
  Tag,
  ArrowRight
} from 'lucide-react';
import {
  fetchNotes,
  createNote,
  deleteNote,
  fetchTasks,
  createTask,
  updateTask,
  deleteTask
} from '../services/api';

export default function NotesTasksPanel({
  isOpen,
  onClose,
  onInsertToPrompt
}) {
  const [activeTab, setActiveTab] = useState('notes'); // 'notes' | 'tasks'
  const [notes, setNotes] = useState([]);
  const [tasks, setTasks] = useState([]);

  // New Note State
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteTags, setNoteTags] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);

  // New Task State
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');
  const [isAddingTask, setIsAddingTask] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [notesRes, tasksRes] = await Promise.all([
        fetchNotes().catch(() => ({ notes: [] })),
        fetchTasks().catch(() => ({ tasks: [] })),
      ]);
      setNotes(notesRes.notes || []);
      setTasks(tasksRes.tasks || []);
    } catch (e) {
      console.warn('Failed to load notes/tasks:', e);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  const handleCreateNote = async (e) => {
    e.preventDefault();
    if (!noteTitle.trim()) return;
    try {
      const created = await createNote({
        title: noteTitle.trim(),
        content: noteContent.trim(),
        tags: noteTags.trim(),
      });
      setNotes([created, ...notes]);
      setNoteTitle('');
      setNoteContent('');
      setNoteTags('');
      setIsAddingNote(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteNote = async (id) => {
    try {
      await deleteNote(id);
      setNotes(notes.filter((n) => n.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    try {
      const created = await createTask({
        title: taskTitle.trim(),
        priority: taskPriority,
      });
      setTasks([created, ...tasks]);
      setTaskTitle('');
      setIsAddingTask(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleTask = async (task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    try {
      const updated = await updateTask(task.id, {
        status: newStatus,
        title: task.title,
      });
      setTasks(tasks.map((t) => (t.id === task.id ? updated : t)));
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteTask = async (id) => {
    try {
      await deleteTask(id);
      setTasks(tasks.filter((t) => t.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="drawer-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="notes-tasks-drawer" aria-label="Notes and Tasks Drawer">
        <div className="drawer-header">
        <div className="drawer-tabs">
          <button
            type="button"
            className={`drawer-tab-btn ${activeTab === 'notes' ? 'active' : ''}`}
            onClick={() => setActiveTab('notes')}
          >
            <FileText size={14} />
            <span>Notes ({notes.length})</span>
          </button>
          <button
            type="button"
            className={`drawer-tab-btn ${activeTab === 'tasks' ? 'active' : ''}`}
            onClick={() => setActiveTab('tasks')}
          >
            <CheckSquare size={14} />
            <span>Tasks ({tasks.length})</span>
          </button>
        </div>
        <button
          type="button"
          className="drawer-close-btn"
          onClick={onClose}
          aria-label="Close drawer"
        >
          <X size={16} />
        </button>
      </div>

      <div className="drawer-body">
        {activeTab === 'notes' && (
          <div className="notes-panel">
            {!isAddingNote ? (
              <button
                type="button"
                className="drawer-add-btn"
                onClick={() => setIsAddingNote(true)}
              >
                <Plus size={14} />
                <span>New Note</span>
              </button>
            ) : (
              <form className="drawer-add-form" onSubmit={handleCreateNote}>
                <input
                  type="text"
                  placeholder="Note title..."
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  className="drawer-input"
                  autoFocus
                />
                <textarea
                  placeholder="Note content / code snippet..."
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  className="drawer-textarea"
                  rows={3}
                />
                <input
                  type="text"
                  placeholder="Tags (comma separated)..."
                  value={noteTags}
                  onChange={(e) => setNoteTags(e.target.value)}
                  className="drawer-input"
                />
                <div className="drawer-form-actions">
                  <button type="submit" className="drawer-btn-save">
                    Save Note
                  </button>
                  <button
                    type="button"
                    className="drawer-btn-cancel"
                    onClick={() => setIsAddingNote(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <div className="notes-list">
              {notes.length === 0 && !isAddingNote ? (
                <div className="drawer-empty-state">
                  <p>No notes saved yet.</p>
                  <span>Save code snippets, thoughts, or prompt templates locally.</span>
                </div>
              ) : (
                notes.map((note) => (
                  <div key={note.id} className="note-card">
                    <div className="note-card-header">
                      <h4 className="note-title">{note.title}</h4>
                      <div className="note-actions">
                        {onInsertToPrompt && (
                          <button
                            type="button"
                            className="note-action-btn"
                            onClick={() => onInsertToPrompt(note.content || note.title)}
                            title="Insert into chat prompt"
                          >
                            <ArrowRight size={13} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="note-action-btn delete"
                          onClick={() => handleDeleteNote(note.id)}
                          title="Delete note"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    {note.content && <p className="note-content-preview">{note.content}</p>}
                    {note.tags && (
                      <div className="note-tags-row">
                        {note.tags.split(',').map((t, idx) => (
                          <span key={idx} className="note-tag-chip">
                            <Tag size={10} />
                            {t.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="tasks-panel">
            {!isAddingTask ? (
              <button
                type="button"
                className="drawer-add-btn"
                onClick={() => setIsAddingTask(true)}
              >
                <Plus size={14} />
                <span>New Task</span>
              </button>
            ) : (
              <form className="drawer-add-form" onSubmit={handleCreateTask}>
                <input
                  type="text"
                  placeholder="Task title..."
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="drawer-input"
                  autoFocus
                />
                <div className="drawer-row-select">
                  <label htmlFor="task-priority-select">Priority:</label>
                  <select
                    id="task-priority-select"
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value)}
                    className="drawer-select"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div className="drawer-form-actions">
                  <button type="submit" className="drawer-btn-save">
                    Save Task
                  </button>
                  <button
                    type="button"
                    className="drawer-btn-cancel"
                    onClick={() => setIsAddingTask(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <div className="tasks-list">
              {tasks.length === 0 && !isAddingTask ? (
                <div className="drawer-empty-state">
                  <p>No tasks yet.</p>
                  <span>Track action items and coding milestones here.</span>
                </div>
              ) : (
                tasks.map((task) => {
                  const isDone = task.status === 'completed';
                  return (
                    <div key={task.id} className={`task-card ${isDone ? 'completed' : ''}`}>
                      <button
                        type="button"
                        className="task-toggle-btn"
                        onClick={() => handleToggleTask(task)}
                        title={isDone ? 'Mark pending' : 'Mark completed'}
                      >
                        {isDone ? (
                          <CheckCircle2 size={16} className="task-done-icon" />
                        ) : (
                          <Circle size={16} className="task-pending-icon" />
                        )}
                      </button>
                      <div className="task-info">
                        <span className="task-title-text">{task.title}</span>
                        {task.priority && (
                          <span className={`task-priority-tag ${task.priority}`}>
                            {task.priority}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="task-action-btn delete"
                        onClick={() => handleDeleteTask(task.id)}
                        title="Delete task"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  </>
  );
}
