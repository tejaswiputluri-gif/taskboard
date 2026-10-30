import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    notes: { type: String, default: "", trim: true },
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    category: { type: String, enum: ["General", "Personal", "Work", "Study", "Health"], default: "General" },
    recurrence: { type: String, enum: ["none", "daily", "weekly"], default: "none" },
    position: { type: Number, default: Date.now },
    dueDate: { type: Date },
    done: { type: Boolean, default: false },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("Task", taskSchema);
