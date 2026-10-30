import { Router } from "express";
import Task from "../models/Task.js";
import auth from "../middleware/auth.js";

const router = Router();
router.use(auth);

const pick = (b = {}) => {
  const out = {};
  for (const k of ["title", "notes", "priority", "category", "recurrence", "position", "dueDate", "done"]) {
    if (k in b) out[k] = k === "dueDate" && b[k] === "" ? null : b[k];
  }
  return out;
};

router.get("/", async (req, res, next) => {
  try {
    res.json(await Task.find({ user: req.userId }).sort({ position: 1, createdAt: -1 }));
  } catch (e) { next(e); }
});

router.post("/", async (req, res, next) => {
  try {
    const body = req.body || {};
    if (typeof body.title !== "string" || !body.title.trim())
      return res.status(400).json({ message: "Give the task a title." });
    const latest = await Task.findOne({ user: req.userId }).sort({ position: -1 }).select("position");
    const position = (latest?.position ?? Date.now()) + 1;
    res.status(201).json(await Task.create({ ...pick(body), position, user: req.userId }));
  } catch (e) { next(e); }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const body = req.body || {};
    if ("title" in body && (typeof body.title !== "string" || !body.title.trim()))
      return res.status(400).json({ message: "Give the task a title." });

    const completing = body.done === true;
    const filter = { _id: req.params.id, user: req.userId };
    if (completing) filter.done = { $ne: true };
    const updates = pick(body);
    if ("done" in body) updates.completedAt = body.done ? new Date() : null;
    const task = await Task.findOneAndUpdate(filter, updates, { new: true, runValidators: true });
    if (!task && completing) {
      const alreadyCompleted = await Task.findOne({ _id: req.params.id, user: req.userId });
      if (alreadyCompleted?.done) return res.json(alreadyCompleted);
    }
    if (!task) return res.status(404).json({ message: "Task not found." });

    if (completing && task.recurrence !== "none") {
      const nextDueDate = task.dueDate ? new Date(task.dueDate) : null;
      if (nextDueDate) nextDueDate.setUTCDate(nextDueDate.getUTCDate() + (task.recurrence === "daily" ? 1 : 7));
      const latest = await Task.findOne({ user: req.userId }).sort({ position: -1 }).select("position");
      await Task.create({
        user: req.userId,
        title: task.title,
        notes: task.notes,
        priority: task.priority,
        category: task.category,
        recurrence: task.recurrence,
        dueDate: nextDueDate,
        position: (latest?.position ?? task.position) + 1,
      });
    }
    res.json(task);
  } catch (e) { next(e); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.id, user: req.userId });
    if (!task) return res.status(404).json({ message: "Task not found." });
    res.json({ deleted: true });
  } catch (e) { next(e); }
});

export default router;
