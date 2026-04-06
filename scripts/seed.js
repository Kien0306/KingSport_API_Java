const mongoose = require('mongoose');
const slugify = require('slugify');
const Role = require('../schemas/roles');
const User = require('../schemas/users');
const Category = require('../schemas/categories');
const Product = require('../schemas/products');
const Inventory = require('../schemas/inventories');
const Cart = require('../schemas/carts');
const Payment = require('../schemas/payments');
const Order = require('../schemas/orders');
const Shipment = require('../schemas/shipments');
const Address = require('../schemas/addresses');
const Banner = require('../schemas/banners');
const Coupon = require('../schemas/coupons');
const PointTransaction = require('../schemas/pointtransactions');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/NNPTUD-S4';

const banners = [
  { title: 'Banner 1', imageUrl: '/images/banner-fit-1.jpg', sortOrder: 1 },
  { title: 'Banner 2', imageUrl: '/images/banner-fit-2.jpg', sortOrder: 2 },
  { title: 'Banner 3', imageUrl: '/images/banner-fit-3.jpg', sortOrder: 3 }
];

const categories = [
  { name: 'Nam', image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80' },
  { name: 'Nu', image: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=900&q=80' },
  { name: 'The thao', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80' },
  { name: 'Phu kien', image: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=900&q=80' }
];

const palette = {
  Trang: '#f3f4f6',
  Den: '#18181b',
  Xam: '#9ca3af',
  Do: '#dc2626',
  XanhLam: '#1d4ed8',
  XanhLa: '#16a34a',
  Be: '#d6c4a8',
  Vang: '#facc15'
};

const productSeeds = [
  {
    title: 'Quan shorts nam Exdry Performance',
    price: 349000,
    category: 'The thao',
    description: 'Quan short the thao co gian, thich hop tap gym va chay bo.',
    image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=80',
    stock: 25,
    isFeatured: false,
    gender: 'nam',
    sizes: ['M', 'L', 'XL'],
    colors: ['Den', 'Xam', 'XanhLam']
  },
  {
    title: 'Quan shorts nam phoi line',
    price: 329000,
    category: 'The thao',
    description: 'Thiet ke phoi line tre trung, chat vai nhe thoang.',
    image: 'https://images.unsplash.com/photo-1506629905607-bb5a4c99c98e?auto=format&fit=crop&w=1200&q=80',
    stock: 18,
    isFeatured: false,
    gender: 'nam',
    sizes: ['S', 'M', 'L', 'XL'],
    colors: ['Trang', 'XanhLam', 'Den']
  },
  {
    title: 'Ao thun training nam',
    price: 289000,
    category: 'Nam',
    description: 'Ao tap the thao tham hut mo hoi.',
    image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80',
    stock: 30,
    isFeatured: true,
    gender: 'nam',
    sizes: ['M', 'L', 'XL', '2XL'],
    colors: ['Trang', 'Den', 'Do']
  },
  {
    title: 'Ao bra tap nu Flex',
    price: 259000,
    category: 'Nu',
    description: 'Ao bra nu ho tro van dong cuong do vua.',
    image: 'https://images.unsplash.com/photo-1506629905607-bb5a4c99c98e?auto=format&fit=crop&w=1200&q=80',
    stock: 22,
    isFeatured: true,
    gender: 'nu',
    sizes: ['S', 'M', 'L'],
    colors: ['Do', 'Den', 'XanhLa']
  },
  {
    title: 'Binh nuoc the thao',
    price: 99000,
    category: 'Phu kien',
    description: 'Binh nuoc 700ml, chat lieu an toan.',
    image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=1200&q=80',
    stock: 40,
    isFeatured: false,
    gender: 'unisex',
    sizes: ['One Size'],
    colors: ['XanhLam', 'Trang']
  },
  {
    title: 'Tui gym basic',
    price: 399000,
    category: 'Phu kien',
    description: 'Tui xach gym gon nhe nhieu ngan.',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80',
    stock: 14,
    isFeatured: true,
    gender: 'unisex',
    sizes: ['One Size'],
    colors: ['Den', 'Xam', 'XanhLam']
  },
  {
    title: 'Giay chay bo Swift Run',
    price: 849000,
    category: 'The thao',
    description: 'Giay chay bo de em, phu hop tap luyen hang ngay.',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80',
    stock: 16,
    isFeatured: true,
    gender: 'unisex',
    sizes: ['39', '40', '41', '42'],
    colors: ['Do', 'Den', 'Trang']
  },
  {
    title: 'Ao khoac gio nu',
    price: 459000,
    category: 'Nu',
    description: 'Ao khoac mong nhe chong nang gio.',
    image: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=80',
    stock: 12,
    isFeatured: false,
    gender: 'nu',
    sizes: ['S', 'M', 'L', 'XL'],
    colors: ['Xam', 'XanhLa', 'Den']
  }
];

async function main() {
  await mongoose.connect(MONGO_URI);
  await Promise.all([
    Role.deleteMany({}),
    User.deleteMany({}),
    Category.deleteMany({}),
    Product.deleteMany({}),
    Inventory.deleteMany({}),
    Cart.deleteMany({}),
    Payment.deleteMany({}),
    Order.deleteMany({}),
    Shipment.deleteMany({}),
    Address.deleteMany({}),
    Banner.deleteMany({}),
    Coupon.deleteMany({}),
    PointTransaction.deleteMany({})
  ]);

  await Banner.insertMany(banners);
  await Coupon.insertMany([
    { code: 'GIAM50K', title: 'Giam 50k cho don tu 500k', type: 'fixed', value: 50000, minOrderAmount: 500000, maxDiscount: 50000, isActive: true },
    { code: 'SALE10', title: 'Giam 10% toi da 120k', type: 'percent', value: 10, minOrderAmount: 300000, maxDiscount: 120000, isActive: true },
    { code: 'DOI200', title: 'Doi 200 diem lay ma 20.000d', type: 'fixed', value: 20000, minOrderAmount: 0, maxDiscount: 20000, isActive: true, isPointCoupon: true, pointsCost: 200, rewardStock: 30 },
    { code: 'DOI500', title: 'Doi 500 diem lay ma 60.000d', type: 'fixed', value: 60000, minOrderAmount: 0, maxDiscount: 60000, isActive: true, isPointCoupon: true, pointsCost: 500, rewardStock: 20 },
    { code: 'DOI1000', title: 'Doi 1000 diem lay ma 150.000d', type: 'fixed', value: 150000, minOrderAmount: 0, maxDiscount: 150000, isActive: true, isPointCoupon: true, pointsCost: 1000, rewardStock: 10 }
  ]);

  const roles = await Role.insertMany([
    { name: 'ADMIN', description: 'Quan tri he thong' },
    { name: 'MODERATOR', description: 'Quan ly noi dung' },
    { name: 'CUSTOMER', description: 'Khach hang' }
  ]);
  const roleMap = Object.fromEntries(roles.map(r => [r.name, r]));

  const createdCategories = [];
  for (const item of categories) {
    const cate = await Category.create({ ...item, slug: slugify(item.name, { lower: true, trim: true }) });
    createdCategories.push(cate);
  }
  const cateMap = Object.fromEntries(createdCategories.map(c => [c.name, c]));

  for (const item of productSeeds) {
    const product = await Product.create({
      title: item.title,
      slug: slugify(item.title, { lower: true, trim: true }),
      price: item.price,
      description: item.description,
      images: [item.image],
      category: cateMap[item.category]._id,
      gender: item.gender,
      sizes: item.sizes,
      colors: item.colors.map((name) => ({ name, hex: palette[name] || '#2563eb' })),
      isFeatured: item.isFeatured
    });
    await Inventory.create({ product: product._id, stock: item.stock, reserved: 0, soldCount: 0 });
  }

  const admin = await User.create({
    username: 'admin',
    password: 'Admin@123',
    email: 'admin@sportshop.local',
    fullName: 'Administrator',
    role: roleMap.ADMIN._id,
    status: true
  });
  const customer = await User.create({
    username: 'khachhang',
    password: 'Khach@123',
    email: 'khachhang@sportshop.local',
    fullName: 'Khach Hang',
    role: roleMap.CUSTOMER._id,
    status: true
  });
  await Cart.create({ user: admin._id, products: [] });
  await Cart.create({ user: customer._id, products: [] });
  await Address.create({ user: customer._id, fullName: 'Khach Hang', phone: '0900000000', address: '213 Nguyen Trai, TP.HCM', label: 'Nhà riêng', isDefault: true });

  console.log('Seed thanh cong');
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
