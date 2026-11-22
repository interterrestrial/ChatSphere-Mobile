import mongoose from "mongoose";

const connectDB = async () => {
    const uri = process.env.MONGO_URI?.replace(/^["']|["']$/g, '').trim();
    if (!uri) {
        throw new Error("MONGO_URI environment variable is required");
    }

    // Disable buffering so we see errors immediately instead of timing out
    mongoose.set('bufferCommands', false);

    console.log("Connecting to MongoDB...");
    try {
        await mongoose.connect(uri, { 
            family: 4,
            serverSelectionTimeoutMS: 20000 
        });
        console.log("MongoDB connected successfully!");
    } catch (err: any) {
        console.error("CRITICAL DB CONNECTION ERROR:", err.message);
        throw err;
    }
}

export default connectDB;