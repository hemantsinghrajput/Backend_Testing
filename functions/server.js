"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const serverless_http_1 = __importDefault(require("serverless-http"));
const feeds_1 = __importDefault(require("./routes/feeds"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
// Middleware
app.use(express_1.default.json());
app.use('/api', feeds_1.default);
// Reuse MongoDB connection
let cachedDb = null;
async function connectToDatabase() {
    if (cachedDb) {
        console.log('✅ Using cached MongoDB connection');
        return cachedDb;
    }
    try {
        const db = await mongoose_1.default.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB connected');
        cachedDb = db;
        return db;
    }
    catch (err) {
        console.error('❌ MongoDB connection error:', err);
        throw err;
    }
}
// Initialize connection before handling requests
const handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false; // Prevent connection from closing
    await connectToDatabase();
    return (0, serverless_http_1.default)(app)(event, context);
};
exports.handler = handler;
