let mongoose = require('mongoose')
let stockMovementSchema = mongoose.Schema({
    product: { type: mongoose.Types.ObjectId, ref: 'product', required: true },
    type: { type: String, enum: ['in', 'out'], required: true },
    quantity: { type: Number, min: 1, required: true },
    stockBefore: { type: Number, min: 0, default: 0 },
    stockAfter: { type: Number, min: 0, default: 0 },
    note: { type: String, default: '' },
    createdBy: { type: mongoose.Types.ObjectId, ref: 'user' }
}, { timestamps: true })
module.exports = new mongoose.model('stockmovement', stockMovementSchema)
