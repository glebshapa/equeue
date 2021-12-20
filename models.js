import mongoose from 'mongoose';
import config from './config.js';

mongoose.connect(config.db.url, { useNewUrlParser: true, useUnifiedTopology: true });

const User = mongoose.model("users", new mongoose.Schema({
    id: Number,
    total: Number,
}));

const Dish = mongoose.model("dishes", new mongoose.Schema({
    id: Number,
    name: String,
    dishCategory: Number,
    weight: Number,
    cost: Number,
    inStock: Boolean,
}));

const Order = mongoose.model("orders", new mongoose.Schema({
    id: Number,
    userId: Number,
    state: String,
    dishIds: Array,
    compensation: Number,
}));

export { User, Dish, Order };
