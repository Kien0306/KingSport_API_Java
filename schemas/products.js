let mongoose = require('mongoose')

const colorSchema = mongoose.Schema({
    name: { type: String, required: true },
    hex: { type: String, required: true }
}, { _id: false })

const sizePriceSchema = mongoose.Schema({
    size: { type: String, required: true },
    price: { type: Number, min: 0, required: true }
}, { _id: false })

let productSchema = mongoose.Schema({
    title: {
        type: String,
        required: true,
        unique: true
    }, slug: {
        type: String,
        unique: true
    }, price: {
        type: Number,
        min: 0
    },
    description: {
        type: String,
        default: ""
    },
    images: {
        type: [String],
        default: ["https://placehold.co/1200x800"]
    },
    gender: {
        type: String,
        enum: ['nam', 'nu', 'unisex'],
        default: 'unisex'
    },
    sizes: {
        type: [String],
        default: []
    },
    sizePrices: {
        type: [sizePriceSchema],
        default: []
    },
    colors: {
        type: [colorSchema],
        default: []
    },
    isFeatured: {
        type: Boolean,
        default: false
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'category',
        required: true
    }

}, {
    timestamps: true
})
module.exports = new mongoose.model('product', productSchema)
