import { useEffect, useState } from 'react';
import './App.css';

const API_ROOT = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
const TODOS_API_URL = `${API_ROOT}/todos`;
const CATEGORIES_API_URL = `${API_ROOT}/categories`;
const WEEKDAY_OPTIONS = [
  { value: 'mon', label: '월' },
  { value: 'tue', label: '화' },
  { value: 'wed', label: '수' },
  { value: 'thu', label: '목' },
  { value: 'fri', label: '금' },
  { value: 'sat', label: '토' },
  { value: 'sun', label: '일' },
];

function normalizeTodo(todo) {
  return {
    ...todo,
    id: todo.id || todo._id,
    dueDate: todo.dueDate || '',
    repeatDays: Array.isArray(todo.repeatDays) ? todo.repeatDays : [],
    categoryId: todo.categoryId || null,
    pinned: Boolean(todo.pinned),
    order: typeof todo.order === 'number' ? todo.order : 0,
  };
}

function normalizeCategory(category) {
  return {
    ...category,
    id: category.id || category._id,
    color: category.color || '#4f46e5',
  };
}

async function parseError(response, fallbackMessage) {
  try {
    const data = await response.json();
    return data?.message || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

function formatDueDate(dueDate) {
  if (!dueDate) {
    return '';
  }

  const normalizedDate = dueDate.includes('T') ? dueDate : `${dueDate}T00:00`;
  const parsedDate = new Date(normalizedDate);

  if (Number.isNaN(parsedDate.getTime())) {
    return dueDate;
  }

  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
  const day = String(parsedDate.getDate()).padStart(2, '0');
  const hours = String(parsedDate.getHours()).padStart(2, '0');
  const minutes = String(parsedDate.getMinutes()).padStart(2, '0');

  return `${year}.${month}.${day} ${hours}:${minutes}`;
}

function formatRepeatDays(repeatDays) {
  if (!repeatDays.length) {
    return '';
  }

  const labels = WEEKDAY_OPTIONS.filter((option) => repeatDays.includes(option.value)).map(
    (option) => option.label,
  );

  return labels.join(' · ');
}

function reorderItems(items, fromId, toId) {
  const fromIndex = items.findIndex((item) => item.id === fromId);
  const toIndex = items.findIndex((item) => item.id === toId);

  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
    return items;
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, movedItem);
  return nextItems;
}

function sortTodos(items) {
  return [...items].sort((left, right) => {
    if (left.completed !== right.completed) {
      return Number(left.completed) - Number(right.completed);
    }

    if (left.pinned !== right.pinned) {
      return Number(right.pinned) - Number(left.pinned);
    }

    if (left.order !== right.order) {
      return left.order - right.order;
    }

    return 0;
  });
}

function getCategoryMap(categories) {
  return new Map(categories.map((category) => [category.id, category]));
}

function App() {
  const [todos, setTodos] = useState([]);
  const [categories, setCategories] = useState([]);
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [repeatDays, setRepeatDays] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState('all');
  const [categoryTitle, setCategoryTitle] = useState('');
  const [categoryColor, setCategoryColor] = useState('#4f46e5');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draggedTodoId, setDraggedTodoId] = useState(null);

  const categoryMap = getCategoryMap(categories);
  const visibleTodos =
    activeCategoryId === 'all'
      ? todos
      : todos.filter((todo) => todo.categoryId === activeCategoryId);

  function handleRepeatDayChange(day) {
    setRepeatDays((currentDays) =>
      currentDays.includes(day)
        ? currentDays.filter((currentDay) => currentDay !== day)
        : [...currentDays, day],
    );
  }

  async function loadTodos() {
    try {
      setLoading(true);
      setError('');

      const response = await fetch(TODOS_API_URL);
      if (!response.ok) {
        throw new Error(await parseError(response, '목록을 불러오지 못했습니다.'));
      }

      const data = await response.json();
      setTodos(sortTodos(data.map(normalizeTodo)));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    try {
      const response = await fetch(CATEGORIES_API_URL);
      if (!response.ok) {
        throw new Error(await parseError(response, '카테고리를 불러오지 못했습니다.'));
      }

      const data = await response.json();
      setCategories(data.map(normalizeCategory));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadTodos();
    loadCategories();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      return;
    }

    try {
      setError('');

      const response = await fetch(TODOS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: trimmedTitle,
          dueDate,
          repeatDays,
          categoryId: selectedCategoryId || null,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseError(response, '할 일을 추가하지 못했습니다.'));
      }

      const newTodo = normalizeTodo(await response.json());
      setTodos((currentTodos) => sortTodos([newTodo, ...currentTodos]));
      setTitle('');
      setDueDate('');
      setRepeatDays([]);
      setSelectedCategoryId('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleToggle(todo) {
    try {
      setError('');

      const response = await fetch(`${TODOS_API_URL}/${todo.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ completed: !todo.completed }),
      });

      if (!response.ok) {
        throw new Error(await parseError(response, '상태를 변경하지 못했습니다.'));
      }

      const updatedTodo = normalizeTodo(await response.json());
      setTodos((currentTodos) =>
        sortTodos(currentTodos.map((item) => (item.id === updatedTodo.id ? updatedTodo : item))),
      );
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    try {
      setError('');

      const response = await fetch(`${TODOS_API_URL}/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(await parseError(response, '할 일을 삭제하지 못했습니다.'));
      }

      setTodos((currentTodos) => currentTodos.filter((todo) => todo.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveTodoOrder(nextTodos) {
    const response = await fetch(`${TODOS_API_URL}/reorder`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderedIds: nextTodos.map((todo) => todo.id),
      }),
    });

    if (!response.ok) {
      throw new Error(await parseError(response, '순서를 저장하지 못했습니다.'));
    }

    const data = await response.json();
    setTodos(sortTodos(data.map(normalizeTodo)));
  }

  async function handlePinToggle(todo) {
    try {
      setError('');

      const response = await fetch(`${TODOS_API_URL}/${todo.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pinned: !todo.pinned }),
      });

      if (!response.ok) {
        throw new Error(await parseError(response, '상단 고정 상태를 변경하지 못했습니다.'));
      }

      const updatedTodo = normalizeTodo(await response.json());
      const nextTodos = sortTodos(todos.map((item) => (item.id === updatedTodo.id ? updatedTodo : item)));
      await saveTodoOrder(nextTodos);
    } catch (err) {
      setError(err.message);
    }
  }

  function handleDragStart(todoId) {
    setDraggedTodoId(todoId);
  }

  function handleDragEnd() {
    setDraggedTodoId(null);
  }

  async function handleDrop(targetTodo) {
    if (!draggedTodoId || draggedTodoId === targetTodo.id) {
      setDraggedTodoId(null);
      return;
    }

    const draggedTodo = todos.find((todo) => todo.id === draggedTodoId);
    if (!draggedTodo || draggedTodo.pinned !== targetTodo.pinned || draggedTodo.completed !== targetTodo.completed) {
      setDraggedTodoId(null);
      return;
    }

    const reorderedTodos = reorderItems(todos, draggedTodoId, targetTodo.id);

    try {
      setError('');
      setTodos(reorderedTodos);
      await saveTodoOrder(reorderedTodos);
    } catch (err) {
      setError(err.message);
      loadTodos();
    } finally {
      setDraggedTodoId(null);
    }
  }

  async function handleCategorySubmit(event) {
    event.preventDefault();

    const trimmedTitle = categoryTitle.trim();
    if (!trimmedTitle) {
      return;
    }

    try {
      setError('');

      const response = await fetch(CATEGORIES_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: trimmedTitle,
          color: categoryColor,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseError(response, '카테고리를 추가하지 못했습니다.'));
      }

      const newCategory = normalizeCategory(await response.json());
      setCategories((currentCategories) => [...currentCategories, newCategory]);
      setCategoryTitle('');
      setCategoryColor('#4f46e5');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCategoryDelete(categoryId) {
    try {
      setError('');

      const response = await fetch(`${CATEGORIES_API_URL}/${categoryId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(await parseError(response, '카테고리를 삭제하지 못했습니다.'));
      }

      setCategories((currentCategories) =>
        currentCategories.filter((category) => category.id !== categoryId),
      );
      setTodos((currentTodos) =>
        currentTodos.map((todo) =>
          todo.categoryId === categoryId
            ? {
                ...todo,
                categoryId: null,
              }
            : todo,
        ),
      );

      if (selectedCategoryId === categoryId) {
        setSelectedCategoryId('');
      }

      if (activeCategoryId === categoryId) {
        setActiveCategoryId('all');
      }
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="app-shell">
      <section className="todo-layout">
        <aside className="todo-panel input-panel">
          <p className="eyebrow">Todo MVP</p>
          <h1>할 일을 추가해보세요.</h1>
          <p className="panel-copy">마감일시, 반복 요일, 카테고리, 상단 고정까지 한 번에 설정할 수 있습니다.</p>

          <form className="todo-form" onSubmit={handleSubmit}>
            <div className="todo-inputs">
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="새 할 일을 입력하세요"
              />
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
              <select value={selectedCategoryId} onChange={(event) => setSelectedCategoryId(event.target.value)}>
                <option value="">카테고리 없음</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.title}
                  </option>
                ))}
              </select>
              <div className="repeat-days-group">
                <span className="field-label">반복 요일</span>
                <div className="repeat-days-options">
                  {WEEKDAY_OPTIONS.map((option) => (
                    <label key={option.value} className="repeat-day-chip">
                      <input
                        type="checkbox"
                        checked={repeatDays.includes(option.value)}
                        onChange={() => handleRepeatDayChange(option.value)}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <button type="submit">추가</button>
          </form>

          {error ? <p className="message error">{error}</p> : null}
        </aside>

        <section className="todo-panel list-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Task Board</p>
              <h2>할 일 리스트</h2>
            </div>
            <p className="task-count">총 {todos.length}개</p>
          </div>

          <div className="category-tabs">
            <button
              type="button"
              className={`category-tab${activeCategoryId === 'all' ? ' active' : ''}`}
              onClick={() => setActiveCategoryId('all')}
            >
              전체
            </button>
            {categories.map((category) => (
              <button
                type="button"
                key={category.id}
                className={`category-tab${activeCategoryId === category.id ? ' active' : ''}`}
                style={{ '--category-color': category.color }}
                onClick={() => setActiveCategoryId(category.id)}
              >
                {category.title}
              </button>
            ))}
          </div>

          {loading ? <p className="message">불러오는 중...</p> : null}

          {!loading && visibleTodos.length === 0 ? (
            <p className="message">등록된 할 일이 없습니다.</p>
          ) : null}

          <ul className="todo-list">
            {visibleTodos.map((todo) => (
              <li
                className={`todo-item${draggedTodoId === todo.id ? ' dragging' : ''}`}
                key={todo.id}
                draggable
                onDragStart={() => handleDragStart(todo.id)}
                onDragEnd={handleDragEnd}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => handleDrop(todo)}
              >
                <button
                  type="button"
                  className={`pin-toggle${todo.pinned ? ' active' : ''}`}
                  aria-label={todo.pinned ? '고정 해제' : '상단 고정'}
                  onClick={() => handlePinToggle(todo)}
                >
                  {todo.pinned ? '★' : '☆'}
                </button>
                <button type="button" className="drag-handle" aria-label="순서 변경">
                  ::
                </button>
                <label>
                  <input
                    type="checkbox"
                    checked={todo.completed}
                    onChange={() => handleToggle(todo)}
                  />
                  <span className={todo.completed ? 'completed' : ''}>{todo.title}</span>
                </label>
                <div className="todo-meta">
                  {todo.categoryId && categoryMap.get(todo.categoryId) ? (
                    <span
                      className="todo-category-chip"
                      style={{ '--category-color': categoryMap.get(todo.categoryId).color }}
                    >
                      {categoryMap.get(todo.categoryId).title}
                    </span>
                  ) : null}
                  {todo.dueDate ? <span className="due-date">마감 {formatDueDate(todo.dueDate)}</span> : null}
                  {todo.repeatDays.length ? (
                    <span className="repeat-days-badge">반복 {formatRepeatDays(todo.repeatDays)}</span>
                  ) : null}
                </div>
                <button type="button" className="delete-button" onClick={() => handleDelete(todo.id)}>
                  삭제
                </button>
              </li>
            ))}
          </ul>
        </section>

        <aside className="todo-panel category-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Categories</p>
              <h2>카테고리 관리</h2>
            </div>
          </div>

          <form className="category-form" onSubmit={handleCategorySubmit}>
            <input
              type="text"
              value={categoryTitle}
              onChange={(event) => setCategoryTitle(event.target.value)}
              placeholder="카테고리 제목"
            />
            <label className="color-field">
              <span className="field-label">탭 색상</span>
              <input
                type="color"
                value={categoryColor}
                onChange={(event) => setCategoryColor(event.target.value)}
              />
            </label>
            <button type="submit">카테고리 추가</button>
          </form>

          <ul className="category-list">
            {categories.map((category) => (
              <li className="category-item" key={category.id}>
                <div className="category-info">
                  <span className="category-swatch" style={{ backgroundColor: category.color }} />
                  <span>{category.title}</span>
                </div>
                <button type="button" className="category-delete-button" onClick={() => handleCategoryDelete(category.id)}>
                  삭제
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </section>
    </main>
  );
}

export default App;
