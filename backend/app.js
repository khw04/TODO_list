require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const validRepeatDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const weekdayMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function isAllowedOrigin(origin) {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.includes(origin)) {
    return true;
  }

  return /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);
}

function normalizeRepeatDays(repeatDays) {
  if (!Array.isArray(repeatDays)) {
    return [];
  }

  return [...new Set(repeatDays.filter((day) => validRepeatDays.includes(day)))];
}

function getLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shouldResetRepeatTodo(todo, now) {
  if (!todo.completed || !todo.repeatDays.length) {
    return false;
  }

  const todayWeekday = weekdayMap[now.getDay()];
  if (!todo.repeatDays.includes(todayWeekday)) {
    return false;
  }

  if (!todo.lastCompletedAt) {
    return true;
  }

  const completedAt = new Date(todo.lastCompletedAt);
  if (Number.isNaN(completedAt.getTime())) {
    return true;
  }

  return getLocalDateKey(completedAt) !== getLocalDateKey(now);
}

function normalizeCategoryColor(color) {
  if (typeof color !== 'string') {
    return '#4f46e5';
  }

  const trimmedColor = color.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmedColor) ? trimmedColor : '#4f46e5';
}

const todoSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    completed: {
      type: Boolean,
      default: false,
    },
    dueDate: {
      type: String,
      default: null,
    },
    repeatDays: {
      type: [String],
      default: [],
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      ref: 'Category',
    },
    pinned: {
      type: Boolean,
      default: false,
    },
    order: {
      type: Number,
      default: 0,
    },
    lastCompletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

const categorySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    color: {
      type: String,
      required: true,
      default: '#4f46e5',
    },
  },
  {
    timestamps: true,
  },
);

const Todo = mongoose.models.Todo || mongoose.model('Todo', todoSchema);
const Category = mongoose.models.Category || mongoose.model('Category', categorySchema);

async function getNextOrder() {
  const lastTodo = await Todo.findOne().sort({ order: -1, createdAt: -1 });
  return (lastTodo?.order ?? -1) + 1;
}

async function reorderTodosByGroups(orderedIds) {
  const todos = await Todo.find({ _id: { $in: orderedIds } });
  const todoById = new Map(todos.map((todo) => [String(todo._id), todo]));
  const groups = {
    completedPinned: [],
    activePinned: [],
    completedRegular: [],
    activeRegular: [],
  };

  orderedIds.forEach((id) => {
    const todo = todoById.get(id);
    if (!todo) {
      return;
    }

    if (todo.pinned && todo.completed) {
      groups.completedPinned.push(id);
      return;
    }

    if (todo.pinned) {
      groups.activePinned.push(id);
      return;
    }

    if (todo.completed) {
      groups.completedRegular.push(id);
      return;
    }

    groups.activeRegular.push(id);
  });

  const finalIds = [
    ...groups.activePinned,
    ...groups.completedPinned,
    ...groups.activeRegular,
    ...groups.completedRegular,
  ];

  await Promise.all(
    finalIds.map((id, index) =>
      Todo.findByIdAndUpdate(id, {
        order: index,
      }),
    ),
  );
}

let cachedConnectionPromise = null;

async function connectDatabase() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing. Add it to backend/.env or Vercel env vars');
  }

  if (!cachedConnectionPromise) {
    cachedConnectionPromise = mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
  }

  await cachedConnectionPromise;
  return mongoose.connection;
}

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Not allowed by CORS'));
    },
  }),
);
app.use(express.json());

app.get('/todos', async (req, res) => {
  try {
    const now = new Date();
    const todos = await Todo.find().sort({ pinned: -1, completed: 1, order: 1, createdAt: -1 });

    const todosToReset = todos.filter((todo) => shouldResetRepeatTodo(todo, now));

    if (todosToReset.length) {
      await Promise.all(
        todosToReset.map((todo) => {
          todo.completed = false;
          return todo.save();
        }),
      );
    }

    res.json(todos);
  } catch (error) {
    res.status(500).json({ message: 'failed to load todos' });
  }
});

app.get('/categories', async (req, res) => {
  try {
    const categories = await Category.find().sort({ createdAt: 1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: 'failed to load categories' });
  }
});

app.post('/categories', async (req, res) => {
  const title = String(req.body?.title || '').trim();
  const color = normalizeCategoryColor(req.body?.color);

  if (!title) {
    return res.status(400).json({ message: 'category title is required' });
  }

  try {
    const category = await Category.create({ title, color });
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ message: 'failed to create category' });
  }
});

app.post('/todos', async (req, res) => {
  const title = String(req.body?.title || '').trim();
  const dueDate = typeof req.body?.dueDate === 'string' ? req.body.dueDate.trim() : '';
  const repeatDays = normalizeRepeatDays(req.body?.repeatDays);
  const pinned = Boolean(req.body?.pinned);
  const categoryId = mongoose.Types.ObjectId.isValid(req.body?.categoryId) ? req.body.categoryId : null;

  if (!title) {
    return res.status(400).json({ message: 'title is required' });
  }

  try {
    const newTodo = await Todo.create({
      title,
      dueDate: dueDate || null,
      repeatDays,
      categoryId,
      pinned,
      order: await getNextOrder(),
    });
    res.status(201).json(newTodo);
  } catch (error) {
    res.status(500).json({ message: 'failed to create todo' });
  }
});

app.put('/todos/reorder', async (req, res) => {
  const orderedIds = Array.isArray(req.body?.orderedIds)
    ? req.body.orderedIds.filter((id) => mongoose.Types.ObjectId.isValid(id))
    : [];

  if (!orderedIds.length) {
    return res.status(400).json({ message: 'orderedIds is required' });
  }

  try {
    await reorderTodosByGroups(orderedIds);
    const todos = await Todo.find().sort({ pinned: -1, completed: 1, order: 1, createdAt: -1 });
    res.json(todos);
  } catch (error) {
    res.status(500).json({ message: 'failed to reorder todos' });
  }
});

app.put('/todos/:id', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'invalid todo id' });
  }

  const updates = {};

  if (typeof req.body?.completed === 'boolean') {
    updates.completed = req.body.completed;
    updates.lastCompletedAt = req.body.completed ? new Date() : null;
  }

  if (typeof req.body?.title === 'string' && req.body.title.trim()) {
    updates.title = req.body.title.trim();
  }

  if (typeof req.body?.dueDate === 'string') {
    updates.dueDate = req.body.dueDate.trim() || null;
  }

  if (Array.isArray(req.body?.repeatDays)) {
    updates.repeatDays = normalizeRepeatDays(req.body.repeatDays);
  }

  if (req.body?.categoryId === null || req.body?.categoryId === '') {
    updates.categoryId = null;
  }

  if (mongoose.Types.ObjectId.isValid(req.body?.categoryId)) {
    updates.categoryId = req.body.categoryId;
  }

  if (typeof req.body?.pinned === 'boolean') {
    updates.pinned = req.body.pinned;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ message: 'no valid fields to update' });
  }

  try {
    const updatedTodo = await Todo.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!updatedTodo) {
      return res.status(404).json({ message: 'todo not found' });
    }

    res.json(updatedTodo);
  } catch (error) {
    res.status(500).json({ message: 'failed to update todo' });
  }
});

app.delete('/categories/:id', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'invalid category id' });
  }

  try {
    const deletedCategory = await Category.findByIdAndDelete(req.params.id);

    if (!deletedCategory) {
      return res.status(404).json({ message: 'category not found' });
    }

    await Todo.updateMany(
      { categoryId: req.params.id },
      {
        $set: { categoryId: null },
      },
    );

    res.json({ message: 'deleted' });
  } catch (error) {
    res.status(500).json({ message: 'failed to delete category' });
  }
});

app.delete('/todos/:id', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'invalid todo id' });
  }

  try {
    const deletedTodo = await Todo.findByIdAndDelete(req.params.id);

    if (!deletedTodo) {
      return res.status(404).json({ message: 'todo not found' });
    }

    res.json({ message: 'deleted' });
  } catch (error) {
    res.status(500).json({ message: 'failed to delete todo' });
  }
});

app.connectDatabase = connectDatabase;

module.exports = app;
