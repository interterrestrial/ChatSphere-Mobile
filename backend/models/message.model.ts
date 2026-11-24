import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema({
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Conversation",
        required: true
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    content: {
        type: String,
        required: true
    },
    clientMessageId: { type: String, select: false },
    isRead: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

MessageSchema.index({ conversationId: 1, _id: -1 });
MessageSchema.index({ conversationId: 1, senderId: 1, clientMessageId: 1 }, {
    unique: true,
    partialFilterExpression: { clientMessageId: { $type: "string" } },
});

const Message = mongoose.model("Message", MessageSchema);

export default Message;
