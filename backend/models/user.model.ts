import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true 
    },
    email: {
        type: String, 
        required: true, 
        unique: true, 
        trim: true, 
        lowercase: true,
        minlength: [6, "Email must be at least 6 characters long"],
        maxlength: [254, "Email must be at most 254 characters long"],
    },
    username: {
        type: String,
        sparse: true,
        unique: true,
        trim: true,
        lowercase: true,
        minlength: [3, "Username must be at least 3 characters long"],
        maxlength: [20, "Username must be at most 20 characters long"],
    },
    googleId: {
        type: String,
        sparse: true,
        unique: true,
    },
    password: { 
        type: String, 
        required: false, // Optional for users who sign up via Google
        select: false,
        minlength: [6, "Password must be at least 6 characters long"],
    },
    isUsernameSet: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

const User = mongoose.model("User", UserSchema);

export default User;
