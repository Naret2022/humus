const path = require('node:path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, 'atlas-credentials.env'), quiet: true });
dotenv.config({ path: path.join(__dirname, '.env'), quiet: true });

const crypto = require('node:crypto');
const express = require('express');
const mongoose = require('mongoose');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);

const app = express();
const port = Number(process.env.PORT) || 3000;
const sessions = new Set();
const COOKIE_NAME = 'humus_admin_session';
const localAdminBypass = process.env.ADMIN_AUTH_DISABLED === 'true' && process.env.NODE_ENV !== 'production';

mongoose.connection.on('connected', () => console.log('MongoDB connection established'));
mongoose.connection.on('reconnected', () => console.log('MongoDB connection recovered'));
mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected; waiting for driver to reconnect'));
mongoose.connection.on('error', (error) => console.error('MongoDB connection error:', error.message));

app.use(express.json({ limit: '12mb' }));

const photoSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, required: true, maxlength: 4000 },
  url: { type: String, required: true, maxlength: 12_000_000 }
}, { timestamps: true });

const videoSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 255 },
  url: { type: String, required: true, maxlength: 8_000_000 }
}, { timestamps: true });

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  price: { type: Number, required: true, min: 0 },
  promoPrice: { type: Number, default: null, min: 0 },
  note: { type: String, default: '', maxlength: 2000 },
  imageData: { type: String, required: true, maxlength: 12_000_000 }
}, { timestamps: true });

const contactSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: 'main' },
  address: { type: String, default: '', maxlength: 2000 },
  phone: { type: String, default: '', maxlength: 100 },
  email: { type: String, default: '', maxlength: 254 },
  line: { type: String, default: '', maxlength: 100 },
  facebook: { type: String, default: '', maxlength: 500 },
  other: { type: String, default: '', maxlength: 2000 }
});

const adminUserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  salt: { type: String, required: true },
  passwordHash: { type: String, required: true }
}, { timestamps: true });

const siteHeaderSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: 'main' },
  imageData: { type: String, default: '', maxlength: 12_000_000 },
  heightPx: { type: Number, default: 400, min: 220, max: 480 },
  zoomPercent: { type: Number, default: 100, min: 100, max: 180 },
  positionX: { type: Number, default: 50, min: 0, max: 100 },
  positionY: { type: Number, default: 50, min: 0, max: 100 }
}, { timestamps: true });

const Photo = mongoose.model('Photo', photoSchema);
const Video = mongoose.model('Video', videoSchema);
const Product = mongoose.model('Product', productSchema);
const Contact = mongoose.model('Contact', contactSchema);
const AdminUser = mongoose.model('AdminUser', adminUserSchema);
const SiteHeader = mongoose.model('SiteHeader', siteHeaderSchema);

async function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = await scrypt(password, salt, 64);
  return { salt, passwordHash: derived.toString('hex') };
}

async function ensureAdminUser() {
  const username = String(process.env.ADMIN_USERNAME || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) return;
  const { salt, passwordHash } = await hashPassword(password);
  await AdminUser.updateOne({ username }, { $set: { username, salt, passwordHash } }, { upsert: true });
  console.log('Admin account synchronized with MongoDB');
}

function getSessionId(request) {
  const cookies = request.headers.cookie || '';
  const cookie = cookies.split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`));
  return cookie ? cookie.slice(COOKIE_NAME.length + 1) : '';
}

function requireAdmin(request, response, next) {
  if (sessions.has(getSessionId(request))) return next();
  response.status(401).json({ error: 'กรุณาเข้าสู่ระบบ Admin ใหม่' });
}

function validateId(id, response) {
  if (mongoose.isValidObjectId(id)) return true;
  response.status(400).json({ error: 'รหัสข้อมูลไม่ถูกต้อง' });
  return false;
}

function handleApiError(response, error) {
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    response.status(400).json({ error: error.message });
    return;
  }
  console.error('Database request failed:', error.message);
  response.status(500).json({ error: 'บันทึกหรืออ่านข้อมูลไม่สำเร็จ กรุณาลองใหม่' });
}

app.post('/api/admin/login', async (request, response) => {
  if (localAdminBypass) {
    const sessionId = crypto.randomBytes(32).toString('hex');
    sessions.add(sessionId);
    response.setHeader('Set-Cookie', `${COOKIE_NAME}=${sessionId}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`);
    response.json({ ok: true });
    return;
  }
  if (mongoose.connection.readyState !== 1) {
    response.status(503).json({ error: 'MongoDB is not connected yet' });
    return;
  }
  const username = String(request.body?.username || '').trim().toLowerCase();
  const password = String(request.body?.password || '');
  try {
    const admin = await AdminUser.findOne({ username }).lean();
    if (!admin) {
      response.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
      return;
    }
    const submittedHash = Buffer.from((await scrypt(password, admin.salt, 64)).toString('hex'), 'hex');
    const savedHash = Buffer.from(admin.passwordHash, 'hex');
    if (submittedHash.length !== savedHash.length || !crypto.timingSafeEqual(submittedHash, savedHash)) {
      response.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
      return;
    }
  } catch (error) {
    handleApiError(response, error);
    return;
  }

  const sessionId = crypto.randomBytes(32).toString('hex');
  sessions.add(sessionId);
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  response.setHeader('Set-Cookie', `${COOKIE_NAME}=${sessionId}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure}`);
  response.json({ ok: true });
});

app.post('/api/admin/login-legacy', (request, response) => {
  response.sendStatus(404);
  return;
  if (!localAdminBypass) {
    const username = process.env.ADMIN_USERNAME;
    const password = process.env.ADMIN_PASSWORD;
    if (!username || !password) {
      response.status(503).json({ error: 'กรุณาตั้ง ADMIN_USERNAME และ ADMIN_PASSWORD ในไฟล์ .env' });
      return;
    }
    if (!safeEqual(request.body?.username || '', username) || !safeEqual(request.body?.password || '', password)) {
      response.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
      return;
    }
  }

  const sessionId = crypto.randomBytes(32).toString('hex');
  sessions.add(sessionId);
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  response.setHeader('Set-Cookie', `${COOKIE_NAME}=${sessionId}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure}`);
  response.json({ ok: true });
});

app.post('/api/admin/logout', requireAdmin, (request, response) => {
  sessions.delete(getSessionId(request));
  response.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
  response.json({ ok: true });
});

function requireDatabase(_request, response, next) {
  if (mongoose.connection.readyState === 1) return next();
  response.status(503).json({ error: 'MongoDB ยังไม่เชื่อมต่อ ลองอีกครั้งเมื่อฐานข้อมูลพร้อม' });
}

app.use('/api/home-data', requireDatabase);
app.use('/api/photos', requireDatabase);
app.use('/api/videos', requireDatabase);
app.use('/api/products', requireDatabase);
app.use('/api/contact', requireDatabase);
app.use('/api/header', requireDatabase);

app.get('/api/home-data', async (_request, response) => {
  try {
    const [photos, videos, products, contact, header] = await Promise.all([
      Photo.find().sort({ createdAt: 1 }).lean(),
      Video.find().sort({ createdAt: 1 }).lean(),
      Product.find().sort({ createdAt: -1 }).lean(),
      Contact.findOne({ key: 'main' }).lean(),
      SiteHeader.findOne({ key: 'main' }).lean()
    ]);
    response.json({
      photos: photos.map(({ _id, title, description, url }) => ({ id: _id, title, description, url })),
      videos: videos.map(({ _id, title, url }) => ({ id: _id, title, url })),
      products: products.map(({ _id, name, price, promoPrice, note, imageData }) => ({ id: _id, name, price, promoPrice, note, imageData })),
      contact: contact ? {
        address: contact.address, phone: contact.phone, email: contact.email,
        line: contact.line, facebook: contact.facebook, other: contact.other
      } : {},
      header: header ? { imageData: header.imageData, heightPx: header.heightPx, zoomPercent: header.zoomPercent || 100, positionX: header.positionX ?? 50, positionY: header.positionY ?? 50 } : { imageData: '', heightPx: 400, zoomPercent: 100, positionX: 50, positionY: 50 }
    });
  } catch (error) {
    handleApiError(response, error);
  }
});

app.post('/api/products', requireAdmin, async (request, response) => {
  try {
    const product = await Product.create(request.body);
    response.status(201).json({ id: product.id, name: product.name, price: product.price, promoPrice: product.promoPrice, note: product.note, imageData: product.imageData });
  } catch (error) { handleApiError(response, error); }
});

app.put('/api/products/:id', requireAdmin, async (request, response) => {
  if (!validateId(request.params.id, response)) return;
  try {
    const product = await Product.findByIdAndUpdate(request.params.id, request.body, { new: true, runValidators: true });
    if (!product) return response.status(404).json({ error: 'ไม่พบสินค้านี้' });
    response.json({ id: product.id, name: product.name, price: product.price, promoPrice: product.promoPrice, note: product.note, imageData: product.imageData });
  } catch (error) { handleApiError(response, error); }
});

app.delete('/api/products/:id', requireAdmin, async (request, response) => {
  if (!validateId(request.params.id, response)) return;
  try {
    const product = await Product.findByIdAndDelete(request.params.id);
    if (!product) return response.status(404).json({ error: 'ไม่พบสินค้านี้' });
    response.status(204).end();
  } catch (error) { handleApiError(response, error); }
});

app.put('/api/header', requireAdmin, async (request, response) => {
  const heightPx = Number(request.body?.heightPx);
  const zoomPercent = Number(request.body?.zoomPercent ?? 100);
  const positionX = Number(request.body?.positionX ?? 50);
  const positionY = Number(request.body?.positionY ?? 50);
  const imageData = String(request.body?.imageData || '');
  if (!Number.isInteger(heightPx) || heightPx < 220 || heightPx > 480) {
    response.status(400).json({ error: 'ความสูงต้องอยู่ระหว่าง 220 ถึง 480 px' });
    return;
  }
  if (!Number.isInteger(zoomPercent) || zoomPercent < 100 || zoomPercent > 180) {
    response.status(400).json({ error: 'ระดับซูมต้องอยู่ระหว่าง 100 ถึง 180%' });
    return;
  }
  if (!Number.isFinite(positionX) || positionX < 0 || positionX > 100 || !Number.isFinite(positionY) || positionY < 0 || positionY > 100) {
    response.status(400).json({ error: 'ตำแหน่งภาพต้องอยู่ระหว่าง 0 ถึง 100' });
    return;
  }
  try {
    const header = await SiteHeader.findOneAndUpdate({ key: 'main' }, { imageData, heightPx, zoomPercent, positionX, positionY }, {
      new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true
    });
    response.json({ imageData: header.imageData, heightPx: header.heightPx, zoomPercent: header.zoomPercent, positionX: header.positionX, positionY: header.positionY });
  } catch (error) { handleApiError(response, error); }
});

app.post('/api/photos', requireAdmin, async (request, response) => {
  try {
    const photo = await Photo.create(request.body);
    response.status(201).json({ id: photo.id, title: photo.title, description: photo.description, url: photo.url });
  } catch (error) { handleApiError(response, error); }
});

app.put('/api/photos/:id', requireAdmin, async (request, response) => {
  if (!validateId(request.params.id, response)) return;
  try {
    const photo = await Photo.findByIdAndUpdate(request.params.id, request.body, { new: true, runValidators: true });
    if (!photo) return response.status(404).json({ error: 'ไม่พบรูปภาพนี้' });
    response.json({ id: photo.id, title: photo.title, description: photo.description, url: photo.url });
  } catch (error) { handleApiError(response, error); }
});

app.delete('/api/photos/:id', requireAdmin, async (request, response) => {
  if (!validateId(request.params.id, response)) return;
  try {
    const photo = await Photo.findByIdAndDelete(request.params.id);
    if (!photo) return response.status(404).json({ error: 'ไม่พบรูปภาพนี้' });
    response.status(204).end();
  } catch (error) { handleApiError(response, error); }
});

app.post('/api/videos', requireAdmin, async (request, response) => {
  try {
    const video = await Video.create(request.body);
    response.status(201).json({ id: video.id, title: video.title, url: video.url });
  } catch (error) { handleApiError(response, error); }
});

app.put('/api/videos/:id', requireAdmin, async (request, response) => {
  if (!validateId(request.params.id, response)) return;
  try {
    const video = await Video.findByIdAndUpdate(request.params.id, request.body, { new: true, runValidators: true });
    if (!video) return response.status(404).json({ error: 'ไม่พบวิดีโอนี้' });
    response.json({ id: video.id, title: video.title, url: video.url });
  } catch (error) { handleApiError(response, error); }
});

app.delete('/api/videos/:id', requireAdmin, async (request, response) => {
  if (!validateId(request.params.id, response)) return;
  try {
    const video = await Video.findByIdAndDelete(request.params.id);
    if (!video) return response.status(404).json({ error: 'ไม่พบวิดีโอนี้' });
    response.status(204).end();
  } catch (error) { handleApiError(response, error); }
});

app.put('/api/contact', requireAdmin, async (request, response) => {
  try {
    const fields = ['address', 'phone', 'email', 'line', 'facebook', 'other'];
    const values = Object.fromEntries(fields.map((field) => [field, String(request.body?.[field] || '').trim()]));
    const contact = await Contact.findOneAndUpdate({ key: 'main' }, values, {
      new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true
    });
    response.json(Object.fromEntries(fields.map((field) => [field, contact[field]])));
  } catch (error) { handleApiError(response, error); }
});

app.get('/api/health', (_request, response) => {
  response.json({ database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

app.get('/api/admin/config', (_request, response) => {
  response.json({ authRequired: !localAdminBypass });
});

app.use(express.static(__dirname, { dotfiles: 'ignore' }));

async function connectDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    await ensureAdminUser();
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error(`MongoDB connection failed; retrying in 10 seconds: ${error.message}`);
    const retry = setTimeout(connectDatabase, 10000);
    retry.unref();
  }
}

async function start() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is missing. Add it to .env.');
  const host = localAdminBypass ? '127.0.0.1' : '0.0.0.0';
  if (localAdminBypass) console.warn('Admin password bypass enabled; server is restricted to this computer.');
  app.listen(port, host, () => console.log(`Website is running at http://localhost:${port}`));
  void connectDatabase();
}

start().catch((error) => {
  console.error(`Startup failed: ${error.message}`);
  process.exitCode = 1;
});
