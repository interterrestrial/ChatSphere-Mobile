import mongoose from "mongoose";

const ConversationSchema = new mongoose.Schema({
    title: {
        type: String,
        default: null
    },
    isGroup: {
        type: Boolean,
        default: false
    },
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    }],
    directKey: { type: String, select: false },
    latestIncoming: { type: Map, of: mongoose.Schema.Types.ObjectId, select: false },
    readThrough: { type: Map, of: mongoose.Schema.Types.ObjectId, select: false },
    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
        default: null
    }
}, { timestamps: true });

ConversationSchema.index({ directKey: 1 }, { unique: true, sparse: true });
ConversationSchema.index({ participants: 1, updatedAt: -1 });

const Conversation = mongoose.model("Conversation", ConversationSchema);

export default Conversation;
