let mongoose = require('mongoose')

const sizeStockSchema = mongoose.Schema({
    size: { type: String, required: true },
    stock: { type: Number, min: 0, default: 0 },
    soldCount: { type: Number, min: 0, default: 0 }
}, { _id: false })

let inventorySchema = mongoose.Schema({
    product: {
        type: mongoose.Types.ObjectId,
        ref: 'product',
        required: true,
        unique: true
    },
    stock: {
        type: Number,
        min: 0,
        default: 0
    },
    reserved: {
        type: Number,
        min: 0,
        default: 0
    },
    soldCount: {
        type: Number,
        min: 0,
        default: 0
    },
    sizeStocks: {
        type: [sizeStockSchema],
        default: []
    }
}, { timestamps: true })
module.exports = new mongoose.model('inventory', inventorySchema)
